import { rehearsalRowsToPrint } from "@/lib/reconciled-timeline";
import { loadAppSettings, prisma } from "@/lib/db";
import { canSeeDinnerTab } from "@/lib/access";
import { collectDayOfContactInputs, guestPhoneByPersonId } from "@/lib/day-of";
import { loadTimelineRoleNames } from "@/lib/day-timeline-roles";
import { reviewMoment } from "@/lib/day-timeline-view";
import { withoutBrideSecrets } from "@/lib/print-packets";
import { sortTimelineBlocks } from "@/lib/day-of-time";
import { guestInclude, mapGuestRecord } from "@/lib/guests";
import { buildMcRunOfShow } from "@/lib/mc-run-of-show";
import { loadVisibleBudgetContracts } from "@/lib/money-page";
import { playbookByKind } from "@/lib/playbook";
import { loadPlaybookItems } from "@/lib/playbook-data";
import {
  buildQuickReference,
  coordinatorPhoneFromPlaybook,
  mcRoleSplit,
  professionalizeAssignmentNotes,
  professionalizePrintLines,
  projectCoordinatorRows,
  projectDecorGroups,
  projectHairMakeup,
  projectHouseholds,
  projectKeyDates,
  projectMealSections,
  projectSetupPlan,
  projectShotGroups,
  projectTaskGroups,
  projectTimelineOpenItems,
  projectWeddingParty,
} from "@/lib/print-projection";
import {
  formatPrintWeddingDate,
  groupPrintContacts,
  isSetupTeardownContact,
  mcPeopleFromDirectory,
  moneyFingerprint,
  setupTeardownFromCanonical,
  toPrintPlaybookRow,
  type PrintCenterDocument,
  type PrintSectionId,
  PRINT_SECTION_IDS,
} from "@/lib/print-center";
import { taskVisibilityWhere } from "@/lib/tasks";
import type { SessionAccount } from "@/lib/types";

function availableForSession(session: SessionAccount): PrintSectionId[] {
  const dinner = session.isMaster || canSeeDinnerTab(session);
  const can = (need: boolean) => session.isMaster || need;
  return PRINT_SECTION_IDS.filter((id) => {
    switch (id) {
      case "overview":
        return true;
      case "rehearsal":
        return dinner;
      case "meals":
        return dinner || can(session.canSeeShop);
      case "party":
      case "schedule":
      case "timeline":
      case "mc":
      case "hair":
      case "shots":
      case "contacts":
      case "assignments":
      case "setup":
      case "coordinator":
      case "decor":
        return can(session.canSeeTimeline);
      case "guests":
        return can(session.canSeeGuests);
      // Only the mini moon prints here now; it travels with the day's plan.
      case "stay":
        return can(session.canSeeTimeline);
      case "tasks":
      case "tasksDone":
        return can(session.canSeeTasks);
      case "calendar":
        return can(session.canSeeCalendar);
      case "money":
        return can(session.canSeeBudget);
    }
  });
}

/**
 * Contacts first, then guest people whose full name is not already a Contact
 * (kept even without a phone, so a shared first name is never mistaken for one person). A household phone is attributed to each
 * named guest in it; the lineup only matches on first names, and an ambiguous
 * first name prints TBD rather than a guess.
 */
export function mergePartyPhoneSources(
  contacts: Array<{ name: string; phone: string | null }>,
  guestPeople: Array<{ name: string; phone: string | null }>,
): Array<{ name: string; phone: string | null }> {
  const merged = contacts.map((row) => ({ name: row.name, phone: row.phone }));
  const seen = new Set(merged.map((row) => row.name.trim().toLowerCase()));
  for (const row of guestPeople) {
    const key = row.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({ name: row.name, phone: row.phone });
  }
  return merged;
}

/** "Friday, October 16" for the wedding date, or a day before or after it. */
function printDay(date: Date, timezone: string, offsetDays: number): string {
  return new Date(date.getTime() + offsetDays * 86_400_000).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  });
}

export async function loadPrintCenterDocument(
  session: SessionAccount,
): Promise<PrintCenterDocument> {
  const availableSections = availableForSession(session);
  const dinner = availableSections.includes("rehearsal");
  const timeline = availableSections.includes("timeline");
  const guestsOn = availableSections.includes("guests");
  const mealsOn = availableSections.includes("meals");
  const shopOn = session.isMaster || session.canSeeShop;
  const tasksOn = availableSections.includes("tasks") || availableSections.includes("tasksDone");
  const calendarOn = availableSections.includes("calendar");
  const moneyOn = availableSections.includes("money");
  const peopleOn = session.isMaster || session.canSeePeople || session.canSeeTimeline;

  const [
    settings,
    weddingBlocks,
    rehearsalBlocks,
    contacts,
    assignments,
    people,
    guestRows,
    shoppingRows,
    taskRows,
    calendarRows,
    mealSettings,
    mealCourses,
    mealGuests,
    contracts,
    playbookRows,
    guestPeopleWithPhones,
    roleNames,
  ] = await Promise.all([
    loadAppSettings(),
    timeline
      ? prisma.timelineBlock.findMany({ where: { schedule: "wedding" } })
      : Promise.resolve([]),
    dinner
      ? prisma.timelineBlock.findMany({ where: { schedule: "rehearsal" } })
      : Promise.resolve([]),
    timeline
      ? prisma.contact.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] })
      : Promise.resolve([]),
    timeline
      ? prisma.dayAssignment.findMany({
          include: { assignees: { include: { person: { select: { name: true } } } } },
          orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
        })
      : Promise.resolve([]),
    peopleOn
      ? prisma.person.findMany({
          select: {
            id: true,
            name: true,
            directoryLabel: true,
            isDayOfContact: true,
            sortOrder: true,
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        })
      : Promise.resolve([]),
    guestsOn
      ? prisma.guest.findMany({
          include: guestInclude(),
          orderBy: [{ nameLine1: "asc" }, { sortOrder: "asc" }],
        })
      : Promise.resolve([]),
    mealsOn && shopOn
      ? prisma.shoppingItem.findMany({ orderBy: [{ purchased: "asc" }, { sortOrder: "asc" }, { name: "asc" }] })
      : Promise.resolve([]),
    tasksOn
      ? prisma.task.findMany({
          where: taskVisibilityWhere(session),
          include: {
            assignees: { include: { person: { select: { name: true } } } },
            parent: { select: { id: true, title: true } },
          },
          orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
        })
      : Promise.resolve([]),
    calendarOn
      ? prisma.calendarEvent.findMany({
          select: {
            id: true,
            title: true,
            notes: true,
            startDate: true,
            endDate: true,
          },
          orderBy: [{ startDate: "asc" }, { endDate: "asc" }, { title: "asc" }],
        })
      : Promise.resolve([]),
    mealsOn && dinner ? prisma.mealSettings.findUnique({ where: { id: 1 } }) : Promise.resolve(null),
    mealsOn && dinner
      ? prisma.mealCourse.findMany({
          orderBy: { sortOrder: "asc" },
          include: { options: { orderBy: { sortOrder: "asc" } } },
        })
      : Promise.resolve([]),
    mealsOn && dinner
      ? prisma.mealGuest.findMany({
          orderBy: { sortOrder: "asc" },
          include: { choices: true },
        })
      : Promise.resolve([]),
    moneyOn ? loadVisibleBudgetContracts(session) : Promise.resolve([]),
    timeline ? loadPlaybookItems() : Promise.resolve([]),
    // Wedding party and day-of phones mostly live on guest household records
    // (contact enrichment stores them there), not in Contacts, so print reads both.
    availableSections.includes("party") || timeline
      ? prisma.guestPerson.findMany({
          select: { name: true, personId: true, guest: { select: { phone: true } } },
          orderBy: { sortOrder: "asc" },
        })
      : Promise.resolve([]),
    timeline ? loadTimelineRoleNames() : Promise.resolve({}),
  ]);

  const timezone = settings?.timezone || "America/Detroit";
  const coupleNames = settings?.coupleNames?.trim() || "David & Haley";
  const weddingDateLabel = settings?.weddingDate
    ? formatPrintWeddingDate(settings.weddingDate, timezone)
    : "Friday, October 16, 2026";

  const weddingSorted = sortTimelineBlocks(weddingBlocks);
  // A Thursday moment on his page twice (his older short row beside the document's full one) prints once.
  const rehearsalSorted = sortTimelineBlocks(rehearsalRowsToPrint(rehearsalBlocks));
  const dayOfInputs = collectDayOfContactInputs({
    contacts: contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      directoryLabel: contact.directoryLabel,
      phone: contact.phone,
      email: contact.email,
      sortOrder: contact.sortOrder,
      isDayOfContact: contact.isDayOfContact,
      personId: contact.personId,
    })),
    persons: people.map((person) => ({
      id: person.id,
      name: person.name,
      directoryLabel: person.directoryLabel,
      isDayOfContact: person.isDayOfContact,
      sortOrder: person.sortOrder,
    })),
    guestPhoneByPersonId: guestPhoneByPersonId(guestPeopleWithPhones),
  });
  const grouped = groupPrintContacts(contacts);
  const dayOfGrouped = groupPrintContacts(
    dayOfInputs.map((contact) => ({
      name: contact.name,
      directoryLabel: contact.directoryLabel,
      directoryList: null,
      phone: contact.phone,
      email: contact.email,
      isDayOfContact: true,
      sortOrder: contact.sortOrder,
    })),
  );
  const setup = setupTeardownFromCanonical({ contacts, blocks: weddingSorted });
  const mappedGuests = guestRows.map((guest) => mapGuestRecord(guest));
  const guestProjection = projectHouseholds(mappedGuests);
  const mealChoiceCount = mealGuests.reduce((sum, guest) => sum + guest.choices.length, 0);
  const hairItems = playbookByKind(playbookRows, "hair_makeup");
  const shotItems = playbookByKind(playbookRows, "shot");
  const decorItems = playbookByKind(playbookRows, "decor");
  const coordinatorItems = playbookByKind(playbookRows, "coordinator");
  const lineupItems = playbookByKind(playbookRows, "lineup");
  const hairProjected = projectHairMakeup(hairItems);
  const shotProjected = projectShotGroups(shotItems);
  const taskViews = taskRows.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    parentId: task.parentId,
    parentTitle: task.parent?.title ?? null,
    dueLabel: task.dueDate
      ? task.dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : null,
    dueDay: task.dueDate
      ? task.dueDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
      : null,
    dueAt: task.dueDate ? task.dueDate.getTime() : null,
    assignees: task.assignees.map((row) => row.person.name).filter(Boolean),
  }));
  const setupPlan = projectSetupPlan({
    contacts: contacts.filter(isSetupTeardownContact),
    decor: decorItems,
    tasks: taskViews,
  });
  const mcShow = buildMcRunOfShow(weddingSorted, people);
  const roles = mcRoleSplit(people);
  const coordinatorRows = projectCoordinatorRows(coordinatorItems);
  const decorGroups = projectDecorGroups(decorItems);

  return {
    coupleNames,
    weddingDateLabel,
    timezone,
    mcNames: mcPeopleFromDirectory(people),
    quickReference: buildQuickReference({
      coupleNames,
      weddingDateLabel,
      weddingBlocks: weddingSorted,
      rehearsalBlocks: rehearsalSorted,
      contacts,
      mistressOfCeremonies: roles.mistressOfCeremonies,
      mcName: roles.mcName,
      coordinatorPhoneHint: coordinatorPhoneFromPlaybook(coordinatorItems.map((row) => row.notes)),
      rsvp: guestProjection.summary.attending + guestProjection.summary.declined + guestProjection.summary.awaiting
        ? guestProjection.summary
        : null,
    }),
    moments: {
      rehearsal: rehearsalSorted.map((block) => reviewMoment(block, roleNames)),
      wedding: weddingSorted.map((block) => reviewMoment(block, roleNames)),
    },
    brideMoments: weddingSorted.map((block) => reviewMoment(withoutBrideSecrets(block), roleNames)),
    mcCues: mcShow.cues.map((cue) => ({
      ...cue,
      operatorNotes: professionalizePrintLines(cue.operatorNotes),
    })),
    vendorContacts: grouped.vendors,
    // A vendor flagged day-of (Wendy as Mistress of Ceremonies) prints once, under vendors.
    dayOfContacts: dayOfGrouped.dayOf.filter(
      (row) => !grouped.vendors.some((vendor) => vendor.name.trim().toLowerCase() === row.name.trim().toLowerCase()),
    ),
    otherContacts: [],
    assignments: assignments.map((row) => ({
      title: row.title,
      notes: professionalizeAssignmentNotes(row.notes),
      assignees: row.assignees.map((assignee) => assignee.person.name).filter(Boolean),
    })),
    setupContacts: setupPlan.contacts.length ? setupPlan.contacts : setup.contacts,
    setupMoments: setup.moments.map((row) => ({
      ...row,
      notes: professionalizePrintLines(row.notes),
    })),
    setupConfirmed: setupPlan.confirmed,
    setupOpen: setupPlan.open,
    setupDecor: decorGroups.flatMap((group) =>
      group.items.map((item) => ({
        timeLabel: null,
        title: item.title,
        location: item.location,
        notes: item.notes,
        section: group.section,
      })),
    ),
    coordinatorScope: coordinatorRows,
    hairMakeup: hairItems.map(toPrintPlaybookRow),
    hairRooms: hairProjected.rooms,
    hairSchedule: hairProjected.rows,
    shots: shotItems.map(toPrintPlaybookRow),
    shotGroups: shotProjected,
    households: guestProjection.households,
    rsvpSummary: guestProjection.summary.attending + guestProjection.summary.declined + guestProjection.summary.awaiting
      ? guestProjection.summary
      : null,
    // David, 2026-10-10: the Airbnb sleeping arrangements are not being done; the bed lists no longer print.
    stay: [],
    mealsPublished: Boolean(mealSettings?.published),
    mealChoiceCount,
    meals: projectMealSections(
      mealGuests.map((guest) => ({
        name: guest.name,
        sectionId: guest.sectionId,
        choices: Object.fromEntries(guest.choices.map((choice) => [choice.courseId, choice.optionId])),
      })),
      mealCourses.map((course) => ({
        id: course.id,
        label: course.label,
        options: course.options.map((option) => ({ id: option.id, label: option.label })),
      })),
    ),
    shopping: shoppingRows.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      note: item.note ? professionalizePrintLines([item.note])[0] ?? null : null,
      purchased: item.purchased,
    })),
    tasks: taskViews.map((task) => ({
      title: task.parentTitle ? `${task.parentTitle} · ${task.title}` : task.title,
      status: task.status,
      dueLabel: task.dueLabel,
      assignees: task.assignees,
    })),
    // Open lines on the Wedding Day page are open work too (David, 2026-10-10).
    taskGroups: [
      ...projectTaskGroups(taskViews),
      ...(tasksOn
        ? projectTimelineOpenItems({
            rehearsal: rehearsalSorted,
            wedding: weddingSorted,
            rehearsalDay: settings?.weddingDate ? printDay(settings.weddingDate, timezone, -1) : null,
            weddingDay: settings?.weddingDate ? printDay(settings.weddingDate, timezone, 0) : null,
          })
        : []),
    ],
    doneTaskGroups: projectTaskGroups(taskViews, "done"),
    calendar: projectKeyDates(calendarRows, timezone, settings?.weddingDate ?? null, rehearsalSorted.length > 0),
    money: moneyFingerprint(contracts),
    weddingParty: projectWeddingParty({
      lineup: lineupItems,
      decor: decorItems,
      weddingBlocks: weddingSorted,
      contacts: mergePartyPhoneSources(
        contacts,
        guestPeopleWithPhones.map((row) => ({ name: row.name, phone: row.guest.phone })),
      ),
    }),
    availableSections,
  };
}
