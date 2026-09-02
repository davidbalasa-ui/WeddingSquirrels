import { MEAL_SECTIONS } from "@/lib/meals";

export type PeopleGroup = "party" | "family" | "vendor";
/** Guest list or vendor list — the two primary roles. */
export type PeoplePrimaryList = "guests" | "vendors";
/** Tabs on the unified People page. */
export type PeopleTab = "guests" | "vendors" | "day-of" | "all";

export type PeopleSort = "name" | "role" | "rsvp" | "table";

export type DirectoryEntry = {
  profileId: string;
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
  if (tab === "day-of") {
    return entries.filter(
      (entry) =>
        entry.isDayOfContact && (entry.primaryList === "guests" || entry.primaryList === "vendors"),
    );
  }
  return entries.filter((entry) => entry.primaryList === tab);
}

export function sourceListLabel(list: PeoplePrimaryList | null): string | null {
  if (list === "guests") return "Guest list";
  if (list === "vendors") return "Vendors";
  return null;
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
    photoData?: string | null;
    address?: string | null;
    rsvpLabel?: string | null;
    tableLabel?: string | null;
  }[];
};

export function buildDirectoryEntries(input: RawPeopleDirectoryInput): DirectoryEntry[] {
  const entries: DirectoryEntry[] = [];
  const claimed = new Set<string>();
  const { party, family } = mealGuestsByGroup();
  const partyNames = party.map((guest) => guest.name);
  const familyNames = family.map((guest) => guest.name);

  function claim(name: string) {
    claimed.add(normalizePersonName(name));
  }

  function isClaimed(name: string) {
    return [...claimed].some((existing) => namesMatch(existing, name));
  }

  for (const contact of input.contacts) {
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
    entries.push({
      profileId: profileIdForContact(contact.id),
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
      isDayOfContact,
    });
    claim(contact.name);
  }

  for (const guest of input.guestPeople) {
    if (isClaimed(guest.name)) continue;
    const group = classifyNameGroup(guest.name, partyNames, familyNames);
    const defaultRole = group === "party" ? "Wedding party" : "Guest";
    const roles = guest.directoryLabel?.trim() ? [guest.directoryLabel.trim()] : [defaultRole];
    entries.push({
      profileId: profileIdForGuestPerson(guest.id),
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
      isDayOfContact: resolveIsDayOfContact({ isDayOfContact: guest.isDayOfContact }),
    });
    claim(guest.name);
  }

  for (const person of input.persons) {
    const primaryList = resolvePrimaryList({ kind: "person", directoryList: person.directoryList });
    if (!primaryList) continue;
    if (isClaimed(person.name)) continue;

    const isDayOfContact = resolveIsDayOfContact({
      isDayOfContact: person.isDayOfContact,
      directoryList: person.directoryList,
    });
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
    entries.push({
      profileId: profileIdForPerson(person.id),
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
      isDayOfContact,
    });
    claim(person.name);
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
