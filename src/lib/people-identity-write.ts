import { prisma } from "@/lib/db";
import { personIdFromName } from "@/lib/people";
import {
  profileIdForContact,
  profileIdForGuestPerson,
  profileIdForPerson,
  type PeoplePrimaryList,
} from "@/lib/people-directory";

export type IdentityPerson = {
  id: string;
  name: string;
  sortOrder: number;
  directoryLabel: string | null;
  directoryList: string | null;
  isDayOfContact: boolean;
};

export type IdentityGuestPerson = {
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
  sortOrder: number;
};

export type IdentityContact = {
  id: string;
  name: string;
  personId: string | null;
  phone: string | null;
  email: string | null;
  photoData: string | null;
  directoryLabel: string | null;
  directoryList: string | null;
  isDayOfContact: boolean;
  sortOrder: number;
};

export type IdentityGuest = {
  id: string;
  nameLine1: string;
  sortOrder: number;
};

export type IdentityStore = {
  persons: IdentityPerson[];
  guests: IdentityGuest[];
  guestPeople: IdentityGuestPerson[];
  contacts: IdentityContact[];
};

export type PersonCreateStrategy = "reuse" | "create" | "none";

export function planPersonForRoleWrite(input: {
  existingPersonId: string | null;
  explicitPersonId?: string | null;
}): { strategy: PersonCreateStrategy; personId: string | null } {
  if (input.explicitPersonId) return { strategy: "reuse", personId: input.explicitPersonId };
  if (input.existingPersonId) return { strategy: "reuse", personId: input.existingPersonId };
  return { strategy: "create", personId: null };
}

export function roleEditMustPreservePersonId(
  existingPersonId: string | null,
  nextPersonId: string | null | undefined,
): string | null {
  if (existingPersonId) return existingPersonId;
  if (nextPersonId === undefined) return existingPersonId;
  return nextPersonId;
}

export function photoCopyPeerByPersonId<T extends { id: string; personId: string | null; photoData?: string | null }>(
  sourcePersonId: string | null,
  candidates: T[],
): T | null {
  if (!sourcePersonId) return null;
  return candidates.find((row) => row.personId === sourcePersonId && !row.photoData?.trim()) ?? null;
}

export function allocatePersonId(name: string, existingIds: Iterable<string>): string {
  const taken = new Set(existingIds);
  const base = personIdFromName(name);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
}

function nextSort(rows: Array<{ sortOrder: number }>): number {
  return rows.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
}

export function createPersonInStore(store: IdentityStore, name: string): IdentityPerson {
  const person: IdentityPerson = {
    id: allocatePersonId(name, store.persons.map((row) => row.id)),
    name,
    sortOrder: nextSort(store.persons),
    directoryLabel: null,
    directoryList: null,
    isDayOfContact: false,
  };
  store.persons.push(person);
  return person;
}

export function editPersonInStore(
  store: IdentityStore,
  personId: string,
  patch: Partial<Pick<IdentityPerson, "name" | "directoryLabel">>,
): IdentityPerson | null {
  const row = store.persons.find((item) => item.id === personId);
  if (!row) return null;
  Object.assign(row, patch);
  return row;
}

export function editGuestPersonInStore(
  store: IdentityStore,
  guestPersonId: string,
  patch: Partial<Pick<IdentityGuestPerson, "name" | "rsvpStatus" | "tableNumber" | "tableSpot" | "photoData" | "directoryLabel" | "isDayOfContact">>,
): IdentityGuestPerson | null {
  const row = store.guestPeople.find((item) => item.id === guestPersonId);
  if (!row) return null;
  Object.assign(row, patch);
  return row;
}

export function editContactInStore(
  store: IdentityStore,
  contactId: string,
  patch: Partial<Pick<IdentityContact, "name" | "phone" | "email" | "photoData" | "directoryLabel" | "directoryList" | "isDayOfContact">>,
): IdentityContact | null {
  const row = store.contacts.find((item) => item.id === contactId);
  if (!row) return null;
  Object.assign(row, patch);
  return row;
}

export function linkGuestPersonInStore(
  store: IdentityStore,
  guestPersonId: string,
  personId: string,
): IdentityGuestPerson | null {
  if (!store.persons.some((row) => row.id === personId)) return null;
  const row = store.guestPeople.find((item) => item.id === guestPersonId);
  if (!row) return null;
  row.personId = personId;
  return row;
}

export function linkContactInStore(
  store: IdentityStore,
  contactId: string,
  personId: string,
): IdentityContact | null {
  if (!store.persons.some((row) => row.id === personId)) return null;
  const row = store.contacts.find((item) => item.id === contactId);
  if (!row) return null;
  row.personId = personId;
  return row;
}

function resolvePersonInStore(
  store: IdentityStore,
  input: { existingPersonId: string | null; explicitPersonId?: string | null; name: string },
): IdentityPerson | null {
  const plan = planPersonForRoleWrite(input);
  if (plan.strategy === "reuse" && plan.personId) {
    return store.persons.find((row) => row.id === plan.personId) ?? null;
  }
  if (plan.strategy === "create") return createPersonInStore(store, input.name);
  return null;
}

function ensureGuestPersonForPersonInStore(
  store: IdentityStore,
  person: IdentityPerson,
  source: { name: string; directoryLabel?: string | null; isDayOfContact?: boolean },
): IdentityGuestPerson {
  const existing = store.guestPeople.find((row) => row.personId === person.id);
  if (existing) return existing;
  const guest: IdentityGuest = {
    id: `guest_${store.guests.length + 1}`,
    nameLine1: source.name,
    sortOrder: nextSort(store.guests),
  };
  store.guests.push(guest);
  const guestPerson: IdentityGuestPerson = {
    id: `gp_${store.guestPeople.length + 1}`,
    guestId: guest.id,
    name: source.name,
    personId: person.id,
    rsvpStatus: "pending",
    tableNumber: null,
    tableSpot: null,
    photoData: null,
    directoryLabel: source.directoryLabel?.trim() || null,
    isDayOfContact: source.isDayOfContact ?? false,
    sortOrder: 0,
  };
  store.guestPeople.push(guestPerson);
  return guestPerson;
}

function ensureContactForPersonInStore(
  store: IdentityStore,
  person: IdentityPerson,
  source: {
    name: string;
    directoryLabel?: string | null;
    directoryList?: string | null;
    isDayOfContact?: boolean;
    phone?: string | null;
    email?: string | null;
    photoData?: string | null;
  },
): IdentityContact {
  const existing = store.contacts.find((row) => row.personId === person.id);
  if (existing) {
    if (source.directoryList) existing.directoryList = source.directoryList;
    return existing;
  }
  const contact: IdentityContact = {
    id: `contact_${store.contacts.length + 1}`,
    name: source.name,
    personId: person.id,
    phone: source.phone ?? null,
    email: source.email ?? null,
    photoData: source.photoData ?? null,
    directoryLabel: source.directoryLabel?.trim() || null,
    directoryList: source.directoryList ?? "vendors",
    isDayOfContact: source.isDayOfContact ?? false,
    sortOrder: nextSort(store.contacts),
  };
  store.contacts.push(contact);
  return contact;
}

function profileIdForLinkedRole(personId: string | null, fallback: string): string {
  return personId ? profileIdForPerson(personId) : fallback;
}

export function convertPrimaryListInStore(
  store: IdentityStore,
  input: {
    kind: "guest" | "contact" | "person";
    id: string;
    list: PeoplePrimaryList;
    explicitPersonId?: string | null;
  },
): { ok: true; profileId: string } | { ok: false; reason: "not_found" } {
  if (input.kind === "guest") {
    const guestPerson = store.guestPeople.find((row) => row.id === input.id);
    if (!guestPerson) return { ok: false, reason: "not_found" };
    if (input.list === "guests") {
      return {
        ok: true,
        profileId: profileIdForLinkedRole(guestPerson.personId, profileIdForGuestPerson(guestPerson.id)),
      };
    }
    const person = resolvePersonInStore(store, {
      existingPersonId: guestPerson.personId,
      explicitPersonId: input.explicitPersonId,
      name: guestPerson.name,
    });
    if (!person) return { ok: false, reason: "not_found" };
    guestPerson.personId = person.id;
    person.directoryList = input.list;
    ensureContactForPersonInStore(store, person, {
      name: guestPerson.name,
      directoryLabel: guestPerson.directoryLabel,
      directoryList: "vendors",
      isDayOfContact: guestPerson.isDayOfContact,
      photoData: guestPerson.photoData,
    });
    return { ok: true, profileId: profileIdForPerson(person.id) };
  }

  if (input.kind === "contact") {
    const contact = store.contacts.find((row) => row.id === input.id);
    if (!contact) return { ok: false, reason: "not_found" };
    if (input.list === "vendors") {
      contact.directoryList = "vendors";
      if (contact.personId) {
        const linked = store.persons.find((row) => row.id === contact.personId);
        if (linked) linked.directoryList = "vendors";
      }
      return {
        ok: true,
        profileId: profileIdForLinkedRole(contact.personId, profileIdForContact(contact.id)),
      };
    }
    const person = resolvePersonInStore(store, {
      existingPersonId: contact.personId,
      explicitPersonId: input.explicitPersonId,
      name: contact.name,
    });
    if (!person) return { ok: false, reason: "not_found" };
    contact.personId = person.id;
    person.directoryList = "guests";
    ensureGuestPersonForPersonInStore(store, person, {
      name: contact.name,
      directoryLabel: contact.directoryLabel,
      isDayOfContact: contact.isDayOfContact,
    });
    return { ok: true, profileId: profileIdForPerson(person.id) };
  }

  const person = store.persons.find((row) => row.id === input.id);
  if (!person) return { ok: false, reason: "not_found" };
  if (input.list === "guests") {
    ensureGuestPersonForPersonInStore(store, person, {
      name: person.name,
      directoryLabel: person.directoryLabel,
      isDayOfContact: person.isDayOfContact,
    });
  }
  person.directoryList = input.list;
  return { ok: true, profileId: profileIdForPerson(person.id) };
}

async function createCanonicalPerson(name: string) {
  const existingIds = (await prisma.person.findMany({ select: { id: true } })).map((row) => row.id);
  const id = allocatePersonId(name, existingIds);
  const maxSort = await prisma.person.aggregate({ _max: { sortOrder: true } });
  return prisma.person.create({
    data: {
      id,
      name,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });
}

async function resolveCanonicalPerson(input: {
  existingPersonId: string | null;
  explicitPersonId?: string | null;
  name: string;
}) {
  const plan = planPersonForRoleWrite(input);
  if (plan.strategy === "reuse" && plan.personId) {
    return prisma.person.findUnique({ where: { id: plan.personId } });
  }
  if (plan.strategy === "create") return createCanonicalPerson(input.name);
  return null;
}

async function ensureGuestPersonForPerson(
  personId: string,
  source: { name: string; directoryLabel?: string | null; isDayOfContact?: boolean },
) {
  const existing = await prisma.guestPerson.findFirst({ where: { personId } });
  if (existing) return existing;
  const maxSort = await prisma.guest.aggregate({ _max: { sortOrder: true } });
  const guest = await prisma.guest.create({
    data: {
      nameLine1: source.name,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      invitedCount: 1,
      people: {
        create: {
          name: source.name,
          directoryLabel: source.directoryLabel?.trim() || null,
          isDayOfContact: source.isDayOfContact ?? false,
          personId,
          sortOrder: 0,
        },
      },
    },
    include: { people: true },
  });
  return guest.people[0] ?? null;
}

async function ensureContactForPerson(
  personId: string,
  source: {
    name: string;
    directoryLabel?: string | null;
    directoryList?: string | null;
    isDayOfContact?: boolean;
    phone?: string | null;
    email?: string | null;
    photoData?: string | null;
  },
) {
  const existing = await prisma.contact.findFirst({ where: { personId } });
  if (existing) {
    if (source.directoryList && existing.directoryList !== source.directoryList) {
      return prisma.contact.update({
        where: { id: existing.id },
        data: { directoryList: source.directoryList },
      });
    }
    return existing;
  }
  const last = await prisma.contact.findFirst({ orderBy: { sortOrder: "desc" } });
  return prisma.contact.create({
    data: {
      name: source.name,
      directoryLabel: source.directoryLabel?.trim() || null,
      directoryList: source.directoryList ?? "vendors",
      isDayOfContact: source.isDayOfContact ?? false,
      phone: source.phone ?? null,
      email: source.email ?? null,
      photoData: source.photoData ?? null,
      personId,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
}

export async function convertPrimaryListForIdentity(
  parsed: { kind: "guest" | "contact" | "person"; id: string },
  list: PeoplePrimaryList,
  opts?: { explicitPersonId?: string | null },
): Promise<{ ok: true; profileId: string } | { ok: false; reason: "not_found" }> {
  if (parsed.kind === "guest") {
    const guestPerson = await prisma.guestPerson.findUnique({ where: { id: parsed.id } });
    if (!guestPerson) return { ok: false, reason: "not_found" };
    if (list === "guests") {
      return {
        ok: true,
        profileId: profileIdForLinkedRole(guestPerson.personId, profileIdForGuestPerson(guestPerson.id)),
      };
    }
    const person = await resolveCanonicalPerson({
      existingPersonId: guestPerson.personId,
      explicitPersonId: opts?.explicitPersonId,
      name: guestPerson.name,
    });
    if (!person) return { ok: false, reason: "not_found" };
    if (guestPerson.personId !== person.id) {
      await prisma.guestPerson.update({ where: { id: guestPerson.id }, data: { personId: person.id } });
    }
    await prisma.person.update({
      where: { id: person.id },
      data: { directoryList: list },
    });
    await ensureContactForPerson(person.id, {
      name: guestPerson.name,
      directoryLabel: guestPerson.directoryLabel,
      directoryList: "vendors",
      isDayOfContact: guestPerson.isDayOfContact,
      photoData: guestPerson.photoData,
    });
    return { ok: true, profileId: profileIdForPerson(person.id) };
  }

  if (parsed.kind === "contact") {
    const contact = await prisma.contact.findUnique({ where: { id: parsed.id } });
    if (!contact) return { ok: false, reason: "not_found" };
    if (list === "vendors") {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { directoryList: "vendors" },
      });
      if (contact.personId) {
        await prisma.person.update({
          where: { id: contact.personId },
          data: { directoryList: "vendors" },
        });
      }
      return {
        ok: true,
        profileId: profileIdForLinkedRole(contact.personId, profileIdForContact(contact.id)),
      };
    }
    const person = await resolveCanonicalPerson({
      existingPersonId: contact.personId,
      explicitPersonId: opts?.explicitPersonId,
      name: contact.name,
    });
    if (!person) return { ok: false, reason: "not_found" };
    if (contact.personId !== person.id) {
      await prisma.contact.update({ where: { id: contact.id }, data: { personId: person.id } });
    }
    await prisma.person.update({
      where: { id: person.id },
      data: { directoryList: "guests" },
    });
    const guestPerson = await ensureGuestPersonForPerson(person.id, {
      name: contact.name,
      directoryLabel: contact.directoryLabel,
      isDayOfContact: contact.isDayOfContact,
    });
    if (!guestPerson) return { ok: false, reason: "not_found" };
    return { ok: true, profileId: profileIdForPerson(person.id) };
  }

  const person = await prisma.person.findUnique({ where: { id: parsed.id } });
  if (!person) return { ok: false, reason: "not_found" };
  if (list === "guests") {
    await ensureGuestPersonForPerson(person.id, {
      name: person.name,
      directoryLabel: person.directoryLabel,
      isDayOfContact: person.isDayOfContact,
    });
  }
  await prisma.person.update({
    where: { id: person.id },
    data: { directoryList: list },
  });
  return { ok: true, profileId: profileIdForPerson(person.id) };
}

export async function linkGuestPersonToExistingPerson(guestPersonId: string, personId: string) {
  const person = await prisma.person.findUnique({ where: { id: personId }, select: { id: true } });
  if (!person) return null;
  const guestPerson = await prisma.guestPerson.findUnique({ where: { id: guestPersonId } });
  if (!guestPerson) return null;
  return prisma.guestPerson.update({
    where: { id: guestPersonId },
    data: { personId: person.id },
  });
}

export async function linkContactToExistingPerson(contactId: string, personId: string) {
  const person = await prisma.person.findUnique({ where: { id: personId }, select: { id: true } });
  if (!person) return null;
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return null;
  return prisma.contact.update({
    where: { id: contactId },
    data: { personId: person.id },
  });
}

export async function copyPhotoToLinkedPeer(input: {
  sourcePersonId: string | null;
  photoData: string;
  direction: "guest-to-contact" | "contact-to-guest";
}): Promise<void> {
  if (!input.sourcePersonId) return;
  if (input.direction === "guest-to-contact") {
    const contacts = await prisma.contact.findMany({
      select: { id: true, personId: true, photoData: true },
    });
    const match = photoCopyPeerByPersonId(input.sourcePersonId, contacts);
    if (!match) return;
    await prisma.contact.update({ where: { id: match.id }, data: { photoData: input.photoData } });
    return;
  }
  const guestPeople = await prisma.guestPerson.findMany({
    select: { id: true, personId: true, photoData: true },
  });
  const match = photoCopyPeerByPersonId(input.sourcePersonId, guestPeople);
  if (!match) return;
  await prisma.guestPerson.update({ where: { id: match.id }, data: { photoData: input.photoData } });
}
