import { prisma } from "@/lib/db";
import { guestInclude, mapGuestRecord } from "@/lib/guests";
import { buildDirectoryEntries, type DirectoryEntry } from "@/lib/people-directory";
import type { SessionAccount } from "@/lib/types";

export type PeopleHubData = {
  entries: DirectoryEntry[];
  guestCount: number;
  contactCount: number;
  assignmentCount: number;
};

function householdLabel(guest: ReturnType<typeof mapGuestRecord>) {
  const people = guest.people.map((person) => person.name).join(" & ");
  const city = guest.city?.trim();
  if (people && city) return `${people} · ${city}`;
  return people || city || "Guest household";
}

export async function loadPeopleHubData(session: SessionAccount): Promise<PeopleHubData> {
  const [persons, contacts, guests, assignments] = await Promise.all([
    prisma.person.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, directoryLabel: true, directoryList: true },
    }),
    session.canSeeTimeline
      ? prisma.contact.findMany({
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            directoryLabel: true,
            directoryList: true,
            phone: true,
            email: true,
            photoData: true,
          },
        })
      : Promise.resolve([]),
    session.canSeeGuests
      ? prisma.guest.findMany({ orderBy: { sortOrder: "asc" }, include: guestInclude() })
      : Promise.resolve([]),
    session.canSeeTimeline
      ? prisma.dayAssignment.count()
      : Promise.resolve(0),
  ]);

  const guestPeople = guests.flatMap((guest) => {
    const mapped = mapGuestRecord(guest);
    return mapped.people.map((person) => ({
      id: person.id,
      name: person.name,
      householdLabel: householdLabel(mapped),
      directoryLabel: person.directoryLabel ?? null,
    }));
  });

  const entries = buildDirectoryEntries({
    persons,
    contacts,
    guestPeople,
  });

  return {
    entries,
    guestCount: guests.length,
    contactCount: contacts.length,
    assignmentCount: assignments,
  };
}
