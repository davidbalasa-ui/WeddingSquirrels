import { normalizePersonName } from "@/lib/people-directory";

export type IdentitySource = "GuestPerson" | "Contact" | "MealGuest";
export type IdentityVerdict = "SAFE" | "REVIEW" | "UNMATCHED";

export type NamedIdentity = {
  id: string;
  name: string;
};

export type DuplicatePersonGroup = {
  key: string;
  kind: "exact" | "first_token";
  people: NamedIdentity[];
};

export type IdentityMatchRow = {
  source: IdentitySource;
  id: string;
  name: string;
  verdict: IdentityVerdict;
  proposedPersonId: string | null;
  proposedPersonName: string | null;
  reason: string;
  candidatePersonIds: string[];
};

export type IdentityMatchReport = {
  persons: Array<NamedIdentity & { normalized: string }>;
  duplicatePersonCandidates: DuplicatePersonGroup[];
  matches: IdentityMatchRow[];
  counts: {
    persons: number;
    guestPeople: number;
    contacts: number;
    mealGuests: number;
    safe: number;
    review: number;
    unmatched: number;
    duplicatePersonGroups: number;
    firstNameOnlyPersons: number;
  };
};

export function identityNameTokens(name: string): string[] {
  return normalizePersonName(name).split(" ").filter(Boolean);
}

export function isFullIdentityName(name: string): boolean {
  return identityNameTokens(name).length >= 2;
}

export function identityFirstToken(name: string): string {
  return identityNameTokens(name)[0] ?? "";
}

export function findDuplicatePersonCandidates(persons: NamedIdentity[]): DuplicatePersonGroup[] {
  const exact = new Map<string, NamedIdentity[]>();
  const firstToken = new Map<string, NamedIdentity[]>();

  for (const person of persons) {
    const normalized = normalizePersonName(person.name);
    if (!normalized) continue;
    const exactGroup = exact.get(normalized) ?? [];
    exactGroup.push(person);
    exact.set(normalized, exactGroup);

    const token = identityFirstToken(person.name);
    if (token.length < 2) continue;
    const tokenGroup = firstToken.get(token) ?? [];
    tokenGroup.push(person);
    firstToken.set(token, tokenGroup);
  }

  const groups: DuplicatePersonGroup[] = [];
  for (const [key, people] of exact) {
    if (people.length > 1) groups.push({ key, kind: "exact", people });
  }
  for (const [key, people] of firstToken) {
    const uniqueIds = new Set(people.map((row) => row.id));
    if (uniqueIds.size < 2) continue;
    const uniqueNormalized = new Set(people.map((row) => normalizePersonName(row.name)));
    if (uniqueNormalized.size < 2) continue;
    groups.push({ key, kind: "first_token", people });
  }
  return groups;
}

export function proposeIdentityMatch(source: NamedIdentity, persons: NamedIdentity[]): Omit<
  IdentityMatchRow,
  "source"
> {
  const normalized = normalizePersonName(source.name);
  if (!normalized) {
    return {
      id: source.id,
      name: source.name,
      verdict: "UNMATCHED",
      proposedPersonId: null,
      proposedPersonName: null,
      reason: "empty name",
      candidatePersonIds: [],
    };
  }

  const exact = persons.filter((person) => normalizePersonName(person.name) === normalized);
  const token = identityFirstToken(source.name);
  const firstTokenHits =
    token.length >= 2
      ? persons.filter((person) => identityFirstToken(person.name) === token)
      : [];

  if (exact.length > 1) {
    return {
      id: source.id,
      name: source.name,
      verdict: "REVIEW",
      proposedPersonId: null,
      proposedPersonName: null,
      reason: "duplicate exact Person name",
      candidatePersonIds: exact.map((person) => person.id),
    };
  }

  if (exact.length === 1) {
    const person = exact[0]!;
    if (!isFullIdentityName(source.name) || !isFullIdentityName(person.name)) {
      const conflicting = firstTokenHits.length > 1;
      return {
        id: source.id,
        name: source.name,
        verdict: "REVIEW",
        proposedPersonId: conflicting ? null : person.id,
        proposedPersonName: conflicting ? null : person.name,
        reason: conflicting ? "conflicting first-name matches" : "first-name-only exact match",
        candidatePersonIds: firstTokenHits.map((row) => row.id),
      };
    }
    return {
      id: source.id,
      name: source.name,
      verdict: "SAFE",
      proposedPersonId: person.id,
      proposedPersonName: person.name,
      reason: "exact normalized full-name match",
      candidatePersonIds: [person.id],
    };
  }

  if (firstTokenHits.length === 1) {
    const person = firstTokenHits[0]!;
    return {
      id: source.id,
      name: source.name,
      verdict: "REVIEW",
      proposedPersonId: person.id,
      proposedPersonName: person.name,
      reason: "first-name or fuzzy match only",
      candidatePersonIds: [person.id],
    };
  }

  if (firstTokenHits.length > 1) {
    return {
      id: source.id,
      name: source.name,
      verdict: "REVIEW",
      proposedPersonId: null,
      proposedPersonName: null,
      reason: "ambiguous first-name matches",
      candidatePersonIds: firstTokenHits.map((person) => person.id),
    };
  }

  return {
    id: source.id,
    name: source.name,
    verdict: "UNMATCHED",
    proposedPersonId: null,
    proposedPersonName: null,
    reason: "no Person name match",
    candidatePersonIds: [],
  };
}

export function buildIdentityMatchReport(input: {
  persons: NamedIdentity[];
  guestPeople: NamedIdentity[];
  contacts: NamedIdentity[];
  mealGuests: NamedIdentity[];
}): IdentityMatchReport {
  const matches: IdentityMatchRow[] = [
    ...input.guestPeople.map((row) => ({
      source: "GuestPerson" as const,
      ...proposeIdentityMatch(row, input.persons),
    })),
    ...input.contacts.map((row) => ({
      source: "Contact" as const,
      ...proposeIdentityMatch(row, input.persons),
    })),
    ...input.mealGuests.map((row) => ({
      source: "MealGuest" as const,
      ...proposeIdentityMatch(row, input.persons),
    })),
  ];

  const duplicatePersonCandidates = findDuplicatePersonCandidates(input.persons);
  const firstNameOnlyPersons = input.persons.filter((person) => !isFullIdentityName(person.name));

  return {
    persons: input.persons.map((person) => ({
      ...person,
      normalized: normalizePersonName(person.name),
    })),
    duplicatePersonCandidates,
    matches,
    counts: {
      persons: input.persons.length,
      guestPeople: input.guestPeople.length,
      contacts: input.contacts.length,
      mealGuests: input.mealGuests.length,
      safe: matches.filter((row) => row.verdict === "SAFE").length,
      review: matches.filter((row) => row.verdict === "REVIEW").length,
      unmatched: matches.filter((row) => row.verdict === "UNMATCHED").length,
      duplicatePersonGroups: duplicatePersonCandidates.length,
      firstNameOnlyPersons: firstNameOnlyPersons.length,
    },
  };
}

export function formatIdentityMatchReport(report: IdentityMatchReport): string {
  const lines: string[] = [
    "Identity match report (READ-ONLY — no backfill)",
    `Persons ${report.counts.persons} · GuestPerson ${report.counts.guestPeople} · Contact ${report.counts.contacts} · MealGuest ${report.counts.mealGuests}`,
    `SAFE ${report.counts.safe} · REVIEW ${report.counts.review} · UNMATCHED ${report.counts.unmatched} · duplicate Person groups ${report.counts.duplicatePersonGroups}`,
    `First-name-only Person records ${report.counts.firstNameOnlyPersons} (cannot be SAFE targets)`,
    "",
    "Persons",
  ];
  for (const person of report.persons) {
    const flag = isFullIdentityName(person.name) ? "" : " [FIRST-NAME-ONLY]";
    lines.push(`  ${person.id} | ${person.name} | ${person.normalized}${flag}`);
  }

  lines.push("", "Duplicate Person candidates");
  if (report.duplicatePersonCandidates.length === 0) {
    lines.push("  none");
  }
  for (const group of report.duplicatePersonCandidates) {
    lines.push(`  [${group.kind}] ${group.key}`);
    for (const person of group.people) {
      lines.push(`    ${person.id} | ${person.name}`);
    }
  }

  lines.push("", "Proposed links");
  for (const row of report.matches) {
    const proposed = row.proposedPersonId
      ? `${row.proposedPersonId} (${row.proposedPersonName})`
      : "none";
    lines.push(
      `  ${row.verdict} | ${row.source} ${row.id} | ${row.name} → ${proposed} | ${row.reason}`,
    );
  }

  return lines.join("\n");
}
