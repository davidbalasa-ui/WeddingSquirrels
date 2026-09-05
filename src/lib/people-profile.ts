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
  budgetContractsForPerson,
  buildProfileRelatedLinks,
  type ProfileBudgetContract,
  type ProfileRelatedLink,
} from "@/lib/connections";
import { dayAssignmentHref, taskHref } from "@/lib/entity-links";
import { giftDescriptions } from "@/lib/guest-gifts";
import { filterVisibleBudgetItems } from "@/lib/money";
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
  id: string;
  title: string;
  notes: string | null;
  href: string;
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
  primaryList: PeoplePrimaryList | null;
  isDayOfContact: boolean;
  canEditLabel: boolean;
  canEditPrimaryList: boolean;
  canEditDayOf: boolean;
  canDelete: boolean;
  canSeeTasks: boolean;
  openTasks: ProfileTaskRow[];
  completedTaskCount: number;
  assignments: ProfileAssignmentRow[];
  guestInfo: {
    household: string;
    rsvpStatus: string;
    table: string | null;
  } | null;
  gifts: string[];
  vendorContext: string | null;
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

export function classifyCanonicalPrimaryList(input: {
  directoryList?: string | null;
  hasGuestRole: boolean;
  hasContactRole: boolean;
}): PeoplePrimaryList | null {
  const explicit = resolvePrimaryList({ kind: "person", directoryList: input.directoryList });
  if (explicit) return explicit;
  if (input.hasGuestRole && !input.hasContactRole) return "guests";
  if (input.hasContactRole && !input.hasGuestRole) return "vendors";
  if (input.hasGuestRole && input.hasContactRole) return "guests";
  return null;
}

export function canonicalRoleMemberships(input: {
  directoryList?: string | null;
  hasGuestRole: boolean;
  hasContactRole: boolean;
  isDayOfContact?: boolean;
}): {
  primaryList: PeoplePrimaryList | null;
  guest: boolean;
  vendor: boolean;
  dayOf: boolean;
} {
  return {
    primaryList: classifyCanonicalPrimaryList(input),
    guest: input.hasGuestRole,
    vendor: input.hasContactRole,
    dayOf: Boolean(input.isDayOfContact),
  };
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
            shares: { select: { pinAccountId: true } },
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

    const visibleTasks = session.canSeeTasks
      ? await listTasks(session, { personId: person.id, showDone: true })
      : [];
    const openTasks = visibleTasks
      .filter((task) => task.status !== "done")
      .slice(0, 8)
      .map((task) => ({
        id: task.id,
        title: task.title,
        dueLabel: dueLabel(task.dueDate, task.status),
        href: taskHref(task.id),
      }));
    const completedTaskCount = visibleTasks.filter((task) => task.status === "done").length;

    const personAssignments = assignments
      .filter((assignment) => assignment.assignees.some((row) => row.personId === person.id))
      .map((assignment) => ({
        id: assignment.id,
        title: assignment.title,
        notes: assignment.notes,
        href: dayAssignmentHref(),
      }));

    const mealStatus = linkedMeal
      ? mealSectionTitle(linkedMeal.sectionId) ?? "Rehearsal dinner"
      : null;
    const visibleBudget = filterVisibleBudgetItems(session, budgetItems);
    const budgetContracts = budgetContractsForPerson(person, visibleBudget);
    const directoryLabel =
      person.directoryLabel?.trim() || linkedContact?.directoryLabel?.trim() || linkedGuest?.person.directoryLabel?.trim() || null;
    const roles = [
      ...new Set(
        [directoryLabel, linkedGuest ? "Guest" : null, linkedContact ? "Vendor" : null].filter(
          (role): role is string => Boolean(role),
        ),
      ),
    ];
    const primaryList = classifyCanonicalPrimaryList({
      directoryList: person.directoryList,
      hasGuestRole: Boolean(linkedGuest),
      hasContactRole: Boolean(linkedContact),
    });
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
    const gifts = linkedGuest ? giftDescriptions(linkedGuest.guest.gifts) : [];
    const vendorContext =
      linkedContact?.directoryLabel?.trim() ||
      vendorSubtitle(linkedContact?.name ?? "") ||
      null;

    return {
      profileId: profileIdForPerson(person.id),
      name: person.name,
      subtitle:
        directoryLabel ||
        vendorContext ||
        (linkedGuest ? guestHouseholdLabel({
          nameLine1: linkedGuest.guest.people[0]?.name ?? person.name,
          nameLine2: linkedGuest.guest.people[1]?.name ?? null,
          street: linkedGuest.guest.street,
          city: linkedGuest.guest.city,
        }) : mealStatus),
      photoSrc: linkedContact?.photoData?.trim() || linkedGuest?.person.photoData || null,
      phone: linkedContact?.phone ?? linkedGuest?.guest.phone ?? null,
      email: linkedContact?.email ?? null,
      roles,
      directoryLabel,
      primaryList,
      isDayOfContact,
      canEditLabel: editable,
      canEditPrimaryList: editable,
      canEditDayOf: editable,
      canDelete: editable && !["david", "haley"].includes(person.id),
      canSeeTasks: session.canSeeTasks,
      openTasks,
      completedTaskCount,
      assignments: personAssignments,
      guestInfo,
      gifts,
      vendorContext,
      stayLabel,
      mealStatus,
      budgetContracts,
      relatedLinks: buildProfileRelatedLinks({
        guestInfo: Boolean(guestInfo),
        stayLabel,
        mealStatus,
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
    const budgetContracts: ProfileBudgetContract[] = [];
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
    const vendorContext = directoryLabel || vendorSubtitle(contact.name);
    return {
      profileId: profileIdForContact(contact.id),
      name: contact.name,
      subtitle: vendorContext,
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
      canSeeTasks: false,
      openTasks: [],
      completedTaskCount: 0,
      assignments: [],
      guestInfo: null,
      gifts: [],
      vendorContext,
      stayLabel: null,
      mealStatus: null,
      budgetContracts,
      relatedLinks: buildProfileRelatedLinks({}),
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
    canSeeTasks: false,
    openTasks: [],
    completedTaskCount: 0,
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
    gifts: giftDescriptions(guestPerson.guest.gifts),
    vendorContext: null,
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
