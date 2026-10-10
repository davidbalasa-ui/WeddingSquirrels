import { parseBlockNotes } from "@/lib/day-of-now";
import { compareParsedTimes, parseDayOfTime, parseTimelineSchedule } from "@/lib/day-of-time";

/**
 * David, 2026-10-10: "For the schedule, we can compress the shot list to just say
 * bridal party photos." Schedules (packets, binder, day-of views) show one line
 * where a moment lists the individual "Bride with …" / "Groom with …" shots. The
 * shot list itself still prints every shot for the photographer.
 */
const SHOT_LINE = /^[·•\-–—\s]*(bride|groom) with\b/i;

export const BRIDAL_PARTY_PHOTOS_LINE = "Bridal party photos";

const TIMED_LINE = /^\d{1,2}:\d{2}\s*(?:AM|PM)?\s*[—–:-]\s+(.+)$/i;

function sameWords(line: string): string {
  return line
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9 ]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Lines as a schedule prints them: one "Bridal party photos" line, no repeated times. */
export function scheduleLines(lines: string[]): string[] {
  // "Wedding party lines up" beside "3:20 PM — wedding party lines up" reads as two
  // different times; the timed line says it, so the bare copy is dropped.
  const timed = new Set(
    lines.map((line) => line.match(TIMED_LINE)?.[1]).filter((rest): rest is string => Boolean(rest)).map(sameWords),
  );
  if (timed.size) lines = lines.filter((line) => TIMED_LINE.test(line) || !timed.has(sameWords(line)));

  const shots = lines.filter((line) => SHOT_LINE.test(line)).length;
  if (shots < 2) return lines;
  const out: string[] = [];
  let placed = false;
  for (const line of lines) {
    if (!SHOT_LINE.test(line)) {
      out.push(line);
      continue;
    }
    if (!placed) out.push(BRIDAL_PARTY_PHOTOS_LINE);
    placed = true;
  }
  return out;
}

const LINE_UP = /\blines? up\b/i;
const NOT_CEREMONY_LINE_UP = /reception|entrance|dinner/i;
const LEADING_TIME = /^(\d{1,2}:\d{2}\s*(?:AM|PM)?)\b/i;

/**
 * When the wedding party lines up for the ceremony, read from the wedding-day
 * schedule itself so the processional heading and the MC page always say what the
 * schedule says. An explicit "3:20 PM — wedding party lines up" line wins;
 * otherwise it is the start of the moment that says the party lines up
 * ("Get ready for the ceremony", 3:15–3:30 PM). Null when the schedule never says.
 */
export function ceremonyLineUpTime(
  blocks: Array<{ startAt: string; notes: string; schedule?: string | null }>,
): string | null {
  const wedding = blocks
    .filter((row) => row.schedule === undefined || parseTimelineSchedule(row.schedule) === "wedding")
    .map((row) => ({ row, parsed: parseBlockNotes(row.notes), at: parseDayOfTime(row.startAt) }))
    .sort((a, b) => compareParsedTimes(a.at, b.at));
  const ceremony = wedding.find((entry) => /^ceremony$/i.test(entry.parsed.title.trim()));

  let fromBlock: string | null = null;
  for (const entry of wedding) {
    if (ceremony && entry !== ceremony && compareParsedTimes(entry.at, ceremony.at) >= 0) continue;
    if (entry === ceremony) continue;
    const lines = [entry.parsed.title, ...entry.parsed.detailLines].filter(
      (line) => LINE_UP.test(line) && !NOT_CEREMONY_LINE_UP.test(line),
    );
    for (const line of lines) {
      const timed = line.match(LEADING_TIME);
      if (timed) return timed[1]!;
    }
    if (lines.length && !fromBlock) fromBlock = entry.row.startAt;
  }
  return fromBlock;
}
