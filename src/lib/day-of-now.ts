import { vendorPrimaryName } from "@/lib/connections";
import { formatClock, parseDayOfTime, sortTimelineBlocks } from "@/lib/day-of-time";
import { namesMatch, normalizePersonName, profileIdForContact, profileIdForPerson } from "@/lib/people-directory";

export type TimelineBlockInput = {
  id: string;
  startAt: string;
  endAt: string | null;
  notes: string;
  startMinutes: number | null;
  endMinutes: number | null;
  dayOffset: number;
  sortOrder: number;
};

export type ParsedBlockNotes = {
  title: string;
  detailLines: string[];
  location: string | null;
  involvedNames: string[];
};

export type BlockContact = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  photoSrc: string | null;
  profileId: string | null;
  source: "contact" | "person";
};

export type DayNowBlock = {
  id: string;
  startAt: string;
  endAt: string | null;
  timeLabel: string;
  title: string;
  detailLines: string[];
  location: string | null;
  contacts: BlockContact[];
  status: "now" | "next" | "upcoming";
};

export type DayNowNextSnapshot = {
  isWeddingDay: boolean;
  clockLabel: string;
  betweenMoments: boolean;
  now: DayNowBlock | null;
  next: DayNowBlock | null;
  upcoming: DayNowBlock[];
};

export function isWeddingDay(daysToGo: number | null): boolean {
  return daysToGo === 0;
}

export function shouldShowDayNowTab(daysToGo: number | null): boolean {
  return daysToGo !== null && daysToGo >= 0 && daysToGo <= 1;
}

function minuteKey(block: TimelineBlockInput): number | null {
  if (block.startMinutes != null) {
    return block.dayOffset * 1440 + block.startMinutes;
  }
  const parsed = parseDayOfTime(block.startAt);
  if (parsed.kind !== "timed") return null;
  return parsed.dayOffset * 1440 + parsed.minutes;
}

function endMinuteKey(block: TimelineBlockInput): number | null {
  if (block.endMinutes != null) {
    return block.dayOffset * 1440 + block.endMinutes;
  }
  if (!block.endAt) return null;
  const parsed = parseDayOfTime(block.endAt);
  if (parsed.kind !== "timed") return null;
  return parsed.dayOffset * 1440 + parsed.minutes;
}

export function nowMinuteKey(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

export function formatNowClock(now: Date): string {
  return formatClock(now.getHours() * 60 + now.getMinutes());
}

export function parseBlockNotes(notes: string): ParsedBlockNotes {
  const lines = notes
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const title = lines[0] ?? "Timeline moment";
  const detailLines: string[] = [];
  let location: string | null = null;
  const involvedNames: string[] = [];

  for (const line of lines.slice(1)) {
    const locationMatch = line.match(/^location:\s*(.+)$/i);
    if (locationMatch) {
      location = locationMatch[1]!.trim();
      continue;
    }

    detailLines.push(line);

    const bullet = line.match(/^[·•\-–—]\s*(.+)$/);
    if (bullet) {
      involvedNames.push(bullet[1]!.trim());
      continue;
    }

    const arrives = line.match(/^(.+?)\s+arrives?\s+at\b/i);
    if (arrives) {
      involvedNames.push(arrives[1]!.trim());
    }
  }

  return { title, detailLines, location, involvedNames };
}

function noteMentionsName(notes: string, involvedNames: string[], candidateName: string): boolean {
  const primary = vendorPrimaryName(candidateName);
  const normalized = normalizePersonName(primary);
  if (!normalized) return false;

  const haystack = normalizePersonName(notes);
  if (haystack.includes(normalized)) return true;

  return involvedNames.some((name) => namesMatch(name, primary));
}

function contactMentionedInNotes(
  notes: string,
  involvedNames: string[],
  contactName: string,
): boolean {
  if (noteMentionsName(notes, involvedNames, contactName)) return true;

  const primary = vendorPrimaryName(contactName);
  const role = contactName.includes("·") ? contactName.split("·")[1]?.trim() : null;
  const normalizedNotes = normalizePersonName(notes);

  if (role) {
    const normalizedRole = normalizePersonName(role);
    if (normalizedRole && normalizedNotes.includes(normalizedRole)) return true;
  }

  const first = normalizePersonName(primary).split(" ")[0] ?? "";
  if (first.length > 2) {
    if (normalizedNotes.includes(first)) return true;
    for (const name of involvedNames) {
      if (normalizePersonName(name).includes(first)) return true;
    }
  }

  return false;
}

export function matchBlockContacts(
  notes: string,
  contacts: Array<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    photoData: string | null;
  }>,
  people: Array<{ id: string; name: string }>,
): BlockContact[] {
  const { involvedNames } = parseBlockNotes(notes);
  const matched: BlockContact[] = [];
  const seen = new Set<string>();

  for (const contact of contacts) {
    if (!contactMentionedInNotes(notes, involvedNames, contact.name)) continue;
    const key = `contact:${contact.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    matched.push({
      id: contact.id,
      name: vendorPrimaryName(contact.name),
      phone: contact.phone,
      email: contact.email,
      photoSrc: contact.photoData,
      profileId: profileIdForContact(contact.id),
      source: "contact",
    });
  }

  for (const person of people) {
    if (!noteMentionsName(notes, involvedNames, person.name)) continue;
    const key = `person:${person.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    matched.push({
      id: person.id,
      name: person.name,
      phone: null,
      email: null,
      photoSrc: null,
      profileId: profileIdForPerson(person.id),
      source: "person",
    });
  }

  return matched.slice(0, 6);
}

function formatBlockTimeLabel(startAt: string, endAt: string | null): string {
  if (!endAt?.trim()) return startAt;
  return `${startAt} – ${endAt}`;
}

function toDayNowBlock(
  block: TimelineBlockInput,
  status: DayNowBlock["status"],
  contacts: BlockContact[],
): DayNowBlock {
  const parsed = parseBlockNotes(block.notes);
  return {
    id: block.id,
    startAt: block.startAt,
    endAt: block.endAt,
    timeLabel: formatBlockTimeLabel(block.startAt, block.endAt),
    title: parsed.title,
    detailLines: parsed.detailLines,
    location: parsed.location,
    contacts,
    status,
  };
}

export function pickNowNextBlocks(
  blocks: TimelineBlockInput[],
  opts: { now?: Date; upcomingLimit?: number } = {},
): {
  now: TimelineBlockInput | null;
  next: TimelineBlockInput | null;
  upcoming: TimelineBlockInput[];
  betweenMoments: boolean;
} {
  const sorted = sortTimelineBlocks(blocks);
  const timed = sorted.filter((block) => minuteKey(block) != null);
  const now = opts.now ?? new Date();
  const nowKey = nowMinuteKey(now);
  const upcomingLimit = opts.upcomingLimit ?? 3;

  let active: TimelineBlockInput | null = null;
  for (const block of timed) {
    const start = minuteKey(block)!;
    const end = endMinuteKey(block);
    if (start <= nowKey && (end == null || end > nowKey)) {
      active = block;
    }
  }

  const activeIndex = active ? timed.findIndex((block) => block.id === active!.id) : -1;
  const next =
    activeIndex >= 0
      ? (timed[activeIndex + 1] ?? null)
      : (timed.find((block) => minuteKey(block)! > nowKey) ?? null);

  const nextIndex = next ? timed.findIndex((block) => block.id === next.id) : -1;
  const upcoming =
    nextIndex >= 0 ? timed.slice(nextIndex + 1, nextIndex + 1 + upcomingLimit) : [];

  return {
    now: active,
    next,
    upcoming,
    betweenMoments: !active && next !== null,
  };
}

export function buildDayNowNextSnapshot(
  blocks: TimelineBlockInput[],
  contacts: Array<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    photoData: string | null;
  }>,
  people: Array<{ id: string; name: string }>,
  opts: { daysToGo: number | null; now?: Date; upcomingLimit?: number },
): DayNowNextSnapshot {
  const now = opts.now ?? new Date();
  const picked = pickNowNextBlocks(blocks, {
    now,
    upcomingLimit: opts.upcomingLimit,
  });

  const mapContacts = (block: TimelineBlockInput) =>
    matchBlockContacts(block.notes, contacts, people);

  return {
    isWeddingDay: isWeddingDay(opts.daysToGo),
    clockLabel: formatNowClock(now),
    betweenMoments: picked.betweenMoments,
    now: picked.now ? toDayNowBlock(picked.now, "now", mapContacts(picked.now)) : null,
    next: picked.next ? toDayNowBlock(picked.next, "next", mapContacts(picked.next)) : null,
    upcoming: picked.upcoming.map((block) =>
      toDayNowBlock(block, "upcoming", mapContacts(block)),
    ),
  };
}
