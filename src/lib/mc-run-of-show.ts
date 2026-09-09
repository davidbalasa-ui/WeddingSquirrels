import { parseBlockNotes } from "@/lib/day-of-now";
import { compareParsedTimes, parseDayOfTime, parseTimelineSchedule } from "@/lib/day-of-time";
import {
  extractMcCues,
  isMcDirectoryLabel,
  mcPeopleFromDirectory,
  type PrintMcCue,
} from "@/lib/print-center";

export type McCueKind = "spoken" | "music";

export type McRunCue = PrintMcCue & {
  kind: McCueKind;
  nextTime: string | null;
  nextTitle: string | null;
  operatorNotes: string[];
  introduces: string | null;
};

export type McRunOfShow = {
  mcNames: string[];
  cues: McRunCue[];
};

const MUSIC_LINE =
  /^(Playlist|Music|Grand Entrance Song|After Dollar Dance)\s*:\s*(.+)$/i;
const TIME_IN_MUSIC = /(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i;

function chronological<T extends { startAt: string; sortOrder?: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const cmp = compareParsedTimes(parseDayOfTime(a.startAt), parseDayOfTime(b.startAt));
    if (cmp !== 0) return cmp;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });
}

function afternoonClock(raw: string | null | undefined): ReturnType<typeof parseDayOfTime> {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed || /^immediately/i.test(trimmed)) return { kind: "untimed", raw: trimmed };
  const parsed = parseDayOfTime(trimmed);
  if (parsed.kind === "timed") return parsed;
  if (/(am|pm)$/i.test(trimmed)) return parsed;
  return parseDayOfTime(`${trimmed} PM`);
}

export function sortMcCues<T extends Pick<McRunCue, "time" | "momentTitle" | "kind">>(cues: T[]): T[] {
  return [...cues].sort((a, b) => {
    const cmp = compareParsedTimes(afternoonClock(a.time), afternoonClock(b.time));
    if (cmp !== 0) return cmp;
    if (a.kind === b.kind) return 0;
    return a.kind === "music" ? -1 : 1;
  });
}

function insertMusicBeds<T extends Pick<McRunCue, "time" | "kind">>(spoken: T[], beds: T[]): T[] {
  const result = [...spoken];
  for (const bed of sortMcCues(beds)) {
    const bedTime = afternoonClock(bed.time);
    let index = result.findIndex((cue) => {
      const cueTime = afternoonClock(cue.time);
      if (bedTime.kind !== "timed" || cueTime.kind !== "timed") return false;
      return compareParsedTimes(bedTime, cueTime) < 0;
    });
    if (index < 0) index = result.length;
    result.splice(index, 0, bed);
  }
  return result;
}

function operatorNotesForBlock(notes: string): string[] {
  const parsed = parseBlockNotes(notes);
  return parsed.detailLines.filter((line) => {
    if (MUSIC_LINE.test(line)) return false;
    if (/^(MC cue(?:\s+at)?|Dinner cue)\b/i.test(line)) return false;
    return /crossbow|line up|lineup|announce|welcome|introduce|release tables|dollar dance|last dance|phones/i.test(
      line,
    );
  });
}

function musicBedsFromBlocks(
  blocks: Array<{ startAt: string; endAt: string | null; notes: string; schedule?: string | null; sortOrder?: number }>,
): PrintMcCue[] {
  const beds: PrintMcCue[] = [];
  for (const block of chronological(
    blocks.filter((row) => parseTimelineSchedule(row.schedule) === "wedding"),
  )) {
    const parsed = parseBlockNotes(block.notes);
    for (const line of parsed.detailLines) {
      const music = line.match(MUSIC_LINE);
      if (!music) continue;
      const value = music[2]!.trim();
      const clock = value.match(TIME_IN_MUSIC);
      if (!clock) continue;
      const rawTime = clock[1]!.replace(/\s+/g, " ").trim();
      const timed = afternoonClock(rawTime);
      beds.push({
        time: timed.kind === "timed" ? timed.display : rawTime,
        heading: "Music",
        momentTitle: parsed.title,
        spoken: "",
        music: [`${music[1]!.trim()}: ${value}`],
      });
    }
  }
  return beds;
}

export function buildMcRunOfShow(
  blocks: Array<{ startAt: string; endAt: string | null; notes: string; schedule?: string | null; sortOrder?: number }>,
  people: Array<{ name: string; directoryLabel?: string | null }> = [],
): McRunOfShow {
  const spoken = extractMcCues(blocks).map((cue) => {
    const block = blocks.find((row) => parseBlockNotes(row.notes).title === cue.momentTitle);
    return {
      ...cue,
      kind: "spoken" as const,
      nextTime: null,
      nextTitle: null,
      operatorNotes: block ? operatorNotesForBlock(block.notes) : [],
      introduces: cue.heading,
    };
  });

  const musicOnly = musicBedsFromBlocks(blocks)
    .filter((bed) => {
      return !spoken.some((cue) => {
        const sameMusic = cue.music.some((line) => bed.music.includes(line));
        if (!sameMusic) return false;
        const bedTime = afternoonClock(bed.time);
        const cueTime = afternoonClock(cue.time);
        if (bedTime.kind === "timed" && cueTime.kind === "timed") {
          return compareParsedTimes(bedTime, cueTime) === 0;
        }
        return false;
      });
    })
    .map((bed) => ({
      ...bed,
      kind: "music" as const,
      nextTime: null,
      nextTitle: null,
      operatorNotes: [],
      introduces: null,
    }));

  const ordered = insertMusicBeds(spoken, musicOnly);
  const cues = ordered.map((cue, index) => {
    const next = ordered[index + 1];
    return {
      ...cue,
      nextTime: next?.time ?? null,
      nextTitle: next ? next.heading || next.momentTitle : null,
    };
  });

  return {
    mcNames: mcPeopleFromDirectory(people),
    cues,
  };
}

export { isMcDirectoryLabel, mcPeopleFromDirectory };
