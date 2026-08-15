/** 5:00 AM is morning (day 0). 12:00–4:59 AM is after midnight (day 1). */
export const AFTER_MIDNIGHT_END_MINUTES = 5 * 60;

export type ParsedDayOfTime =
  | { kind: "untimed"; raw: string }
  | {
      kind: "timed";
      raw: string;
      minutes: number;
      dayOffset: 0 | 1;
      display: string;
    };

export type TimelineFieldDraft = {
  startAt: string;
  endAt: string;
  notes: string;
};

export type TimelineSavePrep =
  | { ok: true; startAt: string; endAt: string | null; notes: string; revertedNotes: boolean }
  | { ok: false; reason: "empty_notes" | "noop"; revertNotes?: string };

export type TimelineCreatePrep =
  | { ok: true; startAt: string; endAt: string | null; notes: string }
  | { ok: false; reason: "invalid" };

export function isUntimedToken(raw: string): boolean {
  const value = raw.trim();
  if (!value) return true;
  return /^(tbd|\?+|-+|—+|–+|n\/?a|none|unknown)$/i.test(value);
}

export function formatClock(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const hour24 = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function dayOffsetForMinutes(minutes: number): 0 | 1 {
  return minutes < AFTER_MIDNIGHT_END_MINUTES ? 1 : 0;
}

function timed(raw: string, minutes: number): ParsedDayOfTime {
  return {
    kind: "timed",
    raw,
    minutes,
    dayOffset: dayOffsetForMinutes(minutes),
    display: formatClock(minutes),
  };
}

function untimed(raw: string): ParsedDayOfTime {
  return { kind: "untimed", raw };
}

/** Excel time serials look like 0.4375 (fraction of a day). */
function isExcelSerial(value: string): boolean {
  if (!/^\d+(\.\d+)?$/.test(value)) return false;
  const n = Number(value);
  return n >= 0 && n < 1.0000001 && value.includes(".");
}

function normalizeMeridiem(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/a\.?\s*m\.?/g, "am")
    .replace(/p\.?\s*m\.?/g, "pm");
}

export function parseDayOfTime(raw: string): ParsedDayOfTime {
  const original = raw.trim();
  if (isUntimedToken(original)) return untimed(original);
  if (isExcelSerial(original)) return untimed(original);

  const lowered = original.toLowerCase();
  if (lowered === "midnight") return timed(original, 0);
  if (lowered === "noon") return timed(original, 12 * 60);

  const normalized = normalizeMeridiem(original);
  const match = normalized.match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/);
  if (!match) return untimed(original);

  const hour = Number(match[1]);
  const minuteToken = match[2];
  const meridiem = match[3] as "am" | "pm" | undefined;
  const minute = minuteToken === undefined ? 0 : Number(minuteToken);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return untimed(original);
  if (minute < 0 || minute > 59) return untimed(original);

  if (meridiem) {
    if (hour < 0 || hour > 12) return untimed(original);
    if (hour === 0 && meridiem === "pm") return untimed(original);
    const hour12 = hour === 0 ? 12 : hour;
    let hour24 = hour12 % 12;
    if (meridiem === "pm") hour24 += 12;
    return timed(original, hour24 * 60 + minute);
  }

  // No AM/PM: only unambiguous 24-hour values count as timed.
  if (hour > 23) return untimed(original);
  const hasMinutes = minuteToken !== undefined;
  if (hour === 0 || hour >= 13) {
    return timed(original, hour * 60 + minute);
  }
  if (!hasMinutes) return untimed(original);
  return untimed(original);
}

export function compareParsedTimes(a: ParsedDayOfTime, b: ParsedDayOfTime): number {
  if (a.kind === "untimed" && b.kind === "untimed") return 0;
  if (a.kind === "untimed") return -1;
  if (b.kind === "untimed") return 1;
  if (a.dayOffset !== b.dayOffset) return a.dayOffset - b.dayOffset;
  return a.minutes - b.minutes;
}

export function endsBeforeStart(startRaw: string, endRaw: string): boolean {
  const start = parseDayOfTime(startRaw);
  const end = parseDayOfTime(endRaw);
  if (start.kind !== "timed" || end.kind !== "timed") return false;

  const overnight =
    end.minutes < start.minutes && start.minutes >= 12 * 60 && end.minutes < 12 * 60;
  if (overnight) return false;

  const startKey = start.dayOffset * 1440 + start.minutes;
  const endKey = end.dayOffset * 1440 + end.minutes;
  return endKey < startKey;
}

export function prepareTimelineSave(
  draft: TimelineFieldDraft,
  lastSaved: TimelineFieldDraft,
): TimelineSavePrep {
  const revertedNotes = draft.notes.trim().length === 0;
  const notes = revertedNotes ? lastSaved.notes.trim() : draft.notes.trim();
  if (!notes) {
    return { ok: false, reason: "empty_notes", revertNotes: lastSaved.notes };
  }

  const startAt = draft.startAt.trim() || lastSaved.startAt;
  const endAt = draft.endAt.trim() || null;

  if (
    startAt === lastSaved.startAt &&
    (endAt ?? "") === lastSaved.endAt.trim() &&
    notes === lastSaved.notes.trim()
  ) {
    return { ok: false, reason: "noop", revertNotes: revertedNotes ? lastSaved.notes : undefined };
  }

  return { ok: true, startAt, endAt, notes, revertedNotes };
}

export type DayOfBucket = "untimed" | "morning" | "afternoon" | "evening" | "after";

export const DAY_OF_BUCKETS: { id: DayOfBucket; label: string }[] = [
  { id: "untimed", label: "Untimed" },
  { id: "morning", label: "Morning" },
  { id: "afternoon", label: "Afternoon" },
  { id: "evening", label: "Evening" },
  { id: "after", label: "After midnight" },
];

export function bucketForTime(raw: string): DayOfBucket {
  const parsed = parseDayOfTime(raw);
  if (parsed.kind === "untimed") return "untimed";
  if (parsed.dayOffset === 1) return "after";
  if (parsed.minutes < 12 * 60) return "morning";
  if (parsed.minutes < 17 * 60) return "afternoon";
  return "evening";
}

export function missingMeridiem(raw: string): boolean {
  const normalized = normalizeMeridiem(raw);
  if (!/^\d{1,2}(?:[:.]\d{2})?$/.test(normalized)) return false;
  return parseDayOfTime(raw).kind === "untimed";
}

export type ClockMeridiem = "AM" | "PM";

export type ClockParts = {
  hour: string;
  minute: string;
  meridiem: ClockMeridiem;
};

export function clockPartsFromRaw(raw: string): ClockParts {
  const parsed = parseDayOfTime(raw);
  if (parsed.kind === "timed") {
    const hour24 = Math.floor(parsed.minutes / 60);
    const minute = parsed.minutes % 60;
    return {
      hour: String(hour24 % 12 === 0 ? 12 : hour24 % 12),
      minute: String(minute).padStart(2, "0"),
      meridiem: hour24 >= 12 ? "PM" : "AM",
    };
  }

  const match = raw.trim().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?$/i);
  if (!match) return { hour: "", minute: "", meridiem: "AM" };

  let hour = Number(match[1]);
  const minute = match[2] ?? "";
  if (hour > 12 && hour <= 23) {
    return {
      hour: String(hour % 12 === 0 ? 12 : hour % 12),
      minute: minute.padStart(2, "0"),
      meridiem: hour >= 12 ? "PM" : "AM",
    };
  }
  if (hour === 0) hour = 12;
  if (hour < 1 || hour > 12) return { hour: "", minute: "", meridiem: "AM" };
  const mer = match[3]?.toLowerCase().includes("p") ? "PM" : "AM";
  return { hour: String(hour), minute, meridiem: mer };
}

export function rawFromClockParts(parts: ClockParts): string {
  const hour = Number(parts.hour);
  if (!parts.hour.trim() || !Number.isInteger(hour) || hour < 1 || hour > 12) return "";
  let minute = parts.minute.trim() === "" ? 0 : Number(parts.minute);
  if (!Number.isInteger(minute) || minute < 0) minute = 0;
  if (minute > 59) minute = 59;
  let hour24 = hour % 12;
  if (parts.meridiem === "PM") hour24 += 12;
  return formatClock(hour24 * 60 + minute);
}

export function sanitizeClockDigits(raw: string, maxLen: number): string {
  return raw.replace(/\D/g, "").slice(0, maxLen);
}

export function normalizeClockHour(raw: string): string {
  if (!raw.trim()) return "";
  const n = Number(raw);
  if (!Number.isInteger(n)) return "";
  if (n <= 0 || n > 12) return "12";
  return String(n);
}

export function normalizeClockMinute(raw: string): string {
  if (!raw.trim()) return "00";
  let n = Number(raw);
  if (!Number.isInteger(n) || n < 0) n = 0;
  if (n > 59) n = 59;
  return String(n).padStart(2, "0");
}

export function reviewNoteLines(notes: string): string[] {
  return notes
    .split(";")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parsedTimeFields(startAt: string, endAt: string | null) {
  const start = parseDayOfTime(startAt);
  const end = endAt ? parseDayOfTime(endAt) : null;
  return {
    startMinutes: start.kind === "timed" ? start.minutes : null,
    endMinutes: end?.kind === "timed" ? end.minutes : null,
    dayOffset: start.kind === "timed" ? start.dayOffset : 0,
  };
}

export function peerKey(startAt: string, endAt = ""): string | null {
  const start = parseDayOfTime(startAt);
  if (start.kind !== "timed") return null;
  const end = parseDayOfTime(endAt);
  if (endAt.trim() && end.kind !== "timed") return null;
  const endPart = end.kind === "timed" ? `${end.dayOffset}:${end.minutes}` : "none";
  return `${start.dayOffset}:${start.minutes}|${endPart}`;
}

export function sortTimelineBlocks<T extends { id: string; startAt: string; sortOrder: number }>(
  blocks: T[],
): T[] {
  return [...blocks].sort((a, b) => {
    const cmp = compareParsedTimes(parseDayOfTime(a.startAt), parseDayOfTime(b.startAt));
    if (cmp !== 0) return cmp;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.id.localeCompare(b.id);
  });
}

export function applyPeerOrder<T extends { id: string; startAt: string; endAt?: string | null }>(
  blocks: T[],
  orderedPeerIds: string[],
): T[] | null {
  if (orderedPeerIds.length < 2) return null;
  const byId = new Map(blocks.map((block) => [block.id, block]));
  const first = byId.get(orderedPeerIds[0]);
  if (!first) return null;
  const key = peerKey(first.startAt, first.endAt ?? "");
  if (!key) return null;
  if (orderedPeerIds.some((id) => {
    const block = byId.get(id);
    return !block || peerKey(block.startAt, block.endAt ?? "") !== key;
  })) {
    return null;
  }

  const peerSet = new Set(orderedPeerIds);
  const next: T[] = [];
  let inserted = false;
  for (const block of blocks) {
    if (!peerSet.has(block.id)) {
      next.push(block);
      continue;
    }
    if (!inserted) {
      for (const id of orderedPeerIds) {
        const peer = byId.get(id);
        if (peer) next.push(peer);
      }
      inserted = true;
    }
  }
  return next;
}

export function prepareTimelineCreate(draft: TimelineFieldDraft): TimelineCreatePrep {
  const notes = draft.notes.trim();
  const startAt = draft.startAt.trim();
  const endAt = draft.endAt.trim() || null;
  const timedStart = parseDayOfTime(startAt);

  if (!notes && timedStart.kind !== "timed") {
    return { ok: false, reason: "invalid" };
  }

  return {
    ok: true,
    startAt: timedStart.kind === "timed" ? startAt : startAt || "TBD",
    endAt,
    notes: notes || "Untitled moment",
  };
}
