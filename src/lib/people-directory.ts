import { MEAL_SECTIONS } from "@/lib/meals";

export type PeopleGroup = "party" | "family" | "vendor";
/** Guest list or vendor list — the two primary roles. */
export type PeoplePrimaryList = "guests" | "vendors";
/** Tabs on the unified People page. */
export type PeopleTab = "guests" | "vendors" | "day-of" | "all";

export type PeopleSort = "name" | "role" | "rsvp" | "table";
/** Combo filter: role dropdown on the People page. */
export type PeopleRoleFilter = "all" | "guest" | "wedding_party" | "family" | "vendor";
/** Combo filter: attendance dropdown on the People page. */
export type PeopleAttendanceFilter = "all" | "pending" | "attending" | "not_attending";
/** List vs seating-table view. */
export type PeopleView = "list" | "table";

export type DirectoryEntry = {
  profileId: string;
  personId: string | null;
  contactId: string | null;
  guestPersonId: string | null;
  name: string;
  subtitle: string | null;
  photoSrc: string | null;
  group: PeopleGroup;
  roles: string[];
  phone: string | null;
  email: string | null;
  address: string | null;
  rsvpLabel: string | null;
  tableLabel: string | null;
  sortKey: string;
  primaryList: PeoplePrimaryList | null;
  lists: PeoplePrimaryList[];
  isDayOfContact: boolean;
};

export const PARTY_SECTION_IDS = new Set(["party", "officiant", "ceremony"]);
export const FAMILY_SECTION_IDS = new Set(["groom", "bride"]);
const DAY_OF_MEAL_SECTION_IDS = new Set(["couple", "party", "officiant", "ceremony", "groom", "bride"]);

/** Extra full-name aliases for day-of contact matching beyond meal roster names. */
const DAY_OF_CONTACT_ALIASES = [
  "Marie Wiewiora",
  "Kurt Huizenga",
  "Wendy Rush",
  "Shelly Wiewiora",
  "John Wiewiora",
  "Brian Balasa",
  "Bryan Balasa",
  "Pam Balasa",
  "David Balasa",
  "Haley Balasa",
  "Andi Cartwright",
];

export function dayOfContactRosterNames(): string[] {
  const names = new Set<string>();
  for (const section of MEAL_SECTIONS) {
    if (!DAY_OF_MEAL_SECTION_IDS.has(section.id)) continue;
    for (const guest of section.guests) {
      names.add(guest.name);
    }
  }
  for (const alias of DAY_OF_CONTACT_ALIASES) {
    names.add(alias);
  }
  return [...names];
}

export function isDayOfContactName(name: string): boolean {
  const roster = dayOfContactRosterNames();
  return roster.some((candidate) => namesMatch(candidate, name));
}

export function isPeoplePrimaryList(value: string | null | undefined): value is PeoplePrimaryList {
  return value === "guests" || value === "vendors";
}

export function parsePeopleTab(raw: string | null | undefined): PeopleTab | null {
  if (raw === "guests" || raw === "vendors" || raw === "day-of" || raw === "all") return raw;
  return null;
}

export function parsePeopleSort(raw: string | null | undefined): PeopleSort | null {
  if (raw === "name" || raw === "role" || raw === "rsvp" || raw === "table") return raw;
  return null;
}

export function parsePeopleRoleFilter(raw: string | null | undefined): PeopleRoleFilter | null {
  if (raw === "all" || raw === "guest" || raw === "wedding_party" || raw === "family" || raw === "vendor") {
    return raw;
  }
  return null;
}

export function parsePeopleAttendanceFilter(raw: string | null | undefined): PeopleAttendanceFilter | null {
  if (raw === "all" || raw === "pending" || raw === "attending" || raw === "not_attending") return raw;
  return null;
}

export function parsePeopleView(raw: string | null | undefined): PeopleView | null {
  if (raw === "list" || raw === "table") return raw;
  return null;
}

/** Resolve guest vs vendor primary list. Returns null when not explicitly assigned. */
export function resolvePrimaryList(input: {
  kind: "person" | "contact" | "guest";
  directoryList?: string | null;
}): PeoplePrimaryList | null {
  if (input.directoryList === "day-of") return null;
  if (input.directoryList === "guests") return "guests";
  if (input.directoryList === "vendors") return "vendors";
  if (input.kind === "guest") return "guests";
  if (input.kind === "contact") return "vendors";
  return null;
}

export function resolveIsDayOfContact(input: {
  isDayOfContact?: boolean | null;
  directoryList?: string | null;
}): boolean {
  return Boolean(input.isDayOfContact) || input.directoryList === "day-of";
}

export function filterEntriesByTab(entries: DirectoryEntry[], tab: PeopleTab): DirectoryEntry[] {
  if (tab === "all") return entries;
  if (tab === "day-of") {
    return entries.filter((entry) => entry.isDayOfContact && entry.lists.length > 0);
  }
  return entries.filter((entry) => entry.lists.includes(tab));
}

export function sourceListLabel(list: PeoplePrimaryList | null): string | null {
  if (list === "guests") return "Guest list";
  if (list === "vendors") return "Vendors";
  return null;
}

export function sourceListsLabel(lists: PeoplePrimaryList[]): string | null {
  const labels = lists.map((list) => sourceListLabel(list)).filter((label): label is string => Boolean(label));
  return labels.length ? [...new Set(labels)].join(" · ") : null;
}

/** Canonical People URL. personId wins whenever the Person row is known to exist. */
export function canonicalProfileIdForSource(input: {
  kind: "person" | "contact" | "guest";
  id: string;
  personId?: string | null;
}): string {
  if (input.kind === "person") return profileIdForPerson(input.id);
  if (input.personId) return profileIdForPerson(input.personId);
  return input.kind === "contact" ? profileIdForContact(input.id) : profileIdForGuestPerson(input.id);
}

export function rowsLinkedToPerson<T extends { personId?: string | null }>(
  rows: T[],
  personId: string,
): T[] {
  return rows.filter((row) => row.personId === personId);
}

export function countPeopleHubTabs(input: {
  entries: DirectoryEntry[];
  guestPersonCount: number;
  dayOfContactCount: number;
}): Record<PeopleTab, number> {
  return {
    all: input.entries.length,
    guests: input.guestPersonCount,
    vendors: filterEntriesByTab(input.entries, "vendors").length,
    "day-of": input.dayOfContactCount,
  };
}

/** @deprecated Use isPeoplePrimaryList */
export function isPeopleList(value: string | null | undefined): value is PeoplePrimaryList {
  return isPeoplePrimaryList(value);
}

/** Stable slug for name comparisons across Person, Guest, Contact, and stay text. */
export function normalizePersonName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function namesMatch(a: string, b: string): boolean {
  const left = normalizePersonName(a);
  const right = normalizePersonName(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const leftFirst = left.split(" ")[0] ?? "";
  const rightFirst = right.split(" ")[0] ?? "";
  return leftFirst.length > 2 && leftFirst === rightFirst;
}

export function profileIdForPerson(id: string) {
  return `person:${id}`;
}

export function profileIdForContact(id: string) {
  return `contact:${id}`;
}

export function profileIdForGuestPerson(id: string) {
  return `guest:${id}`;
}

export function parseProfileId(
  profileId: string,
): { kind: "person" | "contact" | "guest"; id: string } | null {
  const colon = profileId.indexOf(":");
  if (colon <= 0) return null;
  const kind = profileId.slice(0, colon);
  const id = profileId.slice(colon + 1);
  if (!id) return null;
  if (kind === "person" || kind === "contact" || kind === "guest") {
    return { kind, id };
  }
  return null;
}

export function mealGuestsByGroup() {
  const party: { id: string; name: string }[] = [];
  const family: { id: string; name: string }[] = [];

  for (const section of MEAL_SECTIONS) {
    const target = PARTY_SECTION_IDS.has(section.id)
      ? party
      : FAMILY_SECTION_IDS.has(section.id)
        ? family
        : null;
    if (!target) continue;
    for (const guest of section.guests) {
      target.push({ id: guest.id, name: guest.name });
    }
  }

  return { party, family };
}

export function vendorSubtitle(name: string): string | null {
  const parts = name.split("·").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  return parts.slice(1).join(" · ");
}

export function classifyNameGroup(
  name: string,
  partyNames: string[],
  familyNames: string[],
): PeopleGroup {
  if (partyNames.some((candidate) => namesMatch(candidate, name))) return "party";
  if (familyNames.some((candidate) => namesMatch(candidate, name))) return "family";
  return "family";
}

export function directoryEntrySort(a: DirectoryEntry, b: DirectoryEntry): number {
  return a.sortKey.localeCompare(b.sortKey) || a.name.localeCompare(b.name);
}

export type RawPeopleDirectoryInput = {
  persons: {
    id: string;
    name: string;
    directoryLabel?: string | null;
    directoryList?: string | null;
    isDayOfContact?: boolean | null;
  }[];
  contacts: {
    id: string;
    name: string;
    directoryLabel?: string | null;
    directoryList?: string | null;
    isDayOfContact?: boolean | null;
    personId?: string | null;
    phone: string | null;
    email: string | null;
    photoData: string | null;
  }[];
  guestPeople: {
    id: string;
    name: string;
    householdLabel: string;
    directoryLabel?: string | null;
    isDayOfContact?: boolean | null;
    personId?: string | null;
    photoData?: string | null;
    address?: string | null;
    rsvpLabel?: string | null;
    tableLabel?: string | null;
  }[];
};

type DirectoryPerson = RawPeopleDirectoryInput["persons"][number];
type DirectoryContact = RawPeopleDirectoryInput["contacts"][number];
type DirectoryGuestPerson = RawPeopleDirectoryInput["guestPeople"][number];

type LinkedDirectoryGroup = {
  personId: string;
  person?: DirectoryPerson;
  contacts: DirectoryContact[];
  guests: DirectoryGuestPerson[];
};

function uniqueRoles(roles: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const role of roles) {
    const trimmed = role?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function personDefaultRoles(
  person: DirectoryPerson,
  primaryList: PeoplePrimaryList | null,
  partyNames: string[],
  familyNames: string[],
): string[] {
  const group = classifyNameGroup(person.name, partyNames, familyNames);
  if (group === "party") return ["Wedding party"];
  if (["david", "haley"].includes(person.id)) return ["Couple"];
  if (primaryList === "vendors") return ["Vendor"];
  return ["Guest"];
}

function withIdentityIds(
  entry: Omit<DirectoryEntry, "personId" | "contactId" | "guestPersonId" | "lists"> & {
    personId?: string | null;
    contactId?: string | null;
    guestPersonId?: string | null;
    lists?: PeoplePrimaryList[];
  },
): DirectoryEntry {
  const lists = entry.lists ?? (entry.primaryList ? [entry.primaryList] : []);
  return {
    ...entry,
    personId: entry.personId ?? null,
    contactId: entry.contactId ?? null,
    guestPersonId: entry.guestPersonId ?? null,
    lists,
  };
}

function buildContactDirectoryEntry(contact: DirectoryContact): DirectoryEntry {
  const primaryList = resolvePrimaryList({ kind: "contact", directoryList: contact.directoryList });
  const isDayOfContact = resolveIsDayOfContact({
    isDayOfContact: contact.isDayOfContact,
    directoryList: contact.directoryList,
  });
  const roles = contact.directoryLabel?.trim()
    ? [contact.directoryLabel.trim()]
    : primaryList === "vendors"
      ? ["Vendor"]
      : ["Guest"];
  return withIdentityIds({
    profileId: profileIdForContact(contact.id),
    contactId: contact.id,
    name: contact.name,
    subtitle: contact.directoryLabel?.trim() || vendorSubtitle(contact.name),
    photoSrc: contact.photoData,
    group: primaryList === "vendors" ? "vendor" : "family",
    roles,
    phone: contact.phone,
    email: contact.email,
    address: null,
    rsvpLabel: null,
    tableLabel: null,
    sortKey: normalizePersonName(contact.name),
    primaryList,
    lists: primaryList ? [primaryList] : [],
    isDayOfContact,
  });
}

function buildGuestDirectoryEntry(
  guest: DirectoryGuestPerson,
  partyNames: string[],
  familyNames: string[],
): DirectoryEntry {
  const group = classifyNameGroup(guest.name, partyNames, familyNames);
  const defaultRole = group === "party" ? "Wedding party" : "Guest";
  const roles = guest.directoryLabel?.trim() ? [guest.directoryLabel.trim()] : [defaultRole];
  return withIdentityIds({
    profileId: profileIdForGuestPerson(guest.id),
    guestPersonId: guest.id,
    name: guest.name,
    subtitle: guest.householdLabel,
    photoSrc: guest.photoData?.trim() || null,
    group,
    roles,
    phone: null,
    email: null,
    address: guest.address?.trim() || null,
    rsvpLabel: guest.rsvpLabel?.trim() || null,
    tableLabel: guest.tableLabel?.trim() || null,
    sortKey: normalizePersonName(guest.name),
    primaryList: "guests",
    lists: ["guests"],
    isDayOfContact: resolveIsDayOfContact({ isDayOfContact: guest.isDayOfContact }),
  });
}

function buildPersonDirectoryEntry(
  person: DirectoryPerson,
  partyNames: string[],
  familyNames: string[],
): DirectoryEntry | null {
  const primaryList = resolvePrimaryList({ kind: "person", directoryList: person.directoryList });
  if (!primaryList) return null;
  const isDayOfContact = resolveIsDayOfContact({
    isDayOfContact: person.isDayOfContact,
    directoryList: person.directoryList,
  });
  const group = classifyNameGroup(person.name, partyNames, familyNames);
  const defaultRoles = personDefaultRoles(person, primaryList, partyNames, familyNames);
  const roles = person.directoryLabel?.trim() ? [person.directoryLabel.trim()] : defaultRoles;
  return withIdentityIds({
    profileId: profileIdForPerson(person.id),
    personId: person.id,
    name: person.name,
    subtitle: person.directoryLabel?.trim() || roles[0] || null,
    photoSrc: null,
    group: primaryList === "vendors" ? "vendor" : group,
    roles,
    phone: null,
    email: null,
    address: null,
    rsvpLabel: null,
    tableLabel: null,
    sortKey: normalizePersonName(person.name),
    primaryList,
    lists: [primaryList],
    isDayOfContact,
  });
}

function buildLinkedDirectoryEntry(
  group: LinkedDirectoryGroup,
  partyNames: string[],
  familyNames: string[],
): DirectoryEntry {
  const contact = group.contacts[0];
  const guest = group.guests[0];
  const personList = group.person
    ? resolvePrimaryList({ kind: "person", directoryList: group.person.directoryList })
    : null;
  const contactList = contact
    ? resolvePrimaryList({ kind: "contact", directoryList: contact.directoryList })
    : null;
  const lists: PeoplePrimaryList[] = [];
  if (group.guests.length || personList === "guests") lists.push("guests");
  if (contactList === "vendors" || personList === "vendors") lists.push("vendors");
  const primaryList = personList ?? (lists.includes("guests") && !lists.includes("vendors") ? "guests" : lists[0] ?? null);
  const name = group.person?.name ?? contact?.name ?? guest?.name ?? group.personId;
  const groupKind = lists.includes("vendors") && !lists.includes("guests")
    ? "vendor"
    : classifyNameGroup(name, partyNames, familyNames);
  const roles = uniqueRoles([
    group.person?.directoryLabel,
    contact?.directoryLabel,
    guest?.directoryLabel,
    group.person ? personDefaultRoles(group.person, personList, partyNames, familyNames)[0] : null,
    group.guests.length ? "Guest" : null,
    lists.includes("vendors") ? "Vendor" : null,
    groupKind === "party" ? "Wedding party" : null,
  ]);
  const isDayOfContact =
    resolveIsDayOfContact({
      isDayOfContact: group.person?.isDayOfContact,
      directoryList: group.person?.directoryList,
    }) ||
    resolveIsDayOfContact({
      isDayOfContact: contact?.isDayOfContact,
      directoryList: contact?.directoryList,
    }) ||
    resolveIsDayOfContact({ isDayOfContact: guest?.isDayOfContact });

  return withIdentityIds({
    profileId: group.person
      ? profileIdForPerson(group.person.id)
      : contact
        ? profileIdForContact(contact.id)
        : guest
          ? profileIdForGuestPerson(guest.id)
          : profileIdForPerson(group.personId),
    personId: group.person ? group.person.id : null,
    contactId: contact?.id ?? null,
    guestPersonId: guest?.id ?? null,
    name,
    subtitle:
      group.person?.directoryLabel?.trim() ||
      contact?.directoryLabel?.trim() ||
      vendorSubtitle(contact?.name ?? "") ||
      guest?.householdLabel ||
      roles[0] ||
      null,
    photoSrc: contact?.photoData?.trim() || guest?.photoData?.trim() || null,
    group: lists.includes("vendors") && !lists.includes("guests") ? "vendor" : groupKind,
    roles: roles.length ? roles : ["Guest"],
    phone: contact?.phone ?? null,
    email: contact?.email ?? null,
    address: guest?.address?.trim() || null,
    rsvpLabel: guest?.rsvpLabel?.trim() || null,
    tableLabel: guest?.tableLabel?.trim() || null,
    sortKey: normalizePersonName(name),
    primaryList,
    lists,
    isDayOfContact,
  });
}

export function buildDirectoryEntries(input: RawPeopleDirectoryInput): DirectoryEntry[] {
  const { party, family } = mealGuestsByGroup();
  const partyNames = party.map((row) => row.name);
  const familyNames = family.map((row) => row.name);
  const personById = new Map(input.persons.map((person) => [person.id, person]));
  const groups = new Map<string, LinkedDirectoryGroup>();
  const linkedContactIds = new Set<string>();
  const linkedGuestIds = new Set<string>();

  function ensureGroup(personId: string): LinkedDirectoryGroup {
    const existing = groups.get(personId);
    if (existing) return existing;
    const created: LinkedDirectoryGroup = {
      personId,
      person: personById.get(personId),
      contacts: [],
      guests: [],
    };
    groups.set(personId, created);
    return created;
  }

  for (const contact of input.contacts) {
    if (!contact.personId) continue;
    ensureGroup(contact.personId).contacts.push(contact);
    linkedContactIds.add(contact.id);
  }
  for (const guest of input.guestPeople) {
    if (!guest.personId) continue;
    ensureGroup(guest.personId).guests.push(guest);
    linkedGuestIds.add(guest.id);
  }
  for (const person of input.persons) {
    if (resolvePrimaryList({ kind: "person", directoryList: person.directoryList })) {
      ensureGroup(person.id).person = person;
    }
  }

  const entries: DirectoryEntry[] = [];
  const unlinkedClaimed = new Set<string>();

  function claimUnlinked(name: string) {
    unlinkedClaimed.add(normalizePersonName(name));
  }
  function isUnlinkedClaimed(name: string) {
    return [...unlinkedClaimed].some((existing) => namesMatch(existing, name));
  }

  const emittedPersonIds = new Set<string>();
  for (const group of groups.values()) {
    const listed = group.person
      ? resolvePrimaryList({ kind: "person", directoryList: group.person.directoryList })
      : null;
    if (!group.contacts.length && !group.guests.length && !listed) continue;
    entries.push(buildLinkedDirectoryEntry(group, partyNames, familyNames));
    emittedPersonIds.add(group.personId);
  }

  for (const contact of input.contacts) {
    if (linkedContactIds.has(contact.id)) continue;
    entries.push(buildContactDirectoryEntry(contact));
    claimUnlinked(contact.name);
  }

  for (const guest of input.guestPeople) {
    if (linkedGuestIds.has(guest.id)) continue;
    if (isUnlinkedClaimed(guest.name)) continue;
    entries.push(buildGuestDirectoryEntry(guest, partyNames, familyNames));
    claimUnlinked(guest.name);
  }

  for (const person of input.persons) {
    if (emittedPersonIds.has(person.id)) continue;
    const entry = buildPersonDirectoryEntry(person, partyNames, familyNames);
    if (!entry) continue;
    entries.push(entry);
  }

  return entries.sort(directoryEntrySort);
}

export function filterDirectoryEntries(entries: DirectoryEntry[], query: string): DirectoryEntry[] {
  const needle = normalizePersonName(query);
  if (!needle) return entries;
  return entries.filter((entry) => {
    const haystack = normalizePersonName(
      [
        entry.name,
        entry.subtitle,
        entry.roles.join(" "),
        entry.phone,
        entry.email,
        entry.address,
        entry.rsvpLabel,
        entry.tableLabel,
      ]
        .filter(Boolean)
        .join(" "),
    );
    return haystack.includes(needle);
  });
}

export function groupDirectoryEntries(entries: DirectoryEntry[], group: PeopleGroup) {
  return entries.filter((entry) => entry.group === group);
}

/** @deprecated Use filterEntriesByTab */
export function filterDirectoryByList(entries: DirectoryEntry[], tab: PeopleTab): DirectoryEntry[] {
  return filterEntriesByTab(entries, tab);
}

/** @deprecated Use filterEntriesByTab */
export function filterDirectoryByKind(entries: DirectoryEntry[], tab: PeopleTab): DirectoryEntry[] {
  return filterEntriesByTab(entries, tab);
}

/** @deprecated Use PeopleTab */
export type PeopleFilter = PeopleTab;
