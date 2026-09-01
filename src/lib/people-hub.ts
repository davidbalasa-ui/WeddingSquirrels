import { prisma } from "@/lib/db";
import { guestInclude, mapGuestRecord } from "@/lib/guests";
import {
  buildDirectoryEntries,
  groupDirectoryEntries,
  type DirectoryEntry,
  type PeopleGroup,
} from "@/lib/people-directory";
import type { SessionAccount } from "@/lib/types";

export type PeopleSectionPreview = {
  key: PeopleGroup;
  label: string;
  detail: string;
  href: string;
  faces: { profileId: string; name: string; photoSrc: string | null }[];
};

export type PeopleHubData = {
  sections: PeopleSectionPreview[];
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
      select: { id: true, name: true },
    }),
    session.canSeeTimeline
      ? prisma.contact.findMany({
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { id: true, name: true, phone: true, email: true, photoData: true },
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
    }));
  });

  const entries = buildDirectoryEntries({
    persons,
    contacts,
    guestPeople,
  });

  const sectionDefs: { key: PeopleGroup; label: string; href: string }[] = [
    { key: "party", label: "Wedding party", href: "/people/party" },
    { key: "family", label: "Family & guests", href: "/people/family" },
    { key: "vendor", label: "Vendors", href: "/people/vendors" },
  ];

  const sections = sectionDefs
    .map((section) => {
      const groupEntries = groupDirectoryEntries(entries, section.key);
      if (groupEntries.length === 0) return null;
      return {
        key: section.key,
        label: section.label,
        href: section.href,
        detail: `${groupEntries.length} ${groupEntries.length === 1 ? "person" : "people"}`,
        faces: groupEntries.slice(0, 4).map((entry) => ({
          profileId: entry.profileId,
          name: entry.name,
          photoSrc: entry.photoSrc,
        })),
      };
    })
    .filter((section): section is PeopleSectionPreview => section !== null);

  return {
    sections,
    entries,
    guestCount: guests.length,
    contactCount: contacts.length,
    assignmentCount: assignments,
  };
}
