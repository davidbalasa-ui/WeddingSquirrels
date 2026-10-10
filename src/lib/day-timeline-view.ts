import { parseBlockNotes } from "@/lib/day-of-now";
import { parseDayOfTime } from "@/lib/day-of-time";
import { formatPrintTimeRange, isMcCueLine, isMusicLine, normalizePrintTime } from "@/lib/print-projection";
import { OPEN_ITEMS_PREFIX } from "@/lib/reconciled-timeline";

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
    /wedding party|bridal party|bridesmaids?|groomsm[ae]n|maid of hono[u]?r|\bMOH\b|best man|flower girl|ring bearer|ring security|lines? up|processional|robe photos|wedding party portraits|groom-?party|bride-?party/i,
  family:
    /\bmother\b|\bfather\b|\bmom\b|\bdad\b|\bFOB\b|\bMOB\b|\bFOG\b|\bMOG\b|\bparents?\b|grandm|grandp|\bfamily\b|first look with parent/i,
  helpers: /\bhelpers?\b|volunteers?|everyone helps|pack(?:s)? up|move chairs|set ?up|tear ?down|clean ?up|assignments?/i,
  photo: /photograph|\bphotos?\b|candids|portraits?|detail shots|videograph/i,
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

export type ReviewDetail = {
  kind: "note" | "cue" | "music" | "open";
  text: string;
  roles: TimelineRole[];
  /** A clock time named inside the line ("Children arrive at 1:15 PM"), shown in the margin. */
  time: string | null;
};

const LINE_TIME = /\b(\d{1,2}:\d{2}\s*(?:AM|PM))\b/i;

/** A line that announces one thing at one clock time gets that time in the margin. */
export function detailTime(text: string): string | null {
  const matches = text.match(new RegExp(LINE_TIME.source, "gi"));
  if (!matches || matches.length !== 1) return null;
  if (!/\b(?:arrives?|arrive|begins?|starts?|at|until|by|leave|leaves|opens?)\b/i.test(text)) return null;
  return normalizePrintTime(matches[0]!);
}

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
  if (kind === "open") return line.replace(OPEN_ITEMS_PREFIX, "").trim();
  return line;
}

export function reviewMoment(
  block: { startAt: string; endAt: string | null; notes: string },
  context: RoleNameContext = {},
): ReviewMoment {
  const parsed = parseBlockNotes(block.notes);
  const details: ReviewDetail[] = [];
  for (const raw of parsed.detailLines) {
    if (OPEN_ITEMS_PREFIX.test(raw)) {
      const text = stripTag(raw, "open");
      if (text) details.push({ kind: "open", text, roles: [], time: null });
      continue;
    }
    // Legacy single-line notes used ";" between items; the document's lines keep their own semicolons.
    const parts = /^[•·]/.test(raw) || raw.includes(": ") ? [raw] : raw.split(";");
    for (const part of parts.map((line) => line.replace(/^[•·]\s*/, "").trim()).filter(Boolean)) {
      const kind: ReviewDetail["kind"] = isMcCueLine(part) ? "cue" : isMusicLine(part) ? "music" : "note";
      const text = stripTag(part, kind);
      if (!text) continue;
      const roles = kind === "cue" ? ["mc" as const, ...inferLineRoles(text, context).filter((r) => r !== "mc")] : inferLineRoles(text, context);
      details.push({ kind, text, roles, time: kind === "note" ? detailTime(text) : null });
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
 * Wedding-day moments every group attends, shown in each group's view even with no line of their own.
 * Matches the document's titles and the page's earlier wording ("Dinner begins", "First dances",
 * "Toasts + Cake cutting"), since Apply keeps the owner's titles.
 */
export const SHARED_WEDDING_MOMENT =
  /^ceremony$|grand entrance|dinner begins|^toasts?\b|cake cutting|formal dances|first dances?|last (?:open )?dance|reception ends/i;

/**
 * The moment as one role sees it: everything when the title names the role,
 * only that role's lines otherwise, the time and title alone for a moment
 * everyone attends, or null when nothing in it is theirs.
 */
export function momentForRole(moment: ReviewMoment, role: TimelineRole | null): ReviewMoment | null {
  if (!role) return moment;
  if (moment.roles.includes(role)) return moment;
  const details = moment.details.filter((detail) => detail.roles.includes(role));
  if (details.length === 0 && !SHARED_WEDDING_MOMENT.test(moment.title.trim())) return null;
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

const DUPLICATE_WINDOW_MINUTES = 30;

export type DuplicateFlag = { kind: "same-title" | "title-in-notes" | "title-in-title"; otherId: string; otherTitle: string };

/**
 * Flags moments that repeat each other so the owner can decide what to merge.
 * Same title twice, one moment's title written as a detail line in another, or one title
 * inside another's ("Cake cutting" next to "Toasts + Cake cutting").
 * Short titles (fewer than 2 words) are skipped so "Ceremony" inside "Ceremony begins" never fires.
 * Moments more than half an hour apart are never flagged.
 */
export function findTimelineDuplicates(
  blocks: Array<{ id: string; notes: string; startAt?: string }>,
): Record<string, DuplicateFlag[]> {
  const parsed = blocks.map((block) => {
    const view = parseBlockNotes(block.notes);
    const time = block.startAt ? parseDayOfTime(block.startAt) : null;
    return {
      minutes: time?.kind === "timed" ? time.dayOffset * 1440 + time.minutes : null,
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
      // Two sets of open dancing, or the party lining up for the processional and again for the entrance, are separate moments.
      if (a.minutes !== null && b.minutes !== null && Math.abs(a.minutes - b.minutes) > DUPLICATE_WINDOW_MINUTES) continue;
      if (a.key === b.key) {
        add(a.id, { kind: "same-title", otherId: b.id, otherTitle: b.title });
        continue;
      }
      if (a.key.split(" ").length < 2) continue;
      if (b.details.includes(a.key)) {
        add(a.id, { kind: "title-in-notes", otherId: b.id, otherTitle: b.title });
        add(b.id, { kind: "title-in-notes", otherId: a.id, otherTitle: a.title });
      } else if (` ${b.key} `.includes(` ${a.key} `)) {
        add(a.id, { kind: "title-in-title", otherId: b.id, otherTitle: b.title });
        add(b.id, { kind: "title-in-title", otherId: a.id, otherTitle: a.title });
      }
    }
  }
  return flags;
}

export function duplicateFlagLabel(flag: DuplicateFlag): string {
  if (flag.kind === "same-title") return `Same title as “${flag.otherTitle}”`;
  if (flag.kind === "title-in-title") return `Part of “${flag.otherTitle}”`;
  return `Also listed inside “${flag.otherTitle}”`;
}
