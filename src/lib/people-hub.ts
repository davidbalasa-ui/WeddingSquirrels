import { prisma } from "@/lib/db";
import { guestAddressLine, rsvpStatusLabel, summarizeGuestRsvp, type GuestRsvpReport } from "@/lib/guest-gifts";
import { guestInclude, mapGuestRecord, type GuestRecord } from "@/lib/guests";
import {
  buildDirectoryEntries,
  filterEntriesByTab,
  type DirectoryEntry,
  type PeopleTab,
} from "@/lib/people-directory";
import type { SessionAccount } from "@/lib/types";

export type PeopleHubData = {
  entries: DirectoryEntry[];
  vendorEntries: DirectoryEntry[];
  dayOfEntries: DirectoryEntry[];
  guests: GuestRecord[];
  guestReport: GuestRsvpReport;
  tabCounts: Record<PeopleTab, number>;
};

function householdLabel(guest: ReturnType<typeof mapGuestRecord>) {
  const people = guest.people.map((person) => person.name).join(" & ");
  const city = guest.city?.trim();
  if (people && city) return `${people} · ${city}`;
  return people || city || "Guest household";
}

export async function loadPeopleHubData(session: SessionAccount): Promise<PeopleHubData> {
  const [persons, contacts, guests] = await Promise.all([
    prisma.person.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        directoryLabel: true,
        directoryList: true,
        isDayOfContact: true,
      },
    }),
    session.canSeeTimeline
      ? prisma.contact.findMany({
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            directoryLabel: true,
            directoryList: true,
            isDayOfContact: true,
            phone: true,
            email: true,
            photoData: true,
          },
        })
      : Promise.resolve([]),
    session.canSeeGuests
      ? prisma.guest.findMany({ orderBy: { sortOrder: "asc" }, include: guestInclude() })
      : Promise.resolve([]),
  ]);

  const guestRecords = guests.map((guest) => mapGuestRecord(guest));
  const guestPeople = guests.flatMap((guest) => {
    const mapped = mapGuestRecord(guest);
    const address = guestAddressLine(mapped) || null;
    const rsvpLabel = rsvpStatusLabel(mapped.rsvpStatus);
    return mapped.people.map((person) => ({
      id: person.id,
      name: person.name,
      householdLabel: householdLabel(mapped),
      directoryLabel: person.directoryLabel ?? null,
      isDayOfContact: person.isDayOfContact,
      address,
      rsvpLabel,
      tableLabel:
        person.tableNumber != null
          ? person.tableSpot?.trim()
            ? `Table ${person.tableNumber} · ${person.tableSpot.trim()}`
            : `Table ${person.tableNumber}`
          : null,
    }));
  });

  const entries = buildDirectoryEntries({
    persons,
    contacts,
    guestPeople,
  });

  const guestReport = summarizeGuestRsvp(
    guests.map((guest) => {
      const mapped = mapGuestRecord(guest);
      return {
        nameLine1: mapped.people[0]?.name ?? guest.nameLine1,
        nameLine2: mapped.people[1]?.name ?? guest.nameLine2,
        people: mapped.people,
        rsvpStatus: mapped.rsvpStatus,
        invitedCount: mapped.invitedCount,
        acceptedCount: mapped.acceptedCount,
      };
    }),
  );

  const vendorEntries = filterEntriesByTab(entries, "vendors");
  const dayOfEntries = filterEntriesByTab(entries, "day-of");

  return {
    entries,
    vendorEntries,
    dayOfEntries,
    guests: guestRecords,
    guestReport,
    tabCounts: {
      guests: guestRecords.length,
      vendors: vendorEntries.length,
      "day-of": dayOfEntries.length,
    },
  };
}
