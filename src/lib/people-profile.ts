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
  rowsLinkedToPerson,
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

/** Exact full-name stay match for canonical Person profiles. Does not use namesMatch. */
export function stayLabelForExactName(
  name: string,
  slots: { sectionId: string; label: string; occupant: string }[],
) {
  const key = normalizePersonName(name);
  if (!key) return null;
  for (const slot of slots) {
    if (normalizePersonName(slot.occupant) !== key) continue;
    const section = STAY_SECTIONS.find((row) => row.id === slot.sectionId);
    if (!section) return slot.label;
    return `${section.title} · ${slot.label}`;
  }
  return null;
}

export function linkedIdentityForPerson<
  TGuest extends { personId?: string | null },
  TContact extends { personId?: string | null },
  TMeal extends { personId?: string | null },
>(
  personId: string,
  rows: { guestPeople: TGuest[]; contacts: TContact[]; mealGuests: TMeal[] },
) {
  return {
    guestPeople: rowsLinkedToPerson(rows.guestPeople, personId),
    contacts: rowsLinkedToPerson(rows.contacts, personId),
    mealGuests: rowsLinkedToPerson(rows.mealGuests, personId),
  };
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
    session.canSeeTimeline || session.canSeeGuests
      ? prisma.contact.findMany({
          select: {
            id: true,
            name: true,
            directoryLabel: true,
            directoryList: true,
            isDayOfContact: true,
            phone: true,
            email: true,
            photoData: true,
            personId: true,
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  const guestRecords = guests.map((guest) => mapGuestRecord(guest));
  const editable = timelineEditable(session);
  const guestPeople = guestRecords.flatMap((guest) =>
    guest.people.map((person) => ({ guest, person })),
  );

  async function profileForPerson(person: {
    id: string;
    name: string;
    directoryLabel: string | null;
    directoryList: string | null;
    isDayOfContact: boolean;
  }): Promise<PeopleProfile> {
    const linked = linkedIdentityForPerson(person.id, {
      guestPeople: guestPeople.map((row) => ({ ...row, personId: row.person.personId })),
      contacts,
      mealGuests,
    });
    const linkedGuest = linked.guestPeople[0];
    const linkedContact = linked.contacts[0];
    const linkedMeal = linked.mealGuests[0];

    const openTasks = session.canSeeTasks
      ? (await listTasks(session, { personId: person.id })).slice(0, 8).map((task) => ({
          id: task.id,
          title: task.title,
          dueLabel: dueLabel(task.dueDate, task.status),
          href: `/work/${task.id}`,
        }))
      : [];

    const personAssignments = assignments
      .filter((assignment) => assignment.assignees.some((row) => row.personId === person.id))
      .map((assignment) => ({
        title: assignment.title,
        notes: assignment.notes,
      }));

    const mealStatus = linkedMeal
      ? mealSectionTitle(linkedMeal.sectionId) ?? "Rehearsal dinner"
      : null;
    const personBudget = budgetContractsForPerson(person, budgetItems);
    const contactBudget = linkedContact ? budgetContractsForContact(linkedContact, budgetItems) : [];
    const budgetById = new Map(personBudget.concat(contactBudget).map((row) => [row.id, row]));
    const budgetContracts = [...budgetById.values()];
    const directoryLabel =
      person.directoryLabel?.trim() || linkedContact?.directoryLabel?.trim() || linkedGuest?.person.directoryLabel?.trim() || null;
    const defaultRoles = personRoles(person, personAssignments.length);
    const roles = [
      ...new Set(
        [
          directoryLabel,
          linkedGuest ? "Guest" : null,
          linkedContact ? "Vendor" : null,
          ...(directoryLabel ? [] : defaultRoles),
        ].filter((role): role is string => Boolean(role)),
      ),
    ];
    const personList = resolvePrimaryList({ kind: "person", directoryList: person.directoryList });
    const primaryList: PeoplePrimaryList =
      personList ??
      (linkedGuest && !linkedContact ? "guests" : linkedContact ? "vendors" : "vendors");
    const isDayOfContact =
      resolveIsDayOfContact({
        isDayOfContact: person.isDayOfContact,
        directoryList: person.directoryList,
      }) ||
      resolveIsDayOfContact({
        isDayOfContact: linkedContact?.isDayOfContact,
        directoryList: linkedContact?.directoryList,
      }) ||
      resolveIsDayOfContact({ isDayOfContact: linkedGuest?.person.isDayOfContact });
    const guestInfo = linkedGuest
      ? {
          household: guestHouseholdLabel({
            nameLine1: linkedGuest.guest.people[0]?.name ?? person.name,
            nameLine2: linkedGuest.guest.people[1]?.name ?? null,
            street: linkedGuest.guest.street,
            city: linkedGuest.guest.city,
          }),
          rsvpStatus: linkedGuest.person.rsvpStatus,
          table: tableLabel(linkedGuest.person.tableNumber, linkedGuest.person.tableSpot),
        }
      : null;
    const stayLabel = stayLabelForExactName(person.name, staySlots);

    return {
      profileId: profileIdForPerson(person.id),
      name: person.name,
      subtitle:
        directoryLabel ||
        vendorSubtitle(linkedContact?.name ?? "") ||
        (linkedGuest ? guestHouseholdLabel({
          nameLine1: linkedGuest.guest.people[0]?.name ?? person.name,
          nameLine2: linkedGuest.guest.people[1]?.name ?? null,
          street: linkedGuest.guest.street,
          city: linkedGuest.guest.city,
        }) : mealStatus),
      photoSrc: linkedContact?.photoData?.trim() || linkedGuest?.person.photoData || null,
      phone: linkedContact?.phone ?? linkedGuest?.guest.phone ?? null,
      email: linkedContact?.email ?? null,
      roles: roles.length ? roles : defaultRoles,
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

  if (parsed.kind === "contact") {
    const contact = await prisma.contact.findUnique({ where: { id: parsed.id } });
    if (!contact) return null;
    if (contact.personId) {
      const person = await prisma.person.findUnique({ where: { id: contact.personId } });
      if (person) return profileForPerson(person);
    }
    const budgetContracts = budgetContractsForContact(contact, budgetItems);
    const directoryLabel = contact.directoryLabel?.trim() || null;
    const primaryList =
      contact.directoryList === "guests" || contact.directoryList === "vendors"
        ? contact.directoryList
        : "vendors";
    const isDayOfContact = resolveIsDayOfContact({
      isDayOfContact: contact.isDayOfContact,
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
    return profileForPerson(person);
  }

  const guestPerson = guestPeople.find((row) => row.person.id === parsed.id);
  if (!guestPerson) return null;
  if (guestPerson.person.personId) {
    const person = await prisma.person.findUnique({ where: { id: guestPerson.person.personId } });
    if (person) return profileForPerson(person);
  }

  const mealGuest = mealGuests.find(
    (row) => !row.personId && namesMatch(row.name, guestPerson.person.name),
  );
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
    photoSrc: guestPerson.person.photoData,
    phone: guestPerson.guest.phone,
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
      rsvpStatus: guestPerson.person.rsvpStatus,
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
