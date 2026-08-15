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
