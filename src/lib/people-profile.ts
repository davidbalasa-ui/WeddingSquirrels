import { prisma } from "@/lib/db";
import { timelineEditable } from "@/lib/access";
import { guestInclude, mapGuestRecord } from "@/lib/guests";
import { MEAL_SECTIONS } from "@/lib/meals";
import {
  classifyNameGroup,
  mealGuestsByGroup,
  namesMatch,
  normalizePersonName,
  parseProfileId,
  profileIdForContact,
  profileIdForGuestPerson,
  profileIdForPerson,
  resolveIsDayOfContact,
  resolvePrimaryList,
  vendorSubtitle,
  type PeoplePrimaryList,
} from "@/lib/people-directory";
import {
  budgetContractsForContact,
  budgetContractsForPerson,
  buildProfileRelatedLinks,
  type ProfileBudgetContract,
  type ProfileRelatedLink,
} from "@/lib/connections";
import { dueLabel, listTasks } from "@/lib/tasks";
import type { SessionAccount } from "@/lib/types";
import { STAY_SECTIONS } from "@/lib/stay";

export type ProfileTaskRow = {
  id: string;
  title: string;
  dueLabel: string | null;
  href: string;
};

export type ProfileAssignmentRow = {
  title: string;
  notes: string | null;
};

export type PeopleProfile = {
  profileId: string;
  name: string;
  subtitle: string | null;
  photoSrc: string | null;
  phone: string | null;
  email: string | null;
  roles: string[];
  directoryLabel: string | null;
  primaryList: PeoplePrimaryList;
  isDayOfContact: boolean;
  canEditLabel: boolean;
  canEditPrimaryList: boolean;
  canEditDayOf: boolean;
  canDelete: boolean;
  openTasks: ProfileTaskRow[];
  assignments: ProfileAssignmentRow[];
  guestInfo: {
    household: string;
    rsvpStatus: string;
    table: string | null;
  } | null;
  stayLabel: string | null;
  mealStatus: string | null;
  budgetContracts: ProfileBudgetContract[];
  relatedLinks: ProfileRelatedLink[];
};

function mealSectionTitle(sectionId: string): string | null {
  return MEAL_SECTIONS.find((section) => section.id === sectionId)?.title ?? null;
}

function stayLabelForName(name: string, slots: { sectionId: string; label: string; occupant: string }[]) {
  for (const slot of slots) {
    if (!slot.occupant.trim()) continue;
    if (!namesMatch(slot.occupant, name)) continue;
    const section = STAY_SECTIONS.find((row) => row.id === slot.sectionId);
    if (!section) return slot.label;
    return `${section.title} · ${slot.label}`;
  }
  return null;
}

function personRoles(person: { id: string; name: string }, assignmentCount: number): string[] {
  if (["david", "haley"].includes(person.id)) return ["Couple"];
  const { party, family } = mealGuestsByGroup();
  const group = classifyNameGroup(
    person.name,
    party.map((guest) => guest.name),
    family.map((guest) => guest.name),
  );
  if (group === "party") return ["Wedding party"];
  if (assignmentCount > 0) return ["Day-of helper"];
  return ["Family & helpers"];
}

function guestHouseholdLabel(guest: {
  nameLine1: string;
  nameLine2: string | null;
  street: string | null;
  city: string | null;
}) {
  const people = [guest.nameLine1, guest.nameLine2].filter(Boolean).join(" & ");
  const city = guest.city?.trim();
  if (people && city) return `${people} · ${city}`;
  return people || city || "Guest household";
}

function tableLabel(tableNumber: number | null, tableSpot: string | null) {
  if (tableNumber == null) return null;
  const spot = tableSpot?.trim();
  return spot ? `Table ${tableNumber} · ${spot}` : `Table ${tableNumber}`;
}

export async function loadPeopleProfile(
  session: SessionAccount,
  profileId: string,
): Promise<PeopleProfile | null> {
  const parsed = parseProfileId(profileId);
  if (!parsed) return null;

  const [staySlots, mealGuests, guests, assignments, budgetItems, contacts] = await Promise.all([
    session.canSeeStay
      ? prisma.staySlot.findMany({ select: { sectionId: true, label: true, occupant: true } })
      : Promise.resolve([]),
    session.canSeeDinner
      ? prisma.mealGuest.findMany({
          include: {
            choices: { include: { option: { select: { label: true } } } },
          },
        })
      : Promise.resolve([]),
    session.canSeeGuests
      ? prisma.guest.findMany({ orderBy: { sortOrder: "asc" }, include: guestInclude() })
      : Promise.resolve([]),
    session.canSeeTimeline
      ? prisma.dayAssignment.findMany({
          include: { assignees: { include: { person: { select: { id: true, name: true } } } } },
          orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
        })
      : Promise.resolve([]),
    session.canSeeBudget
      ? prisma.budgetItem.findMany({
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            price: true,
            amountPaid: true,
            ownerId: true,
            paidById: true,
          },
        })
      : Promise.resolve([]),
    session.canSeeTimeline
      ? prisma.contact.findMany({ select: { id: true, name: true }, orderBy: { sortOrder: "asc" } })
      : Promise.resolve([]),
  ]);

  const guestRecords = guests.map((guest) => mapGuestRecord(guest));
  const editable = timelineEditable(session);

  if (parsed.kind === "contact") {
    const contact = await prisma.contact.findUnique({ where: { id: parsed.id } });
    if (!contact) return null;
    const budgetContracts = budgetContractsForContact(contact, budgetItems);
    const directoryLabel = contact.directoryLabel?.trim() || null;
    const primaryList = resolvePrimaryList({ kind: "contact", directoryList: contact.directoryList });
    const isDayOfContact = resolveIsDayOfContact({
      isDayOfContact: contact.isDayOfContact,
      name: contact.name,
      kind: "contact",
      directoryList: contact.directoryList,
    });
    const roles = directoryLabel ? [directoryLabel] : primaryList === "vendors" ? ["Vendor"] : ["Guest"];
    return {
      profileId: profileIdForContact(contact.id),
      name: contact.name,
      subtitle: directoryLabel || vendorSubtitle(contact.name),
      photoSrc: contact.photoData,
      phone: contact.phone,
      email: contact.email,
      roles,
      directoryLabel,
      primaryList,
      isDayOfContact,
      canEditLabel: editable,
      canEditPrimaryList: editable,
      canEditDayOf: editable,
      canDelete: editable,
      openTasks: [],
      assignments: [],
      guestInfo: null,
      stayLabel: null,
      mealStatus: null,
      budgetContracts,
      relatedLinks: buildProfileRelatedLinks({ budgetContracts }),
    };
  }

  if (parsed.kind === "person") {
    const person = await prisma.person.findUnique({ where: { id: parsed.id } });
    if (!person) return null;

    const openTasks = session.canSeeTasks
      ? (await listTasks(session, { personId: person.id })).slice(0, 8).map((task) => ({
          id: task.id,
          title: task.title,
          dueLabel: dueLabel(task.dueDate, task.status),
          href: `/work/${task.id}`,
        }))
      : [];

    const personAssignments = assignments
      .filter((assignment) =>
        assignment.assignees.some((row) => row.personId === person.id),
      )
      .map((assignment) => ({
        title: assignment.title,
        notes: assignment.notes,
      }));

    const guestPerson = guestRecords
      .flatMap((guest) =>
        guest.people.map((row) => ({
          guest,
          person: row,
        })),
      )
      .find((row) => namesMatch(row.person.name, person.name));

    const mealGuest = mealGuests.find((row) => namesMatch(row.name, person.name));
    const mealStatus = mealGuest
      ? mealSectionTitle(mealGuest.sectionId) ?? "Rehearsal dinner"
      : null;
    const budgetContracts = budgetContractsForPerson(person, budgetItems);
    const directoryLabel = person.directoryLabel?.trim() || null;
    const defaultRoles = personRoles(person, personAssignments.length);
    const roles = directoryLabel ? [directoryLabel] : defaultRoles;
    const primaryList = resolvePrimaryList({ kind: "person", directoryList: person.directoryList });
    const isDayOfContact = resolveIsDayOfContact({
      isDayOfContact: person.isDayOfContact,
      name: person.name,
      kind: "person",
      directoryList: person.directoryList,
    });
    const guestInfo = guestPerson
      ? {
          household: guestHouseholdLabel({
            nameLine1: guestPerson.guest.people[0]?.name ?? person.name,
            nameLine2: guestPerson.guest.people[1]?.name ?? null,
            street: guestPerson.guest.street,
            city: guestPerson.guest.city,
          }),
          rsvpStatus: guestPerson.guest.rsvpStatus,
          table: tableLabel(guestPerson.person.tableNumber, guestPerson.person.tableSpot),
        }
      : null;
    const stayLabel = stayLabelForName(person.name, staySlots);

    return {
      profileId: profileIdForPerson(person.id),
      name: person.name,
      subtitle: guestPerson ? guestPerson.guest.city : mealStatus,
      photoSrc: null,
      phone: null,
      email: null,
      roles,
      directoryLabel,
      primaryList,
      isDayOfContact,
      canEditLabel: editable,
      canEditPrimaryList: editable,
      canEditDayOf: editable,
      canDelete: editable && !["david", "haley"].includes(person.id),
      openTasks,
      assignments: personAssignments,
      guestInfo,
      stayLabel,
      mealStatus,
      budgetContracts,
      relatedLinks: buildProfileRelatedLinks({
        guestInfo: Boolean(guestInfo),
        stayLabel,
        mealStatus,
        assignments: personAssignments.length,
        budgetContracts,
      }),
    };
  }

  const guestPerson = guestRecords
    .flatMap((guest) => guest.people.map((person) => ({ guest, person })))
    .find((row) => row.person.id === parsed.id);
  if (!guestPerson) return null;

  const mealGuest = mealGuests.find((row) => namesMatch(row.name, guestPerson.person.name));
  const mealStatus = mealGuest
    ? mealSectionTitle(mealGuest.sectionId) ?? "Rehearsal dinner"
    : null;

  const stayLabel = stayLabelForName(guestPerson.person.name, staySlots);
  const guestDirectoryLabel = guestPerson.person.directoryLabel?.trim() || null;
  const { party, family } = mealGuestsByGroup();
  const group = classifyNameGroup(
    guestPerson.person.name,
    party.map((guest) => guest.name),
    family.map((guest) => guest.name),
  );
  const defaultRole = group === "party" ? "Wedding party" : "Guest";
  const roles = guestDirectoryLabel ? [guestDirectoryLabel] : [defaultRole];
  const isDayOfContact = resolveIsDayOfContact({
    isDayOfContact: guestPerson.person.isDayOfContact,
    name: guestPerson.person.name,
    kind: "guest",
  });

  return {
    profileId: profileIdForGuestPerson(guestPerson.person.id),
    name: guestPerson.person.name,
    subtitle: guestHouseholdLabel({
      nameLine1: guestPerson.guest.people[0]?.name ?? guestPerson.person.name,
      nameLine2: guestPerson.guest.people[1]?.name ?? null,
      street: guestPerson.guest.street,
      city: guestPerson.guest.city,
    }),
    photoSrc: null,
    phone: null,
    email: null,
    roles,
    directoryLabel: guestDirectoryLabel,
    primaryList: "guests",
    isDayOfContact,
    canEditLabel: editable,
    canEditPrimaryList: false,
    canEditDayOf: editable,
    canDelete: editable,
    openTasks: [],
    assignments: [],
    guestInfo: {
      household: guestHouseholdLabel({
        nameLine1: guestPerson.guest.people[0]?.name ?? guestPerson.person.name,
        nameLine2: guestPerson.guest.people[1]?.name ?? null,
        street: guestPerson.guest.street,
        city: guestPerson.guest.city,
      }),
      rsvpStatus: guestPerson.guest.rsvpStatus,
      table: tableLabel(guestPerson.person.tableNumber, guestPerson.person.tableSpot),
    },
    stayLabel,
    mealStatus,
    budgetContracts: [],
    relatedLinks: buildProfileRelatedLinks({
      guestInfo: true,
      stayLabel,
      mealStatus,
    }),
  };
}

export function profileSearchKeys(profile: PeopleProfile): string {
  return normalizePersonName(
    [profile.name, profile.subtitle, profile.roles.join(" "), profile.guestInfo?.household]
      .filter(Boolean)
      .join(" "),
  );
}
