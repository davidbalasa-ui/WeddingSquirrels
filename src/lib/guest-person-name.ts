/**
 * Canonical guest/person name writes. Never creates Person or GuestPerson.
 * Linked GuestPerson.personId updates the existing Person; unlinked rows
 * edit GuestPerson.name only.
 */
import { parseProfileId } from "@/lib/people-directory";
import { syncLegacyGuestNames } from "@/lib/guest-gifts";

export type NameWriteGuest = {
  id: string;
  nameLine1: string;
  nameLine2: string | null;
};

export type NameWriteGuestPerson = {
  id: string;
  guestId: string;
  name: string;
  personId: string | null;
  rsvpStatus: string;
  tableNumber: number | null;
  tableSpot: string | null;
  photoData: string | null;
  directoryLabel: string | null;
  isDayOfContact: boolean;
};

export type NameWritePerson = {
  id: string;
  name: string;
};

export type NameWriteContact = {
  id: string;
  name: string;
  personId: string | null;
};

export type NameWriteStaySlot = {
  id: string;
  occupant: string;
};

export type NameWriteMealGuest = {
  id: string;
  name: string;
  personId: string | null;
};

export type NameWriteStore = {
  persons: NameWritePerson[];
  guests: NameWriteGuest[];
  guestPeople: NameWriteGuestPerson[];
  contacts: NameWriteContact[];
  staySlots?: NameWriteStaySlot[];
  mealGuests?: NameWriteMealGuest[];
};

export type GuestNameWriteResult =
  | {
      ok: true;
      personId: string | null;
      guestPersonId: string | null;
      createdPerson: false;
      createdGuestPerson: false;
    }
  | { ok: false; reason: "forbidden" | "not_found" | "invalid" };

function resolveGuestPerson(
  store: NameWriteStore,
  parsed: { kind: "person" | "contact" | "guest"; id: string },
): NameWriteGuestPerson | null {
  if (parsed.kind === "guest") {
    return store.guestPeople.find((row) => row.id === parsed.id) ?? null;
  }
  let personId: string | null = parsed.kind === "person" ? parsed.id : null;
  if (parsed.kind === "contact") {
    personId = store.contacts.find((row) => row.id === parsed.id)?.personId ?? null;
  }
  if (!personId) return null;
  return store.guestPeople.find((row) => row.personId === personId) ?? null;
}

function syncHouseholdNames(store: NameWriteStore, guestId: string) {
  const guest = store.guests.find((row) => row.id === guestId);
  if (!guest) return;
  const people = store.guestPeople.filter((row) => row.guestId === guestId);
  const legacy = syncLegacyGuestNames(
    people.map((person) => ({
      name: person.name,
      tableNumber: person.tableNumber,
      tableSpot: person.tableSpot,
    })),
  );
  guest.nameLine1 = legacy.nameLine1;
  guest.nameLine2 = legacy.nameLine2;
}

function renameCanonicalPerson(store: NameWriteStore, personId: string, fromName: string, toName: string) {
  const person = store.persons.find((row) => row.id === personId);
  if (person) person.name = toName;
  for (const contact of store.contacts) {
    if (contact.personId === personId && contact.name === fromName) contact.name = toName;
  }
  for (const slot of store.staySlots ?? []) {
    if (slot.occupant === fromName) slot.occupant = toName;
  }
  for (const meal of store.mealGuests ?? []) {
    if (meal.personId === personId) meal.name = toName;
  }
}

export function applyGuestPersonNameInStore(
  store: NameWriteStore,
  input: { guestPersonId: string; name: string; authorized: boolean },
): GuestNameWriteResult {
  if (!input.authorized) return { ok: false, reason: "forbidden" };
  const trimmed = input.name.trim();
  if (!input.guestPersonId || !trimmed) return { ok: false, reason: "invalid" };

  const guestPerson = store.guestPeople.find((row) => row.id === input.guestPersonId);
  if (!guestPerson) return { ok: false, reason: "not_found" };

  const personCount = store.persons.length;
  const guestPersonCount = store.guestPeople.length;

  if (guestPerson.personId) {
    const person = store.persons.find((row) => row.id === guestPerson.personId);
    if (!person) return { ok: false, reason: "not_found" };
    const fromName = person.name;
    renameCanonicalPerson(store, person.id, fromName, trimmed);
    guestPerson.name = trimmed;
  } else {
    guestPerson.name = trimmed;
  }
  syncHouseholdNames(store, guestPerson.guestId);

  if (store.persons.length !== personCount || store.guestPeople.length !== guestPersonCount) {
    throw new Error("GUEST_NAME_CREATED_IDENTITY");
  }

  return {
    ok: true,
    personId: guestPerson.personId,
    guestPersonId: guestPerson.id,
    createdPerson: false,
    createdGuestPerson: false,
  };
}

export function applyProfileGuestNameInStore(
  store: NameWriteStore,
  input: { profileId: string; name: string; authorized: boolean },
): GuestNameWriteResult {
  if (!input.authorized) return { ok: false, reason: "forbidden" };
  const trimmed = input.name.trim();
  if (!trimmed) return { ok: false, reason: "invalid" };

  const parsed = parseProfileId(input.profileId);
  if (!parsed) return { ok: false, reason: "invalid" };

  const guestPerson = resolveGuestPerson(store, parsed);
  if (guestPerson) {
    return applyGuestPersonNameInStore(store, {
      guestPersonId: guestPerson.id,
      name: trimmed,
      authorized: true,
    });
  }

  if (parsed.kind !== "person") return { ok: false, reason: "not_found" };
  const person = store.persons.find((row) => row.id === parsed.id);
  if (!person) return { ok: false, reason: "not_found" };

  const personCount = store.persons.length;
  const guestPersonCount = store.guestPeople.length;
  renameCanonicalPerson(store, person.id, person.name, trimmed);
  if (store.persons.length !== personCount || store.guestPeople.length !== guestPersonCount) {
    throw new Error("GUEST_NAME_CREATED_IDENTITY");
  }
  return {
    ok: true,
    personId: person.id,
    guestPersonId: null,
    createdPerson: false,
    createdGuestPerson: false,
  };
}
