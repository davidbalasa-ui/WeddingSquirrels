import { parseBlockNotes } from "@/lib/day-of-now";
import { formatPrintTimeRange, isMcCueLine, isMusicLine } from "@/lib/print-projection";

/**
 * Screen-side shape of one timeline moment, derived from its free-text notes.
 * Mirrors what the Print Center binder does so the page and the packet read alike.
 */
export type ReviewDetail = { kind: "note" | "cue" | "music"; text: string };

export type ReviewMoment = {
  timeLabel: string;
  /** Start and end as separate pieces so a phone can stack them. */
  timeStart: string;
  timeEnd: string | null;
  title: string;
  location: string | null;
  details: ReviewDetail[];
};

function stripTag(line: string, kind: ReviewDetail["kind"]): string {
  if (kind === "cue") {
    return line
      .replace(/^(MC cue(?:\s+at)?|Dinner cue)\s*[:—–-]?\s*/i, "")
      .replace(/^at\s+/i, "")
      .trim();
  }
  if (kind === "music") {
    return line.replace(/^(Playlist|Music|Grand Entrance Song|After Dollar Dance)\s*:\s*/i, "").trim();
  }
  return line;
}

export function reviewMoment(block: { startAt: string; endAt: string | null; notes: string }): ReviewMoment {
  const parsed = parseBlockNotes(block.notes);
  const details: ReviewDetail[] = [];
  for (const raw of parsed.detailLines) {
    // Legacy single-line notes used ";" between items.
    for (const part of raw.split(";").map((line) => line.trim()).filter(Boolean)) {
      const kind: ReviewDetail["kind"] = isMcCueLine(part) ? "cue" : isMusicLine(part) ? "music" : "note";
      const text = stripTag(part, kind);
      if (text) details.push({ kind, text });
    }
  }
  const timeLabel = formatPrintTimeRange(block.startAt, block.endAt);
  const timeStart = formatPrintTimeRange(block.startAt, null);
  return {
    timeLabel,
    timeStart,
    timeEnd: timeLabel === timeStart ? null : timeLabel.slice(timeStart.length).replace(/^\s*[–—-]\s*/, ""),
    title: parsed.title,
    location: parsed.location,
    details,
  };
}

function normalizeTitle(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(the|a|an|at|and|plus)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type DuplicateFlag = { kind: "same-title" | "title-in-notes"; otherId: string; otherTitle: string };

/**
 * Flags moments that repeat each other so the owner can decide what to merge.
 * Same title twice, or one moment's title written as a detail line in another.
 * Short titles (fewer than 2 words) are skipped so "Ceremony" inside "Ceremony begins" never fires.
 */
export function findTimelineDuplicates(
  blocks: Array<{ id: string; notes: string }>,
): Record<string, DuplicateFlag[]> {
  const parsed = blocks.map((block) => {
    const view = parseBlockNotes(block.notes);
    return {
      id: block.id,
      title: view.title,
      key: normalizeTitle(view.title),
      details: view.detailLines.map(normalizeTitle),
    };
  });

  const flags: Record<string, DuplicateFlag[]> = {};
  function add(id: string, flag: DuplicateFlag) {
    const list = (flags[id] ??= []);
    if (!list.some((item) => item.kind === flag.kind && item.otherId === flag.otherId)) list.push(flag);
  }

  for (const a of parsed) {
    if (!a.key) continue;
    for (const b of parsed) {
      if (a.id === b.id) continue;
      if (a.key === b.key) {
        add(a.id, { kind: "same-title", otherId: b.id, otherTitle: b.title });
        continue;
      }
      if (a.key.split(" ").length >= 2 && b.details.includes(a.key)) {
        add(a.id, { kind: "title-in-notes", otherId: b.id, otherTitle: b.title });
        add(b.id, { kind: "title-in-notes", otherId: a.id, otherTitle: a.title });
      }
    }
  }
  return flags;
}

export function duplicateFlagLabel(flag: DuplicateFlag): string {
  if (flag.kind === "same-title") return `Same title as “${flag.otherTitle}”`;
  return `Also listed inside “${flag.otherTitle}”`;
}
