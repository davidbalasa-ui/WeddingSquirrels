import { MEAL_SECTIONS } from "@/lib/meals";

export type PeopleGroup = "party" | "family" | "vendor";
/** Guest list or vendor list — the two primary roles. */
export type PeoplePrimaryList = "guests" | "vendors";
/** Tabs on the unified People page. */
export type PeopleTab = "guests" | "vendors" | "day-of";

export type DirectoryEntry = {
  profileId: string;
  name: string;
  subtitle: string | null;
  photoSrc: string | null;
  group: PeopleGroup;
  roles: string[];
  phone: string | null;
  email: string | null;
  sortKey: string;
  primaryList: PeoplePrimaryList | null;
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
  if (raw === "guests" || raw === "vendors" || raw === "day-of") return raw;
  return null;
}

/** Resolve guest vs vendor primary list. Returns null when not explicitly assigned. */
export function resolvePrimaryList(input: {
  kind: "person" | "contact" | "guest";
  directoryList?: string | null;
}): PeoplePrimaryList | null {
  if (input.directoryList === "guests") return "guests";
  if (input.directoryList === "vendors") return "vendors";
  if (input.kind === "guest") return "guests";
  if (input.kind === "contact") return "vendors";
  return null;
}

export function resolveIsDayOfContact(input: {
  isDayOfContact?: boolean | null;
  name: string;
  kind: "person" | "contact" | "guest";
  directoryList?: string | null;
}): boolean {
  if (input.isDayOfContact) return true;
  if (input.directoryList === "day-of") return true;
  if (input.kind === "person" && isDayOfContactName(input.name)) return true;
  return false;
}

export function filterEntriesByTab(entries: DirectoryEntry[], tab: PeopleTab): DirectoryEntry[] {
  if (tab === "day-of") return entries.filter((entry) => entry.isDayOfContact);
  return entries.filter((entry) => entry.primaryList === tab);
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
  }[];
};

export function buildDirectoryEntries(input: RawPeopleDirectoryInput): DirectoryEntry[] {
  const entries: DirectoryEntry[] = [];
  const claimed = new Set<string>();
  const { party, family } = mealGuestsByGroup();
  const partyNames = party.map((guest) => guest.name);
  const familyNames = family.map((guest) => guest.name);

  for (const contact of input.contacts) {
    const primaryList = resolvePrimaryList({ kind: "contact", directoryList: contact.directoryList });
    const isDayOfContact = resolveIsDayOfContact({
      isDayOfContact: contact.isDayOfContact,
      name: contact.name,
      kind: "contact",
      directoryList: contact.directoryList,
    });
    const roles = contact.directoryLabel?.trim()
      ? [contact.directoryLabel.trim()]
      : primaryList === "vendors"
        ? ["Vendor"]
        : ["Guest"];
    const entry: DirectoryEntry = {
      profileId: profileIdForContact(contact.id),
      name: contact.name,
      subtitle: contact.directoryLabel?.trim() || vendorSubtitle(contact.name),
      photoSrc: contact.photoData,
      group: primaryList === "vendors" ? "vendor" : "family",
      roles,
      phone: contact.phone,
      email: contact.email,
      sortKey: normalizePersonName(contact.name),
      primaryList,
      isDayOfContact,
    };
    entries.push(entry);
    claimed.add(normalizePersonName(contact.name));
  }

  for (const person of input.persons) {
    const primaryList = resolvePrimaryList({ kind: "person", directoryList: person.directoryList });
    const isDayOfContact = resolveIsDayOfContact({
      isDayOfContact: person.isDayOfContact,
      name: person.name,
      kind: "person",
      directoryList: person.directoryList,
    });
    if (!person.directoryList && !isDayOfContact) continue;

    const group = classifyNameGroup(person.name, partyNames, familyNames);
    const defaultRoles =
      group === "party"
        ? ["Wedding party"]
        : ["david", "haley"].includes(person.id)
          ? ["Couple"]
          : primaryList === "vendors"
            ? ["Vendor"]
            : ["Guest"];
    const roles = person.directoryLabel?.trim() ? [person.directoryLabel.trim()] : defaultRoles;
    const entry: DirectoryEntry = {
      profileId: profileIdForPerson(person.id),
      name: person.name,
      subtitle: person.directoryLabel?.trim() || roles[0] || null,
      photoSrc: null,
      group: primaryList === "vendors" ? "vendor" : group,
      roles,
      phone: null,
      email: null,
      sortKey: normalizePersonName(person.name),
      primaryList,
      isDayOfContact,
    };
    entries.push(entry);
    claimed.add(normalizePersonName(person.name));
  }

  for (const guest of input.guestPeople) {
    const key = normalizePersonName(guest.name);
    if ([...claimed].some((name) => namesMatch(name, guest.name))) continue;
    const group = classifyNameGroup(guest.name, partyNames, familyNames);
    const defaultRole = group === "party" ? "Wedding party" : "Guest";
    const roles = guest.directoryLabel?.trim() ? [guest.directoryLabel.trim()] : [defaultRole];
    const isDayOfContact = resolveIsDayOfContact({
      isDayOfContact: guest.isDayOfContact,
      name: guest.name,
      kind: "guest",
    });
    const entry: DirectoryEntry = {
      profileId: profileIdForGuestPerson(guest.id),
      name: guest.name,
      subtitle: guest.householdLabel,
      photoSrc: null,
      group,
      roles,
      phone: null,
      email: null,
      sortKey: key,
      primaryList: "guests",
      isDayOfContact,
    };
    entries.push(entry);
    claimed.add(key);
  }

  return entries.sort(directoryEntrySort);
}

export function filterDirectoryEntries(entries: DirectoryEntry[], query: string): DirectoryEntry[] {
  const needle = normalizePersonName(query);
  if (!needle) return entries;
  return entries.filter((entry) => {
    const haystack = normalizePersonName(
      [entry.name, entry.subtitle, entry.roles.join(" ")].filter(Boolean).join(" "),
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
