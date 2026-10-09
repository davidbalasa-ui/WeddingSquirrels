import { parseBlockNotes } from "@/lib/day-of-now";
import { formatPrintTimeRange, isMcCueLine, isMusicLine } from "@/lib/print-projection";

/**
 * Screen-side shape of one timeline moment, derived from its free-text notes.
 * Mirrors what the Print Center binder does so the page and the packet read alike.
 */
export type TimelineRole = "mc" | "party" | "family" | "helpers" | "photo" | "vendors";

export const TIMELINE_ROLES: Array<{ id: TimelineRole; label: string; short: string }> = [
  { id: "mc", label: "MC", short: "MC" },
  { id: "party", label: "Wedding party", short: "Party" },
  { id: "family", label: "Family", short: "Family" },
  { id: "helpers", label: "Helpers", short: "Helpers" },
  { id: "photo", label: "Photographer", short: "Photo" },
  { id: "vendors", label: "Vendors", short: "Vendors" },
];

/** Names from the directory and lineup that place a line with a role without a keyword. */
export type RoleNameContext = Partial<Record<TimelineRole, string[]>>;

const ROLE_WORDS: Record<TimelineRole, RegExp> = {
  mc: /\bMC\b|master of ceremon|mistress of ceremon|\bannounce|dinner cue|grand entrance|welcome everyone|silence your phones/i,
  party:
    /wedding party|bridal party|bridesmaids?|groomsm[ae]n|maid of hono[u]?r|\bMOH\b|best man|flower girl|ring bearer|lines? up|processional|robe photos|wedding party portraits/i,
  family:
    /\bmother\b|\bfather\b|\bmom\b|\bdad\b|\bFOB\b|\bMOB\b|\bFOG\b|\bMOG\b|\bparents?\b|grandm|grandp|family portraits|immediate family|first look with parent/i,
  helpers: /\bhelpers?\b|volunteers?|everyone helps|pack(?:s)? up|move chairs|set ?up|tear ?down|clean ?up|assignments?/i,
  photo: /photograph|\bphotos?\b|candids|portraits|detail shots|videograph/i,
  vendors:
    /\bvendors?\b|coordinator|florals?|florist|rentals?|cater|\bDJ\b|\bbar\b|trailer|officiant|decor|venue opens|hair ?(?:&|and) ?makeup artist|makeup artist|unloads gear/i,
};

function nameMatches(text: string, names: string[] | undefined): boolean {
  if (!names?.length) return false;
  const lower = text.toLowerCase();
  return names.some((name) => {
    const first = name.trim().split(/\s+/)[0]?.toLowerCase();
    if (!first || first.length < 3) return false;
    return new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(lower);
  });
}

/**
 * Who a line is for, read from the words already in it (and known names).
 * A line with no match belongs to the master timeline only.
 */
export function inferLineRoles(text: string, context: RoleNameContext = {}): TimelineRole[] {
  const roles: TimelineRole[] = [];
  for (const role of TIMELINE_ROLES) {
    if (ROLE_WORDS[role.id].test(text) || nameMatches(text, context[role.id])) roles.push(role.id);
  }
  return roles;
}

export type ReviewDetail = { kind: "note" | "cue" | "music"; text: string; roles: TimelineRole[] };

export type ReviewMoment = {
  timeLabel: string;
  /** Start and end as separate pieces so a phone can stack them. */
  timeStart: string;
  timeEnd: string | null;
  title: string;
  location: string | null;
  details: ReviewDetail[];
  /** Roles read from the title: the whole moment belongs to them. */
  roles: TimelineRole[];
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

export function reviewMoment(
  block: { startAt: string; endAt: string | null; notes: string },
  context: RoleNameContext = {},
): ReviewMoment {
  const parsed = parseBlockNotes(block.notes);
  const details: ReviewDetail[] = [];
  for (const raw of parsed.detailLines) {
    // Legacy single-line notes used ";" between items.
    for (const part of raw.split(";").map((line) => line.trim()).filter(Boolean)) {
      const kind: ReviewDetail["kind"] = isMcCueLine(part) ? "cue" : isMusicLine(part) ? "music" : "note";
      const text = stripTag(part, kind);
      if (!text) continue;
      const roles = kind === "cue" ? ["mc" as const, ...inferLineRoles(text, context).filter((r) => r !== "mc")] : inferLineRoles(text, context);
      details.push({ kind, text, roles });
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
    roles: inferLineRoles(parsed.title, context),
  };
}

/**
 * The moment as one role sees it: everything when the title names the role,
 * only that role's lines otherwise, or null when nothing in it is theirs.
 */
export function momentForRole(moment: ReviewMoment, role: TimelineRole | null): ReviewMoment | null {
  if (!role) return moment;
  if (moment.roles.includes(role)) return moment;
  const details = moment.details.filter((detail) => detail.roles.includes(role));
  if (details.length === 0) return null;
  return { ...moment, details };
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
