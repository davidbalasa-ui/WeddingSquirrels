/**
 * Deterministic wedding-phase and calendar-day helpers.
 *
 * Authoritative context: AppSettings.weddingDate + AppSettings.timezone.
 * All day math uses calendar dates in that timezone — never raw 24-hour
 * differences, server UTC midnights, or the browser's local zone.
 *
 * Inject `now` for tests. Production passes the current instant.
 */

export type WeddingPhase =
  | "planning"
  | "wedding_week"
  | "day_before"
  | "wedding_day"
  | "post_wedding";

export type WeddingPhaseInfo = {
  phase: WeddingPhase;
  daysUntilWedding: number | null;
  timezone: string;
  todayKey: string;
  weddingKey: string | null;
};

export function calendarDateKey(date: Date, timeZone: string): string {
  return date.toLocaleDateString("en-CA", { timeZone });
}

/** Calendar-day distance from `from` to `to` in `timeZone`. Positive = to is later. */
export function calendarDaysBetween(from: Date, to: Date, timeZone: string): number {
  return calendarDaysBetweenKeys(calendarDateKey(from, timeZone), calendarDateKey(to, timeZone));
}

export function calendarDaysBetweenKeys(fromKey: string, toKey: string): number {
  const from = Date.parse(`${fromKey}T00:00:00Z`);
  const to = Date.parse(`${toKey}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

export function addCalendarDays(dateKey: string, days: number): string {
  const ms = Date.parse(`${dateKey}T00:00:00Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * An instant that falls on `dateKey` in `timeZone`.
 * Used for test clocks so YYYY-MM-DD does not slip across a zone boundary.
 */
export function instantOnCalendarDate(dateKey: string, timeZone: string): Date {
  for (const hour of [16, 17, 18, 15, 19, 14, 20, 12, 21, 22]) {
    const candidate = new Date(`${dateKey}T${String(hour).padStart(2, "0")}:00:00.000Z`);
    if (calendarDateKey(candidate, timeZone) === dateKey) return candidate;
  }
  return new Date(`${dateKey}T16:00:00.000Z`);
}

export function getWeddingPhase(input: {
  weddingDate: Date | null;
  timezone: string;
  now?: Date;
}): WeddingPhaseInfo {
  const now = input.now ?? new Date();
  const timezone = input.timezone || "America/Detroit";
  const todayKey = calendarDateKey(now, timezone);
  if (!input.weddingDate) {
    return {
      phase: "planning",
      daysUntilWedding: null,
      timezone,
      todayKey,
      weddingKey: null,
    };
  }

  const weddingKey = calendarDateKey(input.weddingDate, timezone);
  const daysUntilWedding = calendarDaysBetweenKeys(todayKey, weddingKey);
  return {
    phase: phaseForDaysUntil(daysUntilWedding),
    daysUntilWedding,
    timezone,
    todayKey,
    weddingKey,
  };
}

export function phaseForDaysUntil(daysUntilWedding: number): WeddingPhase {
  if (daysUntilWedding > 7) return "planning";
  if (daysUntilWedding >= 2) return "wedding_week";
  if (daysUntilWedding === 1) return "day_before";
  if (daysUntilWedding === 0) return "wedding_day";
  return "post_wedding";
}

/** Chronological execution sections (Today / Tomorrow / Later) replace Coming Up. */
export function usesExecutionLayout(phase: WeddingPhase): boolean {
  return phase === "wedding_week" || phase === "day_before" || phase === "wedding_day";
}

export type WeddingPhaseHeroCopy = {
  kicker: string | null;
  lede: string | null;
};

/**
 * Restrained temporal copy. Never claims readiness.
 * Couple/venue lines belong to the caller — this only speaks about time.
 */
export function weddingPhaseHeroCopy(
  phase: WeddingPhase | null,
  daysUntilWedding: number | null,
): WeddingPhaseHeroCopy {
  if (phase === "wedding_week" && daysUntilWedding !== null) {
    return {
      kicker: daysUntilWedding === 1 ? "1 DAY" : `${daysUntilWedding} DAYS`,
      lede: weddingWeekLede(daysUntilWedding),
    };
  }
  if (phase === "day_before") {
    return { kicker: "TOMORROW", lede: "We get married." };
  }
  if (phase === "wedding_day") {
    return { kicker: "TODAY IS THE DAY", lede: "You're getting married." };
  }
  if (phase === "post_wedding") {
    return { kicker: "WE DID IT.", lede: null };
  }
  return { kicker: null, lede: null };
}

function weddingWeekLede(days: number): string {
  if (days === 7) return "One week to go.";
  if (days === 6) return "Six days.";
  if (days === 5) return "Five days.";
  if (days === 4) return "Four days.";
  if (days === 3) return "Almost here.";
  if (days === 2) return "Two days.";
  return `${days} days.`;
}
