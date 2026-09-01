import { MEAL_SECTIONS } from "@/lib/meals";

export type PeopleGroup = "party" | "family" | "vendor";

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
};

export const PARTY_SECTION_IDS = new Set(["party", "officiant", "ceremony"]);
export const FAMILY_SECTION_IDS = new Set(["groom", "bride"]);

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
  persons: { id: string; name: string }[];
  contacts: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    photoData: string | null;
  }[];
  guestPeople: { id: string; name: string; householdLabel: string }[];
};

export function buildDirectoryEntries(input: RawPeopleDirectoryInput): DirectoryEntry[] {
  const entries: DirectoryEntry[] = [];
  const claimed = new Set<string>();
  const { party, family } = mealGuestsByGroup();
  const partyNames = party.map((guest) => guest.name);
  const familyNames = family.map((guest) => guest.name);

  for (const contact of input.contacts) {
    entries.push({
      profileId: profileIdForContact(contact.id),
      name: contact.name,
      subtitle: vendorSubtitle(contact.name),
      photoSrc: contact.photoData,
      group: "vendor",
      roles: ["Vendor"],
      phone: contact.phone,
      email: contact.email,
      sortKey: normalizePersonName(contact.name),
    });
    claimed.add(normalizePersonName(contact.name));
  }

  for (const person of input.persons) {
    const group = classifyNameGroup(person.name, partyNames, familyNames);
    const roles =
      group === "party"
        ? ["Wedding party"]
        : ["david", "haley"].includes(person.id)
          ? ["Couple"]
          : ["Family & helpers"];
    entries.push({
      profileId: profileIdForPerson(person.id),
      name: person.name,
      subtitle: roles[0] ?? null,
      photoSrc: null,
      group,
      roles,
      phone: null,
      email: null,
      sortKey: normalizePersonName(person.name),
    });
    claimed.add(normalizePersonName(person.name));
  }

  for (const guest of input.guestPeople) {
    const key = normalizePersonName(guest.name);
    if ([...claimed].some((name) => namesMatch(name, guest.name))) continue;
    const group = classifyNameGroup(guest.name, partyNames, familyNames);
    entries.push({
      profileId: profileIdForGuestPerson(guest.id),
      name: guest.name,
      subtitle: guest.householdLabel,
      photoSrc: null,
      group,
      roles: group === "party" ? ["Wedding party"] : ["Guest"],
      phone: null,
      email: null,
      sortKey: key,
    });
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
