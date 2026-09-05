/**
 * Safe temporal preview for local development and Vercel Preview.
 *
 * Never writes AppSettings, TimelineBlocks, or any production data.
 * Real Vercel Production (VERCEL_ENV=production) always ignores preview clocks.
 */

import { addCalendarDays, calendarDateKey, instantOnCalendarDate } from "@/lib/wedding-phase";

export type PreviewEnv = {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
};

export function isTemporalPreviewAllowed(env: PreviewEnv = process.env): boolean {
  if (env.VERCEL_ENV === "production") return false;
  if (env.VERCEL_ENV === "preview" || env.VERCEL_ENV === "development") return true;
  return (env.NODE_ENV ?? "development") !== "production";
}

export type PreviewPresetId =
  | "planning"
  | "week-7"
  | "week-3"
  | "day-before"
  | "morning"
  | "overlap"
  | "ceremony"
  | "dinner"
  | "dancing"
  | "teardown"
  | "post";

export type PreviewPreset = {
  id: PreviewPresetId;
  label: string;
  asOf: string;
};

const PRESET_OFFSETS: Array<{
  id: PreviewPresetId;
  label: string;
  daysFromWedding: number;
  hour: number;
  minute: number;
}> = [
  { id: "planning", label: "Planning", daysFromWedding: -60, hour: 10, minute: 0 },
  { id: "week-7", label: "7 days before", daysFromWedding: -7, hour: 10, minute: 0 },
  { id: "week-3", label: "3 days before", daysFromWedding: -3, hour: 10, minute: 0 },
  { id: "day-before", label: "Day before", daysFromWedding: -1, hour: 16, minute: 0 },
  { id: "morning", label: "Wedding day — morning", daysFromWedding: 0, hour: 9, minute: 0 },
  { id: "overlap", label: "Wedding day — 10:42 AM", daysFromWedding: 0, hour: 10, minute: 42 },
  { id: "ceremony", label: "Wedding day — ceremony", daysFromWedding: 0, hour: 15, minute: 35 },
  { id: "dinner", label: "Wedding day — dinner", daysFromWedding: 0, hour: 17, minute: 15 },
  { id: "dancing", label: "Wedding day — dancing", daysFromWedding: 0, hour: 19, minute: 30 },
  { id: "teardown", label: "Wedding day — teardown", daysFromWedding: 0, hour: 22, minute: 30 },
  { id: "post", label: "Post-wedding", daysFromWedding: 1, hour: 10, minute: 0 },
];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** UTC instant whose wall clock in `timeZone` is dateKey + hour:minute. */
export function instantAtLocalClock(
  dateKey: string,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const wanted = hour * 60 + minute;
  for (const offset of ["-04:00", "-05:00", "-06:00", "+00:00"]) {
    const candidate = new Date(`${dateKey}T${pad(hour)}:${pad(minute)}:00${offset}`);
    if (Number.isNaN(candidate.getTime())) continue;
    if (calendarDateKey(candidate, timeZone) !== dateKey) continue;
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    }).formatToParts(candidate);
    const localHour = Number(parts.find((part) => part.type === "hour")?.value ?? -1);
    const localMinute = Number(parts.find((part) => part.type === "minute")?.value ?? -1);
    if (localHour * 60 + localMinute === wanted) return candidate;
  }
  return instantOnCalendarDate(dateKey, timeZone);
}

export function buildPreviewPresets(
  weddingDate: Date | null,
  timeZone: string,
): PreviewPreset[] {
  const weddingKey = weddingDate
    ? calendarDateKey(weddingDate, timeZone)
    : "2026-10-16";
  return PRESET_OFFSETS.map((preset) => {
    const dateKey = addCalendarDays(weddingKey, preset.daysFromWedding);
    const instant = instantAtLocalClock(dateKey, preset.hour, preset.minute, timeZone);
    return {
      id: preset.id,
      label: preset.label,
      asOf: instant.toISOString(),
    };
  });
}

export function previewPresetIdForAsOf(
  asOf: string | undefined,
  presets: PreviewPreset[],
): PreviewPresetId | "custom" | null {
  if (!asOf) return null;
  const match = presets.find((preset) => preset.asOf === asOf);
  return match?.id ?? "custom";
}

export function canShowPreviewHarness(input: {
  isMaster: boolean;
  env?: PreviewEnv;
}): boolean {
  return Boolean(input.isMaster) && isTemporalPreviewAllowed(input.env);
}

/** Carry a preview ?asOf= across in-app navigation. Never writes data. */
export function appendPreviewAsOf(href: string, asOf: string | null | undefined): string {
  if (!asOf) return href;
  const url = new URL(href, "https://weddingsquirrels.local");
  url.searchParams.set("asOf", asOf);
  return `${url.pathname}${url.search}`;
}
