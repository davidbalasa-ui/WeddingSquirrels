import { composeBlockNotes, parseBlockNotes } from "@/lib/day-of-now";
import type { ReviewMoment } from "@/lib/day-timeline-view";

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

/** Moments the whole party and both families attend, shown even with no line of their own. */
const SHARED_WEDDING_MOMENT =
  /^ceremony$|grand entrance|^toasts?$|cake cutting|formal dances|last (?:open )?dance|reception ends/i;
const SHARED_REHEARSAL_MOMENT = /rehearsal dinner|ceremony rehearsal/i;

const BRIDE_SIDE =
  /\bMOB\b|\bFOB\b|mother of the bride|father of the bride|\bhaley with\b|haley[’']s (?:family|parents|mom|dad|paternal|maternal)|mom buttons|first look with dad/i;
const GROOM_SIDE =
  /\bMOG\b|\bFOG\b|mother of the groom|father of the groom|david[’']s (?:parents|mom|dad|family)|\bdavid with\b|\bhis parents\b/i;
/** "Parents gather belongings and prepare children" is about guests' children, not the couple's parents. */
const GUEST_CHILDREN = /\bchildren\b/i;

function familyLineFits(text: string, audience: "brideParents" | "groomParents"): boolean {
  if (GUEST_CHILDREN.test(text)) return false;
  return audience === "brideParents" ? !GROOM_SIDE.test(text) : !BRIDE_SIDE.test(text);
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
  const lines = titleIsTheirs
    ? readable.filter((detail) => fits(detail.text))
    : readable.filter((detail) => detail.roles.includes(role) && fits(detail.text));

  const shared =
    day === "wedding"
      ? SHARED_WEDDING_MOMENT.test(moment.title.trim())
      : audience !== "mc" && audience !== "photo" && SHARED_REHEARSAL_MOMENT.test(moment.title);

  if (!titleIsTheirs && lines.length === 0 && !shared) return null;
  return {
    time: moment.timeLabel,
    title: moment.title,
    location: moment.location,
    lines: lines.map((detail) => detail.text),
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
const VEHICLE_DETAIL = /secret from the bride|\bmake\b|\bmodel\b|license plate/i;

/**
 * The bride's copy keeps every moment, including the getaway, and leaves out
 * only the vehicle details in a moment marked secret from the bride.
 */
export function withoutBrideSecrets<T extends { notes: string }>(block: T): T {
  const parsed = parseBlockNotes(block.notes);
  if (!parsed.detailLines.some((line) => BRIDE_SECRET.test(line))) return block;
  return {
    ...block,
    notes: composeBlockNotes({
      title: parsed.title,
      location: parsed.location,
      detailLines: parsed.detailLines.filter((line) => !VEHICLE_DETAIL.test(line)),
    }),
  };
}
