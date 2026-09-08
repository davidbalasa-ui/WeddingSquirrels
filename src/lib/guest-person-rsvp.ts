import { isRsvpStatus, parseRsvpStatus, RSVP_STATUSES, type RsvpStatus } from "@/lib/guest-gifts";
import { householdRsvpFromPeople } from "@/lib/guest-rsvp-import";
import { parseProfileId } from "@/lib/people-directory";

export { RSVP_STATUSES as PROFILE_RSVP_STATUSES };

export type ProfileRsvpGuest = {
  id: string;
  rsvpStatus: string;
  invitedCount: number;
  acceptedCount: number;
};

export type ProfileRsvpGuestPerson = {
  id: string;
  guestId: string;
  name: string;
  personId: string | null;
  rsvpStatus: string;
  tableNumber: number | null;
  tableSpot: string | null;
  isDayOfContact: boolean;
};

export type ProfileRsvpPerson = {
  id: string;
};

export type ProfileRsvpContact = {
  id: string;
  personId: string | null;
};

export type ProfileRsvpStore = {
  persons: ProfileRsvpPerson[];
  guests: ProfileRsvpGuest[];
  guestPeople: ProfileRsvpGuestPerson[];
  contacts: ProfileRsvpContact[];
};

export type ProfileRsvpWriteResult =
  | { ok: true; guestPersonId: string; guestId: string; rsvpStatus: RsvpStatus }
  | { ok: false; reason: "forbidden" | "not_found" | "invalid" };

/** Resolve RSVP ownership from explicit identity links only. Never name-matches. */
export function resolveLinkedGuestPerson<T extends { id: string; personId: string | null }>(
  parsed: { kind: "person" | "contact" | "guest"; id: string },
  rows: {
    guestPeople: T[];
    contacts: Array<{ id: string; personId: string | null }>;
  },
): T | null {
  if (parsed.kind === "guest") {
    return rows.guestPeople.find((row) => row.id === parsed.id) ?? null;
  }
  if (parsed.kind === "person") {
    return rows.guestPeople.find((row) => row.personId === parsed.id) ?? null;
  }
  const contact = rows.contacts.find((row) => row.id === parsed.id);
  if (!contact?.personId) return null;
  return rows.guestPeople.find((row) => row.personId === contact.personId) ?? null;
}

export function resolveLinkedGuestPersonForProfile(
  store: Pick<ProfileRsvpStore, "guestPeople" | "contacts">,
  profileId: string,
): ProfileRsvpGuestPerson | null {
  const parsed = parseProfileId(profileId);
  if (!parsed) return null;
  return resolveLinkedGuestPerson(parsed, store);
}

export function readProfileRsvp(
  store: Pick<ProfileRsvpStore, "guestPeople" | "contacts">,
  profileId: string,
): RsvpStatus | null {
  const guestPerson = resolveLinkedGuestPersonForProfile(store, profileId);
  if (!guestPerson) return null;
  return parseRsvpStatus(guestPerson.rsvpStatus);
}

export function profileShowsRsvpEditor(guestPersonId: string | null | undefined): boolean {
  return Boolean(guestPersonId);
}

function syncHouseholdRsvpInStore(store: ProfileRsvpStore, guestId: string) {
  const guest = store.guests.find((row) => row.id === guestId);
  if (!guest) return;
  const people = store.guestPeople.filter((row) => row.guestId === guestId);
  const summary = householdRsvpFromPeople(
    people.map((person) => ({ rsvp: parseRsvpStatus(person.rsvpStatus) })),
  );
  guest.rsvpStatus = summary.rsvpStatus;
  guest.invitedCount = summary.invitedCount;
  guest.acceptedCount = summary.acceptedCount;
}

/** Update an existing GuestPerson RSVP. Never creates Person, Guest, or GuestPerson. */
export function applyProfileGuestRsvpInStore(
  store: ProfileRsvpStore,
  input: { profileId: string; rsvpStatus: string; authorized: boolean },
): ProfileRsvpWriteResult {
  if (!input.authorized) return { ok: false, reason: "forbidden" };
  if (!isRsvpStatus(input.rsvpStatus)) return { ok: false, reason: "invalid" };

  const parsed = parseProfileId(input.profileId);
  if (!parsed) return { ok: false, reason: "invalid" };

  const guestPerson = resolveLinkedGuestPerson(parsed, store);
  if (!guestPerson) return { ok: false, reason: "not_found" };

  guestPerson.rsvpStatus = input.rsvpStatus;
  syncHouseholdRsvpInStore(store, guestPerson.guestId);
  return {
    ok: true,
    guestPersonId: guestPerson.id,
    guestId: guestPerson.guestId,
    rsvpStatus: input.rsvpStatus,
  };
}

export function applyGuestPersonRsvpInStore(
  store: ProfileRsvpStore,
  input: { guestPersonId: string; rsvpStatus: string; authorized: boolean },
): ProfileRsvpWriteResult {
  if (!input.authorized) return { ok: false, reason: "forbidden" };
  if (!input.guestPersonId || !isRsvpStatus(input.rsvpStatus)) return { ok: false, reason: "invalid" };

  const guestPerson = store.guestPeople.find((row) => row.id === input.guestPersonId);
  if (!guestPerson) return { ok: false, reason: "not_found" };

  guestPerson.rsvpStatus = input.rsvpStatus;
  syncHouseholdRsvpInStore(store, guestPerson.guestId);
  return {
    ok: true,
    guestPersonId: guestPerson.id,
    guestId: guestPerson.guestId,
    rsvpStatus: input.rsvpStatus,
  };
}
