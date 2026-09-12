import {
  collectDayOfContactInputs,
  formatWeddingDateLabel,
  toDayOfBlock,
  type DayOfAssignmentInput,
  type DayOfContactInput,
  type DayOfExperienceSource,
  type DayOfPersonInput,
} from "@/lib/day-of";
import { weddingTimelineRows } from "@/lib/day-of-time";
import { rsvpStatusLabel } from "@/lib/guest-gifts";
import type { OfflinePack } from "@/lib/offline-db";

type TimelineRow = {
  id: string;
  schedule?: string;
  startAt: string;
  endAt: string | null;
  notes: string;
  startMinutes?: number | null;
  endMinutes?: number | null;
  dayOffset?: number;
  sortOrder?: number;
};

export type OfflineContactRow = {
  id: string;
  name: string;
  directoryLabel?: string | null;
  phone: string | null;
  email: string | null;
  photoData: string | null;
  sortOrder?: number;
  isDayOfContact?: boolean;
  personId?: string | null;
};

export type OfflinePersonRow = {
  id: string;
  name: string;
  directoryLabel?: string | null;
  isDayOfContact?: boolean;
  sortOrder?: number;
};

export type OfflineAssignmentRow = {
  id: string;
  title: string;
  notes: string | null;
  sortOrder?: number;
  assignees?: Array<{ personId: string; person?: { id: string; name: string } }>;
};

export type OfflineGuestRow = {
  id: string;
  nameLine1: string;
  nameLine2: string | null;
  rsvpStatus: string;
  invitedCount: number;
  acceptedCount: number;
  people?: Array<{ id: string; name: string; personId?: string | null; rsvpStatus?: string }>;
  gifts: { id: string; description: string; thanked: boolean }[];
};

export type OfflineGuestPersonRsvpRow = {
  name: string;
  rsvpLabel: string;
};

export type OfflineDirectoryContact = {
  id: string;
  name: string;
  subtitle: string | null;
  phone: string | null;
  email: string | null;
  photoData: string | null;
};

function asContacts(pack: OfflinePack): OfflineContactRow[] {
  return (pack.contacts ?? []) as OfflineContactRow[];
}

function asPeople(pack: OfflinePack): OfflinePersonRow[] {
  return (pack.people ?? []) as OfflinePersonRow[];
}

function asAssignments(pack: OfflinePack): OfflineAssignmentRow[] {
  return (pack.assignments ?? []) as OfflineAssignmentRow[];
}

function asGuests(pack: OfflinePack): OfflineGuestRow[] {
  return (pack.guests ?? []) as OfflineGuestRow[];
}

export function offlineContactInputsFromPack(pack: OfflinePack): DayOfContactInput[] {
  const people = asPeople(pack);
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const contacts: DayOfContactInput[] = asContacts(pack).map((contact) => {
    const linked = contact.personId ? peopleById.get(contact.personId) : undefined;
    return {
      id: contact.id,
      name: contact.name,
      personName: linked?.name ?? null,
      directoryLabel: contact.directoryLabel ?? linked?.directoryLabel ?? null,
      phone: contact.phone,
      email: contact.email,
      photoData: contact.photoData,
      sortOrder: contact.sortOrder,
      isDayOfContact: contact.isDayOfContact,
      personId: contact.personId ?? null,
    };
  });
  const persons: DayOfPersonInput[] = people.map((person) => ({
    id: person.id,
    name: person.name,
    directoryLabel: person.directoryLabel ?? null,
    isDayOfContact: person.isDayOfContact,
    sortOrder: person.sortOrder,
  }));
  return collectDayOfContactInputs({ contacts, persons });
}

/** Day-of experience source from a saved offline pack. Matches online Person+Contact membership. */
export function sourceFromPack(pack: OfflinePack, now = new Date()): DayOfExperienceSource {
  const timezone = pack.timezone || "America/Detroit";
  const blocks = weddingTimelineRows((pack.timeline ?? []) as TimelineRow[]).map(toDayOfBlock);
  const assignments: DayOfAssignmentInput[] = asAssignments(pack).map((assignment) => ({
    id: assignment.id,
    title: assignment.title,
    notes: assignment.notes,
    sortOrder: assignment.sortOrder,
    assignees: (assignment.assignees ?? []).map((row) => ({ personId: row.personId })),
  }));

  return {
    generatedAt: now.toISOString(),
    freezeClock: false,
    timezone,
    weddingDateIso: pack.weddingDate,
    coupleNames: pack.coupleNames,
    weddingDateLabel: pack.weddingDate
      ? formatWeddingDateLabel(new Date(pack.weddingDate), timezone)
      : null,
    blocks,
    contacts: offlineContactInputsFromPack(pack),
    assignments,
    linkedPersonId: null,
    canSeeContacts: true,
  };
}

/**
 * A successful refresh replaces the previous pack entirely.
 * IndexedDB `put` of the current key is replacement, not a merge.
 */
export function refreshedOfflinePack(_previous: OfflinePack | null, incoming: OfflinePack): OfflinePack {
  return incoming;
}

export function offlineDirectoryContactsFromPack(pack: OfflinePack): OfflineDirectoryContact[] {
  const stored = asContacts(pack).map((contact) => ({
    id: contact.id,
    name: contact.name,
    subtitle: contact.directoryLabel?.trim() || null,
    phone: contact.phone,
    email: contact.email,
    photoData: contact.photoData,
  }));
  const storedIds = new Set(stored.map((row) => row.id));
  const extras = offlineContactInputsFromPack(pack)
    .filter((row) => row.isDayOfContact && row.id.startsWith("person:") && !storedIds.has(row.id))
    .map((row) => ({
      id: row.id,
      name: row.personName?.trim() || row.name,
      subtitle: row.directoryLabel?.trim() || null,
      phone: row.phone,
      email: row.email,
      photoData: row.photoData ?? null,
    }));
  return [...stored, ...extras];
}

export function offlineGuestDisplayName(guest: OfflineGuestRow): string {
  const fromPeople = (guest.people ?? []).map((person) => person.name.trim()).filter(Boolean);
  if (fromPeople.length > 0) return fromPeople.join(" & ");
  if (guest.nameLine2?.trim()) return `${guest.nameLine1} & ${guest.nameLine2.trim()}`;
  return guest.nameLine1;
}

/** Individual RSVP labels from GuestPerson only. Never copies Guest.rsvpStatus onto members. */
export function offlineGuestPersonRsvpRows(guest: OfflineGuestRow): OfflineGuestPersonRsvpRow[] {
  return (guest.people ?? [])
    .map((person) => ({
      name: person.name.trim(),
      rsvpLabel: rsvpStatusLabel(person.rsvpStatus ?? "pending"),
    }))
    .filter((row) => row.name);
}

export function offlineAssignmentOwnerNames(assignment: OfflineAssignmentRow): string[] {
  return (assignment.assignees ?? [])
    .map((row) => row.person?.name?.trim())
    .filter((name): name is string => Boolean(name));
}

export function asOfflineGuests(pack: OfflinePack): OfflineGuestRow[] {
  return asGuests(pack);
}

export function asOfflineAssignments(pack: OfflinePack): OfflineAssignmentRow[] {
  return asAssignments(pack);
}
