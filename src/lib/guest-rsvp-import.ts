import { parseRsvpStatus, type RsvpStatus } from "@/lib/guest-gifts";

export type CsvGuestRow = {
  firstName: string;
  lastName: string;
  party: string;
  notes: string;
  rsvp: string;
  thankYouSent: string;
  giftReceived: string;
};

export type CsvHousehold = {
  party: string;
  people: Array<{
    firstName: string;
    lastName: string;
    displayName: string;
    rsvp: PersonRsvp;
  }>;
};

export type PersonRsvp = "attending" | "not_attending" | "pending";

export type HouseholdRsvp = {
  rsvpStatus: RsvpStatus;
  invitedCount: number;
  acceptedCount: number;
};

export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export function parseGuestRsvpCsv(text: string): CsvGuestRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const columns = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header.trim()] = (columns[index] ?? "").trim();
    });
    return {
      firstName: row["First Name"] ?? "",
      lastName: row["Last Name"] ?? "",
      party: row["Party"] ?? "",
      notes: row["My Notes"] ?? "",
      rsvp: row["Wedding Day - RSVP"] ?? "",
      thankYouSent: row["Wedding Day - Thank You Sent"] ?? "",
      giftReceived: row["Wedding Day - Gift Received"] ?? "",
    };
  });
}

export function mapCsvRsvp(value: string): PersonRsvp {
  const normalized = value.trim().toLowerCase();
  if (normalized === "attending") return "attending";
  if (normalized === "regret" || normalized === "not attending") return "not_attending";
  return "pending";
}

function isGenericPlusOne(firstName: string, lastName: string): boolean {
  return `${firstName} ${lastName}`.trim().toLowerCase() === "plus one";
}

export function displayNameForCsvPerson(
  firstName: string,
  lastName: string,
  party: string,
  primaryName?: string,
): string {
  if (isGenericPlusOne(firstName, lastName)) {
    if (primaryName?.trim()) return `${primaryName.trim()} +1`;
    const simpleMatch = party.match(/^([^,&+]+)\s*(?:&|\+)\s*plus one$/i);
    if (simpleMatch) return `${simpleMatch[1].trim()} +1`;
    return "+1";
  }
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

export function groupCsvRowsByHousehold(rows: CsvGuestRow[]): CsvHousehold[] {
  const byParty = new Map<string, CsvHousehold>();
  for (const row of rows) {
    const party = row.party.trim();
    if (!party) continue;
    const household = byParty.get(party) ?? { party, people: [] };
    household.people.push({
      firstName: row.firstName.trim(),
      lastName: row.lastName.trim(),
      displayName: "",
      rsvp: mapCsvRsvp(row.rsvp),
    });
    byParty.set(party, household);
  }

  for (const household of byParty.values()) {
    const primaryPerson = household.people.find(
      (person) => !isGenericPlusOne(person.firstName, person.lastName),
    );
    const primaryName = primaryPerson
      ? `${primaryPerson.firstName} ${primaryPerson.lastName}`.trim()
      : undefined;
    for (const person of household.people) {
      person.displayName = displayNameForCsvPerson(
        person.firstName,
        person.lastName,
        household.party,
        primaryName,
      );
    }
  }

  return [...byParty.values()];
}

export function householdRsvpFromPeople(people: Array<{ rsvp: PersonRsvp }>): HouseholdRsvp {
  const invitedCount = people.length;
  const acceptedCount = people.filter((person) => person.rsvp === "attending").length;
  const allRegret = people.every((person) => person.rsvp === "not_attending");
  const allPending = people.every((person) => person.rsvp === "pending");
  const allAttending = acceptedCount === invitedCount && invitedCount > 0;

  let rsvpStatus: RsvpStatus;
  if (allRegret) rsvpStatus = "not_attending";
  else if (allPending) rsvpStatus = "pending";
  else if (allAttending) rsvpStatus = "attending";
  else if (acceptedCount > 0) rsvpStatus = "attending";
  else rsvpStatus = "pending";

  return { rsvpStatus, invitedCount, acceptedCount };
}

/** CSV "No Response" must not wipe a household that already replied. */
export function resolveImportedRsvp(
  incoming: HouseholdRsvp,
  existing?: { rsvpStatus: string; acceptedCount: number } | null,
): HouseholdRsvp {
  if (!existing) return incoming;
  const existingStatus = parseRsvpStatus(existing.rsvpStatus);
  if (incoming.rsvpStatus === "pending" && existingStatus !== "pending") {
    return {
      rsvpStatus: existingStatus,
      invitedCount: incoming.invitedCount,
      acceptedCount: existingStatus === "not_attending" ? 0 : existing.acceptedCount,
    };
  }
  return incoming;
}

export function normalizeNameToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const TOKEN_SKIP = new Set(["plus", "one", "family", "and", "the", "of"]);

export function meaningfulTokens(value: string): string[] {
  return normalizeNameToken(value)
    .split(" ")
    .filter((token) => token.length > 1 && !TOKEN_SKIP.has(token));
}

export function personMatchTokens(firstName: string, lastName: string): string[] {
  if (isGenericPlusOne(firstName, lastName)) return [];
  return meaningfulTokens(`${firstName} ${lastName}`);
}

export type GuestMatchRow = {
  id?: string;
  nameLine1: string;
  nameLine2: string | null;
  people: Array<{ name: string }>;
};

export function scoreGuestHouseholdMatch(household: CsvHousehold, guest: GuestMatchRow): number {
  const partyTokens = new Set<string>();
  for (const person of household.people) {
    for (const token of personMatchTokens(person.firstName, person.lastName)) {
      partyTokens.add(token);
    }
  }
  for (const token of meaningfulTokens(household.party)) {
    partyTokens.add(token);
  }
  if (partyTokens.size === 0) return 0;

  const guestNames = [
    guest.nameLine1,
    guest.nameLine2 ?? "",
    ...guest.people.map((person) => person.name),
  ].filter(Boolean);

  const guestTokens = new Set<string>();
  for (const name of guestNames) {
    for (const token of meaningfulTokens(name)) {
      guestTokens.add(token);
    }
  }

  let overlap = 0;
  for (const token of partyTokens) {
    if (guestTokens.has(token)) overlap += 1;
  }
  return overlap / partyTokens.size;
}

export function findBestGuestMatch(
  household: CsvHousehold,
  guests: GuestMatchRow[],
): GuestMatchRow | null {
  let best: { guest: GuestMatchRow; score: number } | null = null;
  for (const guest of guests) {
    const score = scoreGuestHouseholdMatch(household, guest);
    if (!best || score > best.score) {
      best = { guest, score };
    }
  }
  if (!best || best.score < 0.34) return null;
  return best.guest;
}

export function legacyGuestNames(people: Array<{ displayName: string }>): {
  nameLine1: string;
  nameLine2: string | null;
} {
  const names = people.map((person) => person.displayName.trim()).filter(Boolean);
  return {
    nameLine1: names[0] ?? "",
    nameLine2: names[1] ?? null,
  };
}
