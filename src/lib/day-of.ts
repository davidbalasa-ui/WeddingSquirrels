/**
 * Day-of schedule position and composition.
 *
 * DATE/PHASE → src/lib/wedding-phase.ts
 * TIME OF DAY → wedding-local minutes + existing TimelineBlock dayOffset
 * SEQUENCE → sortOrder after timed parse (sortTimelineBlocks)
 *
 * startAt inclusive, endAt exclusive.
 * A wedding minute may have 0, 1, or many active blocks (activeBlocks).
 *
 * Missing endAt does not invent a duration. The block stays current until
 * the next timed start that is STRICTLY LATER than this block's start.
 * A same-start parallel block does not close an open-ended block.
 * A later start on the shared timeline still does — there is no track model.
 *
 * After-midnight times (12:00–4:59 AM) use dayOffset 1 via parseDayOfTime.
 * sortOrder/dayOffset remain the sequence — 12:30 AM is never sorted before 10:00 AM.
 *
 * Need Someone uses stored Contact rows + sortOrder / isDayOfContact.
 * It does not infer vendors from notes or names.
 *
 * Your responsibilities use DayAssignmentAssignee + PinAccount.linkedPersonId only.
 */

import { personProfileHref } from "@/lib/entity-links";
import { parseBlockNotes } from "@/lib/day-of-now";
import {
  parseDayOfTime,
  parsedTimeFields,
  sortTimelineBlocks,
} from "@/lib/day-of-time";
import {
  calendarDateKey,
  getWeddingPhase,
  instantOnCalendarDate,
  type WeddingPhase,
  type WeddingPhaseInfo,
} from "@/lib/wedding-phase";

export type DayOfMode = "preview" | "live" | "completed";

export type DayOfPositionKind =
  | "empty"
  | "before_first"
  | "during"
  | "between"
  | "after_final";

export type DayOfBlock = {
  id: string;
  startAt: string;
  endAt: string | null;
  notes: string;
  startMinutes: number | null;
  endMinutes: number | null;
  dayOffset: number;
  sortOrder: number;
};

export type DayOfMoment = {
  id: string;
  title: string;
  timeLabel: string;
  startAt: string;
  endAt: string | null;
  location: string | null;
  detailLines: string[];
  startKey: number | null;
};

export type DayOfContact = {
  id: string;
  name: string;
  context: string | null;
  phone: string | null;
  email: string | null;
  photoSrc: string | null;
  personId: string | null;
  profileHref: string | null;
};

export type DayOfResponsibility = {
  id: string;
  title: string;
  notes: string | null;
  personId: string;
  personHref: string;
};

export type DayOfSchedulePosition = {
  kind: DayOfPositionKind;
  /** First active block in wedding sequence. Alias of nowBlocks[0]. */
  now: DayOfMoment | null;
  /** First block in the nearest future-start group. Alias of nextBlocks[0]. */
  next: DayOfMoment | null;
  /** First block in the start group after NEXT. Alias of afterNextBlocks[0]. */
  afterNext: DayOfMoment | null;
  /** Every block whose existing temporal rules say it is active right now. */
  nowBlocks: DayOfMoment[];
  /** Every block that shares the nearest future start after nowKey. */
  nextBlocks: DayOfMoment[];
  /** Every block that shares the next distinct start after the NEXT group. */
  afterNextBlocks: DayOfMoment[];
  laterToday: DayOfMoment[];
  fullDay: DayOfMoment[];
  minutesUntilNext: number | null;
  nowKey: number;
};

export type DayOfView = {
  mode: DayOfMode;
  phase: WeddingPhase;
  timezone: string;
  coupleNames: string | null;
  weddingDateLabel: string | null;
  clockLabel: string;
  generatedAt: string;
  position: DayOfSchedulePosition;
  responsibilities: DayOfResponsibility[];
  contacts: DayOfContact[];
};

export type DayOfContactInput = {
  id: string;
  name: string;
  personName?: string | null;
  directoryLabel?: string | null;
  phone: string | null;
  email: string | null;
  photoData?: string | null;
  sortOrder?: number;
  isDayOfContact?: boolean;
  personId?: string | null;
};

export type DayOfAssignmentInput = {
  id: string;
  title: string;
  notes: string | null;
  sortOrder?: number;
  assignees: Array<{ personId: string }>;
};

export type DayOfExperienceSource = {
  generatedAt: string;
  freezeClock: boolean;
  timezone: string;
  weddingDateIso: string | null;
  coupleNames: string | null;
  weddingDateLabel: string | null;
  blocks: DayOfBlock[];
  contacts: DayOfContactInput[];
  assignments: DayOfAssignmentInput[];
  linkedPersonId: string | null;
  canSeeContacts: boolean;
};

const CONTACT_LIMIT = 6;
const LATE_NIGHT_END_MINUTES = 5 * 60;

export function formatWeddingDateLabel(date: Date, timeZone: string): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone,
  });
}

export function formatWeddingClock(now: Date, timeZone: string): string {
  return now.toLocaleTimeString("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });
}

export function weddingLocalClockParts(
  now: Date,
  timeZone: string,
): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  return {
    hour: Number(parts.find((part) => part.type === "hour")?.value ?? 0),
    minute: Number(parts.find((part) => part.type === "minute")?.value ?? 0),
  };
}

/** Wedding-local minute key, including after-midnight dayOffset 1 before 5:00 AM. */
export function weddingLocalMinuteKey(now: Date, timeZone: string): number {
  const { hour, minute } = weddingLocalClockParts(now, timeZone);
  const minutes = hour * 60 + minute;
  const dayOffset = minutes < LATE_NIGHT_END_MINUTES ? 1 : 0;
  return dayOffset * 1440 + minutes;
}

export function resolveDayOfMode(phase: WeddingPhase, now: Date, timeZone: string): DayOfMode {
  if (phase === "wedding_day") return "live";
  if (phase === "post_wedding") {
    const { hour } = weddingLocalClockParts(now, timeZone);
    if (hour < 5) return "live";
    return "completed";
  }
  return "preview";
}

export function parseDayOfAsOf(
  raw: string | undefined,
  timeZone: string,
  env: string = process.env.NODE_ENV ?? "development",
): Date | undefined {
  if (!raw || env === "production") return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return instantOnCalendarDate(raw, timeZone);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function toDayOfBlock(row: {
  id: string;
  startAt: string;
  endAt: string | null;
  notes: string;
  startMinutes?: number | null;
  endMinutes?: number | null;
  dayOffset?: number;
  sortOrder?: number;
}): DayOfBlock {
  const parsed = parsedTimeFields(row.startAt, row.endAt);
  return {
    id: row.id,
    startAt: row.startAt,
    endAt: row.endAt,
    notes: row.notes,
    startMinutes: row.startMinutes ?? parsed.startMinutes,
    endMinutes: row.endMinutes ?? parsed.endMinutes,
    dayOffset: row.dayOffset ?? parsed.dayOffset,
    sortOrder: row.sortOrder ?? 0,
  };
}

export function blockStartKey(block: DayOfBlock): number | null {
  if (block.startMinutes != null) {
    return block.dayOffset * 1440 + block.startMinutes;
  }
  const parsed = parseDayOfTime(block.startAt);
  if (parsed.kind !== "timed") return null;
  return parsed.dayOffset * 1440 + parsed.minutes;
}

export function blockEndKey(block: DayOfBlock): number | null {
  if (block.endMinutes != null) {
    const offset = block.endMinutes < LATE_NIGHT_END_MINUTES ? 1 : block.dayOffset;
    return offset * 1440 + block.endMinutes;
  }
  if (!block.endAt) return null;
  const parsed = parseDayOfTime(block.endAt);
  if (parsed.kind !== "timed") return null;
  return parsed.dayOffset * 1440 + parsed.minutes;
}

function toMoment(block: DayOfBlock): DayOfMoment {
  const parsed = parseBlockNotes(block.notes);
  const startKey = blockStartKey(block);
  return {
    id: block.id,
    title: parsed.title,
    timeLabel: block.endAt?.trim() ? `${block.startAt} – ${block.endAt}` : block.startAt,
    startAt: block.startAt,
    endAt: block.endAt,
    location: parsed.location,
    detailLines: parsed.detailLines.filter((line) => !/^location:/i.test(line)),
    startKey,
  };
}

function nextDistinctStartAfter(blocks: DayOfBlock[], afterStart: number): number | null {
  let nextStart: number | null = null;
  for (const block of blocks) {
    const start = blockStartKey(block);
    if (start == null || start <= afterStart) continue;
    if (nextStart == null || start < nextStart) nextStart = start;
  }
  return nextStart;
}

function blocksWithStart(blocks: DayOfBlock[], startKey: number): DayOfBlock[] {
  return blocks.filter((block) => blockStartKey(block) === startKey);
}

/**
 * A block is active when startAt is inclusive and endAt is exclusive.
 * Missing endAt stays active until the next start that is strictly later
 * than this block — not merely the next row in the sorted array.
 */
export function isBlockActive(block: DayOfBlock, allBlocks: DayOfBlock[], nowKey: number): boolean {
  const start = blockStartKey(block);
  if (start == null || nowKey < start) return false;
  const end = blockEndKey(block);
  if (end != null) return nowKey < end;
  const closeAt = nextDistinctStartAfter(allBlocks, start);
  if (closeAt != null) return nowKey < closeAt;
  return true;
}

function emptyFeatured(nowKey: number, fullDay: DayOfMoment[]): Omit<DayOfSchedulePosition, "kind"> {
  return {
    now: null,
    next: null,
    afterNext: null,
    nowBlocks: [],
    nextBlocks: [],
    afterNextBlocks: [],
    laterToday: [],
    fullDay,
    minutesUntilNext: null,
    nowKey,
  };
}

export function positionDayOfSchedule(
  blocks: DayOfBlock[],
  opts: { now: Date; timezone: string },
): DayOfSchedulePosition {
  const sorted = sortTimelineBlocks(blocks);
  const timed = sorted.filter((block) => blockStartKey(block) != null);
  const nowKey = weddingLocalMinuteKey(opts.now, opts.timezone);
  const fullDay = sorted.map(toMoment);

  if (timed.length === 0) {
    return { kind: "empty", ...emptyFeatured(nowKey, fullDay) };
  }

  const nowBlocks = timed.filter((block) => isBlockActive(block, timed, nowKey));
  const future = timed.filter((block) => (blockStartKey(block) ?? -1) > nowKey);
  const nextStart = future[0] ? blockStartKey(future[0]) : null;
  const nextBlocks = nextStart != null ? blocksWithStart(future, nextStart) : [];
  const afterFuture = nextStart != null
    ? future.filter((block) => (blockStartKey(block) ?? -1) > nextStart)
    : [];
  const afterStart = afterFuture[0] ? blockStartKey(afterFuture[0]) : null;
  const afterNextBlocks = afterStart != null ? blocksWithStart(afterFuture, afterStart) : [];

  let kind: DayOfPositionKind;
  if (nowBlocks.length > 0) {
    kind = "during";
  } else if (nextBlocks.length === 0) {
    kind = "after_final";
  } else {
    const earliestStart = blockStartKey(timed[0]!);
    kind = earliestStart === nextStart ? "before_first" : "between";
  }

  const featured = new Set<string>(
    [...nowBlocks, ...nextBlocks, ...afterNextBlocks].map((block) => block.id),
  );
  const laterToday = timed
    .filter((block) => !featured.has(block.id) && (blockStartKey(block) ?? -1) > nowKey)
    .map(toMoment);

  const until = nextStart != null ? nextStart - nowKey : null;
  const nowMoments = nowBlocks.map(toMoment);
  const nextMoments = nextBlocks.map(toMoment);
  const afterMoments = afterNextBlocks.map(toMoment);

  return {
    kind,
    now: nowMoments[0] ?? null,
    next: nextMoments[0] ?? null,
    afterNext: afterMoments[0] ?? null,
    nowBlocks: nowMoments,
    nextBlocks: nextMoments,
    afterNextBlocks: afterMoments,
    laterToday,
    fullDay,
    minutesUntilNext: until != null && until > 0 ? until : null,
    nowKey,
  };
}

export function formatMinutesUntil(minutes: number | null): string | null {
  if (minutes == null || minutes <= 0) return null;
  if (minutes === 1) return "In 1 minute";
  if (minutes < 60) return `In ${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return hours === 1 ? "In 1 hour" : `In ${hours} hours`;
  return `In ${hours} hr ${rest} min`;
}

export function contactChannelHref(value: string, kind: "tel" | "sms" | "mailto"): string {
  if (kind === "mailto") return `mailto:${value.trim()}`;
  return `${kind}:${value.replace(/[^\d+]/g, "")}`;
}

export function pickDayOfContacts(contacts: DayOfContactInput[]): DayOfContact[] {
  const flagged = contacts.filter((contact) => contact.isDayOfContact);
  const source = flagged.length > 0 ? flagged : contacts;
  const ordered = [...source].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id),
  );
  return ordered.slice(0, CONTACT_LIMIT).map((contact) => {
    const personId = contact.personId ?? null;
    const name = contact.personName?.trim() || contact.name;
    return {
      id: contact.id,
      name,
      context: contact.directoryLabel?.trim() || null,
      phone: contact.phone,
      email: contact.email,
      photoSrc: contact.photoData ?? null,
      personId,
      profileHref: personId ? personProfileHref(personId) : null,
    };
  });
}

export function pickResponsibilities(
  assignments: DayOfAssignmentInput[],
  linkedPersonId: string | null,
): DayOfResponsibility[] {
  if (!linkedPersonId) return [];
  return assignments
    .filter((assignment) => assignment.assignees.some((row) => row.personId === linkedPersonId))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.title.localeCompare(b.title))
    .map((assignment) => ({
      id: assignment.id,
      title: assignment.title,
      notes: assignment.notes,
      personId: linkedPersonId,
      personHref: personProfileHref(linkedPersonId),
    }));
}

function restingPosition(position: DayOfSchedulePosition): DayOfSchedulePosition {
  return {
    ...position,
    kind: position.fullDay.length === 0 ? "empty" : position.kind,
    now: null,
    next: null,
    afterNext: null,
    nowBlocks: [],
    nextBlocks: [],
    afterNextBlocks: [],
    laterToday: [],
    minutesUntilNext: null,
  };
}

export function composeDayOfView(input: {
  phase: WeddingPhaseInfo;
  now: Date;
  coupleNames: string | null;
  weddingDateLabel: string | null;
  blocks: DayOfBlock[];
  contacts: DayOfContactInput[];
  assignments: DayOfAssignmentInput[];
  linkedPersonId: string | null;
  canSeeContacts: boolean;
}): DayOfView {
  const mode = resolveDayOfMode(input.phase.phase, input.now, input.phase.timezone);
  const livePosition = positionDayOfSchedule(input.blocks, {
    now: input.now,
    timezone: input.phase.timezone,
  });
  const position: DayOfSchedulePosition =
    mode === "live"
      ? livePosition
      : {
          ...restingPosition(livePosition),
          kind: mode === "completed" ? "after_final" : "empty",
        };

  return {
    mode,
    phase: input.phase.phase,
    timezone: input.phase.timezone,
    coupleNames: input.coupleNames,
    weddingDateLabel: input.weddingDateLabel,
    clockLabel: formatWeddingClock(input.now, input.phase.timezone),
    generatedAt: input.now.toISOString(),
    position,
    responsibilities: pickResponsibilities(input.assignments, input.linkedPersonId),
    contacts: input.canSeeContacts ? pickDayOfContacts(input.contacts) : [],
  };
}

export function viewFromExperienceSource(
  source: DayOfExperienceSource,
  now: Date,
): DayOfView {
  const weddingDate = source.weddingDateIso ? new Date(source.weddingDateIso) : null;
  const phase = getWeddingPhase({
    weddingDate,
    timezone: source.timezone,
    now,
  });
  return composeDayOfView({
    phase,
    now,
    coupleNames: source.coupleNames,
    weddingDateLabel: source.weddingDateLabel,
    blocks: source.blocks,
    contacts: source.contacts,
    assignments: source.assignments,
    linkedPersonId: source.linkedPersonId,
    canSeeContacts: source.canSeeContacts,
  });
}

export { calendarDateKey, getWeddingPhase };
