import { prisma } from "@/lib/db";
import { guestInclude, mapGuestRecord } from "@/lib/guests";
import { MEAL_SECTIONS } from "@/lib/meals";
import {
  namesMatch,
  normalizePersonName,
  parseProfileId,
  profileIdForContact,
  profileIdForGuestPerson,
  profileIdForPerson,
  vendorSubtitle,
} from "@/lib/people-directory";
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
  openTasks: ProfileTaskRow[];
  assignments: ProfileAssignmentRow[];
  guestInfo: {
    household: string;
    rsvpStatus: string;
    table: string | null;
  } | null;
  stayLabel: string | null;
  mealStatus: string | null;
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

  const [staySlots, mealGuests, guests, assignments] = await Promise.all([
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
  ]);

  const guestRecords = guests.map((guest) => mapGuestRecord(guest));

  if (parsed.kind === "contact") {
    const contact = await prisma.contact.findUnique({ where: { id: parsed.id } });
    if (!contact) return null;
    return {
      profileId: profileIdForContact(contact.id),
      name: contact.name,
      subtitle: vendorSubtitle(contact.name),
      photoSrc: contact.photoData,
      phone: contact.phone,
      email: contact.email,
      roles: ["Vendor"],
      openTasks: [],
      assignments: [],
      guestInfo: null,
      stayLabel: null,
      mealStatus: null,
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

    return {
      profileId: profileIdForPerson(person.id),
      name: person.name,
      subtitle: guestPerson ? guestPerson.guest.city : mealStatus,
      photoSrc: null,
      phone: null,
      email: null,
      roles: ["david", "haley"].includes(person.id)
        ? ["Couple"]
        : personAssignments.length
          ? ["Day-of helper"]
          : ["Family & helpers"],
      openTasks,
      assignments: personAssignments,
      guestInfo: guestPerson
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
        : null,
      stayLabel: stayLabelForName(person.name, staySlots),
      mealStatus,
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
    roles: ["Guest"],
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
    stayLabel: stayLabelForName(guestPerson.person.name, staySlots),
    mealStatus,
  };
}

export function profileSearchKeys(profile: PeopleProfile): string {
  return normalizePersonName(
    [profile.name, profile.subtitle, profile.roles.join(" "), profile.guestInfo?.household]
      .filter(Boolean)
      .join(" "),
  );
}
