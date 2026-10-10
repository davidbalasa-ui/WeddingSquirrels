import { composeBlockNotes, parseBlockNotes } from "@/lib/day-of-now";
import { SHARED_WEDDING_MOMENT, type ReviewMoment } from "@/lib/day-timeline-view";
import { scheduleLines } from "@/lib/schedule-consistency";

/**
 * Who a printed packet is for. Each packet reads as "my schedule": the moments
 * that involve that group, with only the lines meant for them, plus the shared
 * moments every guest of honor attends. Sorting stays invisible on the page.
 */
export type ScheduleAudience = "party" | "mc" | "photo" | "brideParents" | "groomParents";

export type PacketScheduleRow = {
  time: string;
  title: string;
  location: string | null;
  lines: string[];
};

export type PacketSchedule = {
  rehearsal: PacketScheduleRow[];
  wedding: PacketScheduleRow[];
};

/** The document's titles and the app's earlier one-line rows ("Dinner; Welcome toasts…", "Rehearsal; Ceremony rehearsal at BSS"). */
const SHARED_REHEARSAL_MOMENT = /rehearsal dinner|ceremony rehearsal|^dinner\b|^rehearsal\b/i;
/** The party travels together on Thursday, so their copy keeps the departures and the return. */
const PARTY_REHEARSAL_TRAVEL = /^depart\b|^return to (?:the )?airbnb/i;

const BRIDE_SIDE =
  /\bMOB\b|\bFOB\b|mother of the bride|father of the bride|\bhaley with\b|haley[’']s (?:family|parents|mom|dad|paternal|maternal)|mom buttons|first look with dad|father[- ]daughter/i;
const GROOM_SIDE =
  /\bMOG\b|\bFOG\b|mother of the groom|father of the groom|david[’']s (?:parents|mom|dad|family)|\bdavid with\b|\bhis parents\b|mother[- ]son/i;
/** "Parents gather belongings and prepare children" is about guests' children, not the couple's parents. */
const GUEST_CHILDREN = /\bchildren\b/i;

function familyLineFits(text: string, audience: "brideParents" | "groomParents"): boolean {
  if (GUEST_CHILDREN.test(text)) return false;
  return audience === "brideParents" ? !GROOM_SIDE.test(text) : !BRIDE_SIDE.test(text);
}

const NAME_WORD = /\b[A-Z][a-z]{2,}\b/g;

/** "MOB meets San." then "Show San where to park…": the second line names the same person. */
function continuesLine(line: string, previous: string): boolean {
  const names = new Set(previous.match(NAME_WORD) ?? []);
  return (line.match(NAME_WORD) ?? []).some((word) => names.has(word));
}

function audienceRole(audience: ScheduleAudience) {
  return audience === "brideParents" || audience === "groomParents" ? "family" : audience;
}

/**
 * One moment as a group sees it, or null when nothing in it is theirs.
 * Open planning questions stay in the binder; MC cues and music only reach the MC.
 */
export function momentForAudience(
  moment: ReviewMoment,
  audience: ScheduleAudience,
  day: "rehearsal" | "wedding",
): PacketScheduleRow | null {
  const role = audienceRole(audience);
  const family = audience === "brideParents" || audience === "groomParents" ? audience : null;
  const readable = moment.details.filter(
    (detail) => detail.kind === "note" || (audience === "mc" && (detail.kind === "cue" || detail.kind === "music")),
  );
  const fits = (text: string) => !family || familyLineFits(text, family);

  const titleIsTheirs = moment.roles.includes(role) && fits(moment.title);
  // A line with no group of its own that follows one of theirs and names the same
  // person finishes their instruction ("MOB meets San." then "Show San where to park…").
  const lines = titleIsTheirs
    ? readable.filter((detail) => fits(detail.text))
    : readable.filter((detail, index) => {
        if (!fits(detail.text)) return false;
        if (detail.roles.includes(role)) return true;
        const previous = readable[index - 1];
        return (
          detail.roles.length === 0 &&
          Boolean(previous?.roles.includes(role) && fits(previous.text) && continuesLine(detail.text, previous.text))
        );
      });

  const shared =
    day === "wedding"
      ? SHARED_WEDDING_MOMENT.test(moment.title.trim())
      : audience !== "mc" &&
        audience !== "photo" &&
        (SHARED_REHEARSAL_MOMENT.test(moment.title) || (audience === "party" && PARTY_REHEARSAL_TRAVEL.test(moment.title)));

  if (!titleIsTheirs && lines.length === 0 && !shared) return null;
  return {
    time: moment.timeLabel,
    title: moment.title,
    location: moment.location,
    lines: scheduleLines(lines.map((detail) => detail.text)),
  };
}

export function packetSchedule(
  moments: { rehearsal: ReviewMoment[]; wedding: ReviewMoment[] },
  audience: ScheduleAudience,
): PacketSchedule {
  const pick = (rows: ReviewMoment[], day: "rehearsal" | "wedding") =>
    rows.flatMap((moment) => {
      const row = momentForAudience(moment, audience, day);
      return row ? [row] : [];
    });
  return {
    rehearsal: audience === "mc" || audience === "photo" ? [] : pick(moments.rehearsal, "rehearsal"),
    wedding: pick(moments.wedding, "wedding"),
  };
}

const BRIDE_SECRET = /secret from the bride/i;
const GETAWAY = /getaway/i;
/** A line about the getaway car in any other moment ("Just Married" sign, the getaway itself). */
const GETAWAY_LINE = /getaway|just married/i;

/**
 * The bride's copy keeps every moment, including the getaway, but a getaway
 * moment or one marked secret from the bride shows only its time and title,
 * and a line that mentions the getaway inside any other moment is left out.
 */
export function withoutBrideSecrets<T extends { notes: string }>(block: T): T {
  const parsed = parseBlockNotes(block.notes);
  if (parsed.detailLines.length === 0) return block;
  const secret = GETAWAY.test(parsed.title) || parsed.detailLines.some((line) => BRIDE_SECRET.test(line));
  const detailLines = secret ? [] : parsed.detailLines.filter((line) => !GETAWAY_LINE.test(line));
  if (detailLines.length === parsed.detailLines.length) return block;
  return {
    ...block,
    notes: composeBlockNotes({ title: parsed.title, location: secret ? null : parsed.location, detailLines }),
  };
}
