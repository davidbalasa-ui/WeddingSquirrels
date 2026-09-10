import { prisma } from "@/lib/db";
import { canSeeDinnerTab } from "@/lib/access";
import { sortTimelineBlocks } from "@/lib/day-of-time";
import { guestInclude, mapGuestRecord } from "@/lib/guests";
import { loadVisibleBudgetContracts } from "@/lib/money-page";
import { playbookByKind } from "@/lib/playbook";
import { loadPlaybookItems } from "@/lib/playbook-data";
import { taskVisibilityWhere } from "@/lib/tasks";
import type { SessionAccount } from "@/lib/types";
import {
  extractMcCues,
  formatPrintWeddingDate,
  groupPrintContacts,
  householdsFromGuests,
  mealSectionsFromGuests,
  moneyFingerprint,
  setupTeardownFromCanonical,
  staySectionsFromSlots,
  toPrintTimelineRow,
  toPrintPlaybookRow,
  mcPeopleFromDirectory,
  type PrintCenterDocument,
  type PrintSectionId,
  PRINT_SECTION_IDS,
} from "@/lib/print-center";

function availableForSession(session: SessionAccount): PrintSectionId[] {
  const dinner = session.isMaster || canSeeDinnerTab(session);
  const can = (need: boolean) => session.isMaster || need;
  return PRINT_SECTION_IDS.filter((id) => {
    switch (id) {
      case "overview":
        return true;
      case "rehearsal":
      case "meals":
        return dinner;
      case "timeline":
      case "mc":
      case "hair":
      case "shots":
      case "contacts":
      case "assignments":
      case "setup":
        return can(session.canSeeTimeline);
      case "guests":
        return can(session.canSeeGuests);
      case "stay":
        return can(session.canSeeStay);
      case "shopping":
        return can(session.canSeeShop);
      case "tasks":
        return can(session.canSeeTasks);
      case "calendar":
        return can(session.canSeeCalendar);
      case "money":
        return can(session.canSeeBudget);
    }
  });
}

export async function loadPrintCenterDocument(
  session: SessionAccount,
): Promise<PrintCenterDocument> {
  const availableSections = availableForSession(session);
  const dinner = availableSections.includes("rehearsal");
  const timeline = availableSections.includes("timeline");
  const guestsOn = availableSections.includes("guests");
  const stayOn = availableSections.includes("stay");
  const shopOn = availableSections.includes("shopping");
  const tasksOn = availableSections.includes("tasks");
  const calendarOn = availableSections.includes("calendar");
  const moneyOn = availableSections.includes("money");
  const mealsOn = availableSections.includes("meals");
  const peopleOn = session.isMaster || session.canSeePeople || session.canSeeTimeline;

  const [
    settings,
    weddingBlocks,
    rehearsalBlocks,
    contacts,
    assignments,
    people,
    guestRows,
    staySlots,
    stayNotes,
    shoppingRows,
    taskRows,
    calendarRows,
    mealSettings,
    mealCourses,
    mealGuests,
    contracts,
    playbookRows,
  ] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: 1 } }),
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
          select: { name: true, directoryLabel: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        })
      : Promise.resolve([]),
    guestsOn
      ? prisma.guest.findMany({
          include: guestInclude(),
          orderBy: [{ nameLine1: "asc" }, { sortOrder: "asc" }],
        })
      : Promise.resolve([]),
    stayOn ? prisma.staySlot.findMany({ orderBy: { sortOrder: "asc" } }) : Promise.resolve([]),
    stayOn ? prisma.stayBathNote.findMany({ orderBy: { sortOrder: "asc" } }) : Promise.resolve([]),
    shopOn
      ? prisma.shoppingItem.findMany({ orderBy: [{ purchased: "asc" }, { sortOrder: "asc" }, { name: "asc" }] })
      : Promise.resolve([]),
    tasksOn
      ? prisma.task.findMany({
          where: taskVisibilityWhere(session),
          include: {
            assignees: { include: { person: { select: { name: true } } } },
            parent: { select: { title: true } },
          },
          orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
        })
      : Promise.resolve([]),
    calendarOn
      ? prisma.calendarEvent.findMany({
          orderBy: [{ startDate: "asc" }, { endDate: "asc" }, { title: "asc" }],
        })
      : Promise.resolve([]),
    mealsOn ? prisma.mealSettings.findUnique({ where: { id: 1 } }) : Promise.resolve(null),
    mealsOn
      ? prisma.mealCourse.findMany({
          orderBy: { sortOrder: "asc" },
          include: { options: { orderBy: { sortOrder: "asc" } } },
        })
      : Promise.resolve([]),
    mealsOn
      ? prisma.mealGuest.findMany({
          orderBy: { sortOrder: "asc" },
          include: { choices: true },
        })
      : Promise.resolve([]),
    moneyOn ? loadVisibleBudgetContracts(session) : Promise.resolve([]),
    timeline ? loadPlaybookItems() : Promise.resolve([]),
  ]);

  const timezone = settings?.timezone || "America/Detroit";
  const coupleNames = settings?.coupleNames?.trim() || "David & Haley";
  const weddingDateLabel = settings?.weddingDate
    ? formatPrintWeddingDate(settings.weddingDate, timezone)
    : "";

  const weddingSorted = sortTimelineBlocks(weddingBlocks);
  const rehearsalSorted = sortTimelineBlocks(rehearsalBlocks);
  const grouped = groupPrintContacts(contacts);
  const setup = setupTeardownFromCanonical({ contacts, blocks: weddingSorted });
  const mealChoiceCount = mealGuests.reduce((sum, guest) => sum + guest.choices.length, 0);

  return {
    coupleNames,
    weddingDateLabel,
    timezone,
    mcNames: mcPeopleFromDirectory(people),
    rehearsal: rehearsalSorted.map(toPrintTimelineRow),
    timeline: weddingSorted.map(toPrintTimelineRow),
    mcCues: extractMcCues(weddingSorted),
    vendorContacts: grouped.vendors,
    dayOfContacts: grouped.dayOf,
    otherContacts: grouped.other,
    assignments: assignments.map((row) => ({
      title: row.title,
      notes: row.notes,
      assignees: row.assignees.map((assignee) => assignee.person.name).filter(Boolean),
    })),
    setupContacts: setup.contacts,
    setupMoments: setup.moments,
    setupDecor: playbookByKind(playbookRows, "decor").map(toPrintPlaybookRow),
    coordinatorScope: playbookByKind(playbookRows, "coordinator").map(toPrintPlaybookRow),
    hairMakeup: playbookByKind(playbookRows, "hair_makeup").map(toPrintPlaybookRow),
    shots: playbookByKind(playbookRows, "shot").map(toPrintPlaybookRow),
    households: householdsFromGuests(guestRows.map((guest) => mapGuestRecord(guest))),
    stay: staySectionsFromSlots(staySlots, stayNotes),
    mealsPublished: Boolean(mealSettings?.published),
    mealChoiceCount,
    meals: mealSectionsFromGuests(
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
      note: item.note,
      purchased: item.purchased,
    })),
    tasks: taskRows.map((task) => ({
      title: task.parent?.title ? `${task.parent.title} · ${task.title}` : task.title,
      status: task.status,
      dueLabel: task.dueDate
        ? task.dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : null,
      assignees: task.assignees.map((row) => row.person.name).filter(Boolean),
    })),
    calendar: calendarRows.map((event) => {
      const start = event.startDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: timezone,
      });
      const end = event.endDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: timezone,
      });
      return {
        title: event.title,
        when: start === end ? start : `${start} – ${end}`,
        notes: event.notes,
      };
    }),
    money: moneyFingerprint(contracts),
    availableSections,
  };
}
