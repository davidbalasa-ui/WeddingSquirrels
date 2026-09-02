import { prisma } from "@/lib/db";
import { guestAddressLine, rsvpStatusLabel, summarizeGuestRsvp, type GuestRsvpReport } from "@/lib/guest-gifts";
import { guestInclude, mapGuestRecord, type GuestRecord } from "@/lib/guests";
import {
  budgetContractsForContact,
  type ProfileBudgetContract,
} from "@/lib/connections";
import {
  buildDirectoryEntries,
  filterEntriesByTab,
  namesMatch,
  normalizePersonName,
  resolveIsDayOfContact,
  type DirectoryEntry,
  type PeopleTab,
} from "@/lib/people-directory";
import type { SessionAccount } from "@/lib/types";

export type VendorBudgetRecord = ProfileBudgetContract & {
  price: number;
  amountPaid: number;
  receiptData: string | null;
};

export type DayOfContactRecord = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  photoData: string | null;
};

export type PeopleHubData = {
  entries: DirectoryEntry[];
  vendorEntries: DirectoryEntry[];
  vendorBudgets: Record<string, VendorBudgetRecord[]>;
  dayOfContacts: DayOfContactRecord[];
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

function attachContactPhotos(
  guests: GuestRecord[],
  contacts: Array<{ name: string; photoData: string | null }>,
): GuestRecord[] {
  if (contacts.length === 0) return guests;
  return guests.map((guest) => ({
    ...guest,
    people: guest.people.map((person) => {
      if (person.photoData) return person;
      const contact = contacts.find(
        (row) =>
          row.photoData?.trim() &&
          normalizePersonName(row.name) === normalizePersonName(person.name),
      );
      if (!contact?.photoData) return person;
      return { ...person, photoData: contact.photoData };
    }),
  }));
}

export async function loadPeopleHubData(session: SessionAccount): Promise<PeopleHubData> {
  const [persons, contacts, guests, budgetItems] = await Promise.all([
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
    session.canSeeTimeline || session.canSeeGuests
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
            receiptData: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const guestRecords = attachContactPhotos(
    guests.map((guest) => mapGuestRecord(guest)),
    contacts,
  );
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
      photoData: person.photoData ?? null,
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
  const dayOfContacts = contacts
    .filter((contact) =>
      resolveIsDayOfContact({
        isDayOfContact: contact.isDayOfContact,
        directoryList: contact.directoryList,
      }),
    )
    .map((contact) => ({
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
      photoData: contact.photoData,
    }));

  const vendorBudgets: Record<string, VendorBudgetRecord[]> = {};
  for (const entry of vendorEntries) {
    const contactId = entry.profileId.startsWith("contact:")
      ? entry.profileId.slice("contact:".length)
      : null;
    if (!contactId) continue;
    const contact = contacts.find((row) => row.id === contactId);
    if (!contact) continue;
    const contracts = budgetContractsForContact(contact, budgetItems).map((contract) => {
      const item = budgetItems.find((row) => row.id === contract.id);
      return {
        ...contract,
        price: item?.price ?? 0,
        amountPaid: item?.amountPaid ?? 0,
        receiptData: item?.receiptData ?? null,
      };
    });
    if (contracts.length > 0) vendorBudgets[entry.profileId] = contracts;
  }

  return {
    entries,
    vendorEntries,
    vendorBudgets,
    dayOfContacts,
    guests: guestRecords,
    guestReport,
    tabCounts: {
      all:
        guestRecords.reduce((sum, guest) => sum + guest.people.length, 0) +
        vendorEntries.length +
        dayOfContacts.length,
      guests: guestRecords.reduce((sum, guest) => sum + guest.people.length, 0),
      vendors: vendorEntries.length,
      "day-of": dayOfContacts.length,
    },
  };
}
