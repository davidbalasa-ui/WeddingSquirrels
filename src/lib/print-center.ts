import { weddingPlacesFromPlan } from "@/lib/wedding-venue";
import { parseBlockNotes } from "@/lib/day-of-now";
import { compareParsedTimes, parseDayOfTime, parseTimelineSchedule } from "@/lib/day-of-time";
import { buildMoneySummary, contractPaidTotal, type BudgetContractSnapshot } from "@/lib/money";
import {
  formatPrintTimeRange,
  musicAttachTarget,
  normalizePrintTime,
  printContactRole,
  professionalizePrintLine,
  professionalizePrintLines,
  projectHouseholds,
  projectMealSections,
  projectStaySections,
  type PrintHairRoom,
  type PrintHairRow,
  type PrintHouseholdCard,
  type PrintMealSectionView,
  type PrintQuickReference,
  type PrintRsvpSummary,
  type PrintSetupConfirmed,
  type PrintShotGroup,
  type PrintStaySectionView,
  type PrintTaskGroupView,
  type PrintWeddingPartyView,
} from "@/lib/print-projection";
import type { ReviewMoment } from "@/lib/day-timeline-view";
import type { ScheduleAudience } from "@/lib/print-packets";

export const PRINT_SECTION_IDS = [
  "overview",
  "party",
  "schedule",
  "rehearsal",
  "timeline",
  "mc",
  "hair",
  "shots",
  "contacts",
  "assignments",
  "setup",
  "coordinator",
  "decor",
  "guests",
  "stay",
  "meals",
  "tasks",
  "tasksDone",
  "calendar",
  "money",
] as const;

export type PrintSectionId = (typeof PRINT_SECTION_IDS)[number];
export type PrintPresetId =
  | "binder"
  | "bride"
  | "packet"
  | "mc"
  | "party"
  | "photo"
  | "brideParents"
  | "groomParents"
  | "left";

export const PRINT_SECTION_LABELS: Record<PrintSectionId, string> = {
  overview: "Quick reference",
  party: "Wedding party",
  schedule: "Their schedule (packet only)",
  rehearsal: "Rehearsal dinner + rehearsal",
  timeline: "Wedding-day run sheet",
  mc: "MC Run of Show",
  hair: "Hair & makeup",
  shots: "Photo shot list",
  contacts: "Vendor & day-of contacts",
  assignments: "Day-of jobs",
  setup: "Setup / teardown",
  coordinator: "Coordinator scope",
  decor: "Décor / setup details",
  guests: "Guests / RSVP",
  stay: "Stay",
  meals: "Meals / food & supplies",
  tasks: "Open work",
  tasksDone: "Completed work",
  calendar: "Key dates",
  money: "Money",
};

/**
 * The master packet (David, 2026-10-10: "a single master packet that has everything but no
 * redundancies"). Three binder sections are left out because every line in them already prints
 * elsewhere in it: the MC Run of Show (each cue and song is a line of the run sheet), Setup /
 * teardown (the run sheet's moments, the décor cleanup rows, Avalon's scope and the open work),
 * and Key dates (the two days head the Thursday and Friday pages). Each can still be ticked on.
 */
export const FULL_BINDER_SECTIONS: PrintSectionId[] = [
  "overview",
  "party",
  "rehearsal",
  "timeline",
  "hair",
  "shots",
  "contacts",
  "assignments",
  "coordinator",
  "decor",
  "guests",
  "stay",
  "meals",
  "tasks",
  "money",
];

/** Avalon (coordinator) and Wendy (Mistress of Ceremonies): the whole day and everything they run. */
export const DAY_OF_PACKET_SECTIONS: PrintSectionId[] = [
  "overview",
  "rehearsal",
  "timeline",
  "mc",
  "hair",
  "shots",
  "contacts",
  "assignments",
  "setup",
  "coordinator",
  "decor",
];

/** What a bridesmaid or groomsman needs in hand, kept to a page or two. */
export const WEDDING_PARTY_PACKET_SECTIONS: PrintSectionId[] = ["overview", "party", "schedule", "contacts"];

export type PrintPacket = {
  id: PrintPresetId;
  /** Card title in the Print Center. */
  title: string;
  body: string;
  /** Small caps line on the printed title. */
  kicker: string;
  sections: PrintSectionId[];
  /** Whose schedule the "schedule" section prints. */
  audience: ScheduleAudience | null;
  /** Packets meant to stay short print continuously instead of one section per page. */
  compact: boolean;
};

export const PRINT_PACKETS: PrintPacket[] = [
  {
    id: "binder",
    title: "Master Packet",
    body: "Everything in one packet, each thing once: open work, Thursday, Friday, the wedding party and contacts, getting ready, photos, the venue, guests, stay, meals, and money.",
    kicker: "Master Packet",
    sections: FULL_BINDER_SECTIONS,
    audience: null,
    compact: false,
  },
  {
    id: "bride",
    title: "Bride's Packet",
    body: "The whole day, rehearsal, wedding party, hair & makeup, shot list, décor, contacts, and the Airbnb. No money. Getaway vehicle details stay out.",
    kicker: "Bride's Packet",
    sections: ["overview", "party", "rehearsal", "timeline", "hair", "shots", "contacts", "decor", "stay"],
    audience: null,
    compact: false,
  },
  {
    id: "packet",
    title: "Avalon & Wendy",
    body: "Coordinator and Mistress of Ceremonies: the full run sheet, rehearsal, MC cues, setup, Avalon's scope, décor, day-of jobs, and contacts.",
    kicker: "Coordinator & Mistress of Ceremonies",
    sections: DAY_OF_PACKET_SECTIONS,
    audience: null,
    compact: false,
  },
  {
    id: "mc",
    title: "MC Packet",
    body: "Kurt's moments in order, every MC cue with what to say, setup and teardown, and contacts.",
    kicker: "MC Packet",
    sections: ["overview", "schedule", "mc", "setup", "contacts"],
    audience: "mc",
    compact: true,
  },
  {
    id: "party",
    title: "Wedding Party Packet",
    body: "Who walks with whom, their own schedule from the rehearsal through the reception, and contacts. One to two pages.",
    kicker: "Wedding Party Packet",
    sections: WEDDING_PARTY_PACKET_SECTIONS,
    audience: "party",
    compact: true,
  },
  {
    id: "photo",
    title: "Photographer & Shot List",
    body: "The shot list to check off, the photo moments in order, and contacts. Save as PDF to send to Barry and Belle.",
    kicker: "Photographer · Shot List",
    sections: ["overview", "schedule", "shots", "contacts"],
    audience: "photo",
    compact: true,
  },
  {
    id: "brideParents",
    title: "Parents of the Bride",
    body: "Their schedule: getting Haley dressed, family photos, toasts, the father-daughter dance, the getaway, and the processional.",
    kicker: "Parents of the Bride",
    sections: ["overview", "party", "schedule", "contacts"],
    audience: "brideParents",
    compact: true,
  },
  {
    id: "groomParents",
    title: "Parents of the Groom",
    body: "Their schedule: photos with David and Haley, the processional, and the shared moments of the day.",
    kicker: "Parents of the Groom",
    sections: ["overview", "party", "schedule", "contacts"],
    audience: "groomParents",
    compact: true,
  },
  {
    id: "left",
    title: "What's left",
    body: "Only the open work still to do, grouped by card. Nothing that is already done.",
    kicker: "What's Left",
    sections: ["tasks"],
    audience: null,
    compact: true,
  },
];

export function printPacket(id: PrintPresetId): PrintPacket {
  return PRINT_PACKETS.find((packet) => packet.id === id) ?? PRINT_PACKETS[0]!;
}

export type PrintTimelineRow = {
  timeLabel: string;
  title: string;
  location: string | null;
  notes: string[];
};

export type PrintMcCue = {
  time: string | null;
  heading: string | null;
  momentTitle: string;
  spoken: string;
  music: string[];
  kind?: "spoken" | "music";
  nextTime?: string | null;
  nextTitle?: string | null;
  operatorNotes?: string[];
};

export type PrintContact = {
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
};

export type PrintPlaybookRow = {
  timeLabel: string | null;
  title: string;
  location: string | null;
  notes: string[];
  section: string;
};

export type PrintAssignment = {
  title: string;
  notes: string | null;
  assignees: string[];
};

export type PrintHousehold = PrintHouseholdCard;

export type PrintStaySection = PrintStaySectionView;

export type PrintMealSection = PrintMealSectionView;

export type PrintShoppingItem = {
  name: string;
  quantity: string | null;
  note: string | null;
  purchased: boolean;
};

export type PrintTask = {
  title: string;
  status: string;
  dueLabel: string | null;
  assignees: string[];
};

export type PrintCalendarEvent = {
  title: string;
  when: string;
  notes: string | null;
};

export type PrintMoneyItem = {
  name: string;
  total: number;
  paid: number;
  remaining: number;
  dueLabel: string | null;
};

export type PrintCenterDocument = {
  coupleNames: string;
  weddingDateLabel: string;
  /** "Thursday, October 15" and "Friday, October 16": the days the two schedules cover. */
  dayLabels: { rehearsal: string | null; wedding: string | null };
  timezone: string;
  mcNames: string[];
  quickReference: PrintQuickReference;
  /**
   * Every moment exactly as the Wedding Day and Thursday pages read it. Every printed
   * schedule (binder run sheet, rehearsal, each packet's own schedule) is drawn from these.
   */
  moments: { rehearsal: ReviewMoment[]; wedding: ReviewMoment[] };
  /** The wedding-day moments as the bride's packet prints them: getaway vehicle details left out. */
  brideMoments: ReviewMoment[];
  mcCues: PrintMcCue[];
  vendorContacts: PrintContact[];
  dayOfContacts: PrintContact[];
  otherContacts: PrintContact[];
  assignments: PrintAssignment[];
  setupContacts: PrintContact[];
  setupMoments: PrintTimelineRow[];
  setupConfirmed: PrintSetupConfirmed[];
  setupOpen: string[];
  setupDecor: PrintPlaybookRow[];
  coordinatorScope: PrintPlaybookRow[];
  hairMakeup: PrintPlaybookRow[];
  hairRooms: PrintHairRoom[];
  hairSchedule: PrintHairRow[];
  shots: PrintPlaybookRow[];
  shotGroups: PrintShotGroup[];
  households: PrintHousehold[];
  rsvpSummary: PrintRsvpSummary | null;
  stay: PrintStaySection[];
  mealsPublished: boolean;
  mealChoiceCount: number;
  meals: PrintMealSection[];
  shopping: PrintShoppingItem[];
  tasks: PrintTask[];
  taskGroups: PrintTaskGroupView[];
  doneTaskGroups: PrintTaskGroupView[];
  calendar: PrintCalendarEvent[];
  money: {
    committed: number;
    paid: number;
    remaining: number;
    items: PrintMoneyItem[];
  };
  weddingParty: PrintWeddingPartyView;
  availableSections: PrintSectionId[];
};

const MUSIC_LINE =
  /^(Playlist|Music|Grand Entrance Song|After Dollar Dance)\s*:\s*(.+)$/i;
const CUE_LINE = /^(MC cue(?:\s+at)?|Dinner cue)\b(.*)$/i;
const SETUP_MOMENT = /venue opens|tear down|clean up|setup|teardown/i;
const SETUP_ROLE = /setup|teardown|clean/i;
const VENDOR_ROLE =
  /planner|venue|photo|video|cater|dj|florist|bar|coordinator|officiant/i;
const MC_LABEL =
  /(^|\b)(mc|master of ceremonies|mistress of ceremonies|mistress of ceremony)(\b|$)/i;

function chronological<T extends { startAt: string; sortOrder?: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const cmp = compareParsedTimes(parseDayOfTime(a.startAt), parseDayOfTime(b.startAt));
    if (cmp !== 0) return cmp;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });
}

export const PRINT_PRESET_IDS: PrintPresetId[] = PRINT_PACKETS.map((packet) => packet.id);

export function sectionsForPreset(preset: PrintPresetId): PrintSectionId[] {
  return [...printPacket(preset).sections];
}

/**
 * The preset still in force after a section toggle: the current one while the
 * selection matches it, else the first preset whose sections match exactly.
 */
export function activePreset(
  selected: Iterable<PrintSectionId>,
  current: PrintPresetId | null = null,
  available?: readonly PrintSectionId[],
): PrintPresetId | null {
  const have = [...selected];
  if (current && presetMatchesSelection(current, have, available)) return current;
  return PRINT_PRESET_IDS.find((preset) => presetMatchesSelection(preset, have, available)) ?? null;
}

export function printTitleKicker(preset: PrintPresetId | null): string {
  return preset ? printPacket(preset).kicker : "Wedding Binder";
}

export function presetMatchesSelection(
  preset: PrintPresetId,
  selected: Iterable<PrintSectionId>,
  /** Sections this session can print; a packet missing one it cannot see still counts. */
  available?: readonly PrintSectionId[],
): boolean {
  const wanted = sectionsForPreset(preset).filter((id) => !available || available.includes(id));
  const have = new Set(selected);
  if (have.size !== wanted.length) return false;
  return wanted.every((id) => have.has(id));
}

export function toggleSection(
  selected: Iterable<PrintSectionId>,
  id: PrintSectionId,
): PrintSectionId[] {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return PRINT_SECTION_IDS.filter((section) => next.has(section));
}

export function assignmentOwnerLabel(assignees: string[]): string {
  return assignees.length > 0 ? assignees.join(" · ") : "UNASSIGNED";
}

export function formatPrintMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function formatPrintWeddingDate(date: Date, timeZone: string): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone,
  });
}

export function formatTimelineTimeLabel(startAt: string, endAt: string | null): string {
  return formatPrintTimeRange(startAt, endAt);
}

export function isMcDirectoryLabel(label: string | null | undefined): boolean {
  return MC_LABEL.test(label ?? "");
}

export function mcPeopleFromDirectory(
  people: Array<{ name: string; directoryLabel?: string | null }>,
): string[] {
  return people
    .filter((person) => isMcDirectoryLabel(person.directoryLabel))
    .map((person) => person.name.trim())
    .filter(Boolean);
}

export function isVendorPrintContact(contact: {
  name: string;
  directoryLabel?: string | null;
  directoryList?: string | null;
}): boolean {
  if (contact.directoryList === "vendors") return true;
  if (contact.name.includes("·")) return true;
  return VENDOR_ROLE.test(contact.directoryLabel ?? "");
}

export function isSetupTeardownContact(contact: {
  name: string;
  directoryLabel?: string | null;
}): boolean {
  return SETUP_ROLE.test(`${contact.directoryLabel ?? ""} ${contact.name}`);
}

export function toPrintPlaybookRow(item: {
  startAt: string | null;
  title: string;
  location: string | null;
  notes: string | null;
  detail: string | null;
  section: string;
}): PrintPlaybookRow {
  const notes = professionalizePrintLines(
    [item.detail, item.notes].filter((line): line is string => Boolean(line?.trim())),
  );
  return {
    timeLabel: item.startAt ? normalizePrintTime(item.startAt) : null,
    title: professionalizePrintLine(item.title) ?? item.title,
    location: item.location,
    notes,
    section: item.section,
  };
}

export function toPrintTimelineRow(block: {
  startAt: string;
  endAt: string | null;
  notes: string;
}): PrintTimelineRow {
  const parsed = parseBlockNotes(block.notes);
  return {
    timeLabel: formatTimelineTimeLabel(block.startAt, block.endAt),
    title: parsed.title,
    location: parsed.location,
    notes: professionalizePrintLines(parsed.detailLines.filter((line) => !MUSIC_LINE.test(line) && !CUE_LINE.test(line))),
  };
}

function parseCueLine(line: string, momentTitle: string): PrintMcCue | null {
  const match = line.match(CUE_LINE);
  if (!match) return null;
  let rest = (match[2] ?? "").trim();
  rest = rest.replace(/^at\s+/i, "");

  let time: string | null = null;
  const immediate = rest.match(/^immediately after(?: 5:00\s*pm)? entrance\b/i);
  const clock = rest.match(/^(\d{1,2}:\d{2}\s*(?:AM|PM)?)\b/i);
  if (immediate) {
    time = "Immediately after 5:00 PM entrance";
    rest = rest.slice(immediate[0].length).trim();
  } else if (clock) {
    time = normalizePrintTime(clock[1]!);
    rest = rest.slice(clock[0].length).trim();
  }

  rest = rest.replace(/^[—–-]\s*/, "");
  let heading: string | null = null;
  let spoken = rest;
  const colon = rest.indexOf(":");
  if (colon >= 0) {
    const before = rest.slice(0, colon).trim();
    const after = rest.slice(colon + 1).trim();
    if (before) heading = before;
    spoken = after;
  }
  spoken = spoken.replace(/^["“]+|["”]+$/g, "").trim();
  if (!spoken) return null;
  return {
    time,
    heading,
    momentTitle,
    spoken,
    music: [],
    kind: "spoken",
  };
}

function parseMusicParts(line: string): { kind: string; value: string; label: string } | null {
  const match = line.match(MUSIC_LINE);
  if (!match) return null;
  const kind = match[1]!.trim();
  const value = match[2]!.trim();
  if (!value) return null;
  return { kind, value, label: `${kind}: ${value}` };
}

function spokenSimilar(a: string, b: string): boolean {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return false;
  return left === right || left.startsWith(right) || right.startsWith(left);
}

function mergeDuplicateCues(cues: PrintMcCue[]): PrintMcCue[] {
  const out: PrintMcCue[] = [];
  for (const cue of cues) {
    const existing = out.find(
      (row) => row.time === cue.time && spokenSimilar(row.spoken, cue.spoken),
    );
    if (!existing) {
      out.push({ ...cue, music: [...cue.music] });
      continue;
    }
    if (cue.spoken.length > existing.spoken.length) existing.spoken = cue.spoken;
    if (cue.heading && (!existing.heading || cue.heading.length > existing.heading.length)) {
      existing.heading = cue.heading;
    }
    for (const line of cue.music) {
      if (!existing.music.includes(line)) existing.music.push(line);
    }
  }
  return out;
}

function cueMatchesTarget(cue: PrintMcCue, target: string): boolean {
  const blob = `${cue.heading ?? ""} ${cue.momentTitle} ${cue.spoken} ${cue.time ?? ""}`.toLowerCase();
  switch (target) {
    case "entrance":
      return /5:00 pm/.test(cue.time ?? "") || /welcome the wedding party|newlyweds/i.test(cue.spoken);
    case "dollar":
      return /dollar dance/i.test(blob);
    case "last":
      return /last call|final dance|last dance/i.test(blob) && !/conclusion/i.test(blob);
    case "first-dance":
      return /first dance/i.test(blob) || /center of the space/i.test(cue.spoken);
    case "kids":
      return /7:00 pm/.test(cue.time ?? "") || /dance floor is officially open/i.test(cue.spoken);
    case "adults":
      return /8:15 pm/.test(cue.time ?? "");
    case "dinner-bed":
      return /immediately after 5:00 pm entrance/i.test(cue.time ?? "") || /feast begin/i.test(cue.spoken);
    default:
      return false;
  }
}

export function extractMcCues(
  blocks: Array<{ startAt: string; endAt: string | null; notes: string; schedule?: string | null }>,
): PrintMcCue[] {
  const cues: PrintMcCue[] = [];
  for (const block of chronological(
    blocks.filter((row) => parseTimelineSchedule(row.schedule) === "wedding"),
  )) {
    const parsed = parseBlockNotes(block.notes);
    const lines = block.notes
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(1);
    const blockCues: PrintMcCue[] = [];
    const musicItems: Array<{ kind: string; value: string; label: string }> = [];
    for (const line of lines) {
      const music = parseMusicParts(line);
      if (music) {
        musicItems.push(music);
        continue;
      }
      const cue = parseCueLine(line, parsed.title);
      if (cue) blockCues.push(cue);
    }

    for (const music of musicItems) {
      const target = musicAttachTarget(music.kind, music.value);
      if (target === "processional" || target === "waiting") continue;
      const match = target
        ? blockCues.find((cue) => cueMatchesTarget(cue, target))
        : null;
      if (match && !match.music.includes(music.label)) match.music.push(music.label);
    }

    cues.push(...blockCues);
  }
  return mergeDuplicateCues(cues);
}

export function groupPrintContacts(
  contacts: Array<{
    name: string;
    directoryLabel?: string | null;
    directoryList?: string | null;
    phone: string | null;
    email: string | null;
    isDayOfContact?: boolean;
    sortOrder?: number;
  }>,
): {
  vendors: PrintContact[];
  dayOf: PrintContact[];
  other: PrintContact[];
} {
  const ordered = [...contacts].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name),
  );
  const vendors: PrintContact[] = [];
  const dayOf: PrintContact[] = [];
  const other: PrintContact[] = [];
  const seen = new Set<string>();
  const asPrint = (contact: (typeof ordered)[number]): PrintContact => ({
    name: contact.name,
    role: printContactRole(contact.name, contact.directoryLabel),
    phone: contact.phone?.trim() || null,
    email: contact.email?.trim() || null,
  });
  const keyFor = (contact: PrintContact) =>
    `${contact.name.toLowerCase()}|${contact.phone ?? ""}|${contact.email ?? ""}`;

  for (const contact of ordered) {
    if (!isVendorPrintContact(contact)) continue;
    const row = asPrint(contact);
    const key = keyFor(row);
    if (seen.has(key)) continue;
    seen.add(key);
    vendors.push(row);
  }
  for (const contact of ordered) {
    if (!contact.isDayOfContact) continue;
    const row = asPrint(contact);
    const key = keyFor(row);
    if (seen.has(key)) continue;
    seen.add(key);
    dayOf.push(row);
  }
  for (const contact of ordered) {
    const row = asPrint(contact);
    const key = keyFor(row);
    if (seen.has(key)) continue;
    seen.add(key);
    other.push(row);
  }
  return { vendors, dayOf, other };
}

export function setupTeardownFromCanonical(input: {
  contacts: Array<{
    name: string;
    directoryLabel?: string | null;
    phone: string | null;
    email: string | null;
    sortOrder?: number;
  }>;
  blocks: Array<{ startAt: string; endAt: string | null; notes: string; schedule?: string | null }>;
}): { contacts: PrintContact[]; moments: PrintTimelineRow[] } {
  const contacts = [...input.contacts]
    .filter(isSetupTeardownContact)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
    .map((contact) => ({
      name: contact.name,
      role: printContactRole(contact.name, contact.directoryLabel),
      phone: contact.phone?.trim() || null,
      email: contact.email?.trim() || null,
    }));
  const moments = chronological(
    input.blocks.filter((block) => parseTimelineSchedule(block.schedule) === "wedding"),
  )
    .filter((block) => SETUP_MOMENT.test(parseBlockNotes(block.notes).title) || SETUP_MOMENT.test(block.notes))
    .filter((block) => {
      const title = parseBlockNotes(block.notes).title;
      return /venue opens|tear down|clean up/i.test(title);
    })
    .map(toPrintTimelineRow);
  return { contacts, moments };
}

export function moneyFingerprint(contracts: BudgetContractSnapshot[]): PrintCenterDocument["money"] {
  const summary = buildMoneySummary(contracts);
  return {
    committed: summary.committed,
    paid: summary.paid,
    remaining: summary.remaining,
    items: contracts.map((item) => {
      const paid = contractPaidTotal(item);
      return {
        name: item.name,
        total: item.price,
        paid,
        remaining: Math.max(0, item.price - paid),
        dueLabel: item.payByDate
          ? item.payByDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          : null,
      };
    }),
  };
}

export function staySectionsFromSlots(
  slots: Array<{ sectionId: string; label: string; occupant: string; optional?: boolean }>,
  notes: Array<{ sectionId: string; note: string }>,
): PrintStaySection[] {
  return projectStaySections(slots, notes);
}

export function mealSectionsFromGuests(
  guests: Array<{
    name: string;
    sectionId: string;
    choices: Record<string, string>;
  }>,
  courses: Array<{ id: string; label: string; options: Array<{ id: string; label: string }> }>,
): PrintMealSection[] {
  return projectMealSections(guests, courses);
}

export function householdsFromGuests(
  guests: Array<{
    rsvpStatus: string;
    people: Array<{ name: string; rsvpStatus?: string }>;
    nameLine1?: string;
    nameLine2?: string | null;
  }>,
): PrintHousehold[] {
  return projectHouseholds(guests).households;
}

export function sectionHasContent(doc: PrintCenterDocument, id: PrintSectionId): boolean {
  switch (id) {
    case "overview":
      return Boolean(doc.coupleNames || doc.weddingDateLabel);
    case "party":
      return doc.weddingParty.members.length + doc.weddingParty.processional.length > 0;
    case "schedule":
      return doc.moments.wedding.length + doc.moments.rehearsal.length > 0;
    case "rehearsal":
      return doc.moments.rehearsal.length > 0;
    case "timeline":
      return doc.moments.wedding.length > 0;
    case "mc":
      // A name alone is not a run of show; with no cue lines the section stays off the page.
      return doc.mcCues.length > 0;
    case "hair":
      return doc.hairRooms.length + doc.hairSchedule.length + doc.hairMakeup.length > 0;
    case "shots":
      return doc.shotGroups.length > 0 || doc.shots.length > 0;
    case "contacts":
      return doc.vendorContacts.length + doc.dayOfContacts.length > 0;
    case "assignments":
      return doc.assignments.length > 0;
    case "setup":
      return (
        doc.setupContacts.length +
          doc.setupMoments.length +
          doc.setupConfirmed.length +
          doc.setupOpen.length >
        0
      );
    case "coordinator":
      return doc.coordinatorScope.length > 0;
    case "decor":
      return doc.setupDecor.length > 0;
    case "guests":
      return doc.households.length > 0;
    case "stay":
      // The mini moon always has something to say, even before the Airbnb rooms are set.
      return true;
    case "meals":
      return doc.meals.length > 0 || doc.shopping.length > 0;
    case "tasks":
      return doc.taskGroups.length > 0;
    case "tasksDone":
      return doc.doneTaskGroups.length > 0;
    case "calendar":
      return doc.calendar.length > 0;
    case "money":
      return doc.money.items.length > 0;
  }
}

export function printableSections(
  doc: PrintCenterDocument,
  selected: Iterable<PrintSectionId>,
  /** The master packet: its own reading order, and a section prints only with something of its own. */
  master = false,
): PrintSectionId[] {
  const chosen = new Set(selected);
  const printed = PRINT_SECTION_IDS.filter(
    (id) =>
      chosen.has(id) &&
      doc.availableSections.includes(id) &&
      (master ? masterSectionHasContent(doc, id) : sectionHasContent(doc, id)),
  );
  if (master) {
    const ordered = MASTER_ORDER.filter((id) => printed.includes(id));
    return [...ordered, ...printed.filter((id) => !ordered.includes(id))];
  }
  // David, 2026-10-10: in a binder the open items come first, then Thursday's and
  // Friday's schedules, then everything else. Packets without open work keep their order.
  if (!printed.includes("tasks")) return printed;
  const first = BINDER_PRIORITY.filter((id) => printed.includes(id));
  return [...first, ...printed.filter((id) => !first.includes(id))];
}

const BINDER_PRIORITY: PrintSectionId[] = ["tasks", "rehearsal", "timeline"];

/**
 * The master packet's reading order: open work, Thursday, Friday (as every binder), then
 * people, getting ready and photos, the venue, guests and stay, money. The quick reference
 * prints on the cover, so it is not a page of its own.
 */
export const MASTER_ORDER: PrintSectionId[] = [
  "overview",
  "tasks",
  "rehearsal",
  "timeline",
  "party",
  "contacts",
  "assignments",
  "hair",
  "shots",
  "coordinator",
  "decor",
  "guests",
  "stay",
  "meals",
  "money",
  "tasksDone",
];

/** Sections that open a new page in the master packet; the rest run on under the one before. */
const MASTER_CHAPTERS: PrintSectionId[][] = [
  ["tasks"],
  ["rehearsal"],
  ["timeline"],
  ["party", "contacts", "assignments"],
  ["hair", "shots"],
  ["coordinator", "decor"],
  ["guests", "stay", "meals"],
  ["money"],
  ["tasksDone"],
];

export type MasterChapter = { number: number; sections: PrintSectionId[] };

/**
 * The printed sections grouped into chapters, numbered in print order. A chapter whose
 * first section is empty starts at the next one; a section ticked on by hand that no
 * chapter names (the run of show, setup, key dates) gets a chapter of its own.
 */
export function masterChapters(visible: PrintSectionId[]): MasterChapter[] {
  const body = visible.filter((id) => id !== "overview");
  const chapters: MasterChapter[] = [];
  const placed = new Set<PrintSectionId>();
  for (const id of body) {
    if (placed.has(id)) continue;
    const group = MASTER_CHAPTERS.find((chapter) => chapter.includes(id)) ?? [id];
    const sections = body.filter((section) => group.includes(section) && !placed.has(section));
    sections.forEach((section) => placed.add(section));
    chapters.push({ number: chapters.length + 1, sections });
  }
  return chapters;
}

/** "Belle Genton · Videographer" already says what "Videographer" under it would. */
export function contactRoleRepeatsName(contact: { name: string; role: string | null }): boolean {
  if (!contact.role) return false;
  const role = contact.role.trim().toLowerCase();
  return contact.name
    .split("·")
    .slice(1)
    .some((part) => part.trim().toLowerCase() === role);
}

const digits = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
const firstName = (name: string) => name.trim().split(/\s+/)[0]!.toLowerCase();

/**
 * The master packet's contacts, each person once. A day-of contact who is in the wedding
 * party roster is left to the roster (it prints the same phone) unless this contact has a
 * different number; cleanup contacts the setup page used to list join the day-of list when
 * they are not already printed.
 */
export function masterContacts(doc: PrintCenterDocument): { vendors: PrintContact[]; dayOf: PrintContact[] } {
  const roster = new Map(doc.weddingParty.members.map((member) => [firstName(member.name), member]));
  const printed = new Set(doc.vendorContacts.map((row) => row.name.trim().toLowerCase()));
  const dayOf: PrintContact[] = [];
  for (const row of [...doc.dayOfContacts, ...doc.setupContacts]) {
    const key = row.name.trim().toLowerCase();
    if (printed.has(key)) continue;
    const member = roster.get(firstName(row.name));
    if (member && !row.email && (!row.phone || digits(row.phone) === digits(member.phone))) continue;
    printed.add(key);
    dayOf.push(row);
  }
  return { vendors: doc.vendorContacts, dayOf };
}

/** Lines the master packet already prints as a contact: their phone numbers and emails. */
function contactMarks(contacts: PrintContact[]): { phones: Set<string>; emails: Set<string> } {
  return {
    phones: new Set(contacts.map((row) => digits(row.phone)).filter((value) => value.length >= 7)),
    emails: new Set(contacts.map((row) => row.email?.trim().toLowerCase() ?? "").filter(Boolean)),
  };
}

function restatesContact(line: string, marks: ReturnType<typeof contactMarks>): boolean {
  const phones = line.match(/\(?\d{3}\)?[\s.-]*\d{3}[\s.-]*\d{4}/g) ?? [];
  const emails = line.match(/[^\s@·]+@[^\s@·]+\.[a-z]{2,}/gi) ?? [];
  if (!phones.length && !emails.length) return false;
  return (
    phones.every((phone) => marks.phones.has(digits(phone))) &&
    emails.every((email) => marks.emails.has(email.toLowerCase()))
  );
}

const sameLine = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Avalon's scope and the décor list as the master packet prints them: a line that only
 * repeats a printed contact's number or email is left out (the contacts page has it), a
 * décor line that reads exactly like a line of Avalon's scope prints once (under her scope),
 * and a row left with nothing but a heading that had lines of its own is left out.
 */
export function masterPlaybookRows(doc: PrintCenterDocument): {
  coordinator: PrintPlaybookRow[];
  decor: PrintPlaybookRow[];
} {
  const contacts = masterContacts(doc);
  const marks = contactMarks([...contacts.vendors, ...contacts.dayOf]);
  const keep = (rows: PrintPlaybookRow[], drop: (line: string) => boolean) =>
    rows.flatMap((row) => {
      const notes = row.notes.filter((line) => !drop(line));
      if (row.notes.length > 0 && notes.length === 0 && !row.location) return [];
      return [{ ...row, notes }];
    });
  const coordinator = keep(doc.coordinatorScope, (line) => restatesContact(line, marks));
  const scopeLines = new Set(coordinator.flatMap((row) => row.notes.map(sameLine)));
  const decor = doc.setupDecor.map((row) => ({
    ...row,
    notes: row.notes.filter((line) => !restatesContact(line, marks) && !scopeLines.has(sameLine(line))),
  }));
  return { coordinator, decor };
}

/**
 * The quick reference on the master packet's cover: the places, and only the people the
 * contacts pages do not already list. Times live on the Thursday and Friday pages.
 */
export function masterQuickReference(doc: PrintCenterDocument): PrintQuickReference {
  const contacts = masterContacts(doc);
  const listed = new Set([...contacts.vendors, ...contacts.dayOf].map((row) => row.name.trim().toLowerCase()));
  const roster = new Set(doc.weddingParty.members.map((member) => member.name.trim().toLowerCase()));
  const unlisted = (name: string | null) =>
    name && !listed.has(name.trim().toLowerCase()) && !roster.has(name.trim().toLowerCase()) ? name : null;
  const ref = doc.quickReference;
  const coordinatorName = unlisted(ref.coordinatorName);
  return {
    ...ref,
    ceremonyTime: null,
    receptionEnds: null,
    venueCloses: null,
    rsvp: null,
    coordinatorName,
    coordinatorPhone: coordinatorName ? ref.coordinatorPhone : null,
    mistressOfCeremonies: unlisted(ref.mistressOfCeremonies),
    mcName: unlisted(ref.mcName),
  };
}

/**
 * The hair & makeup plan's notes the run sheet does not already carry, by who they are for.
 * The master packet prints these instead of the hair time table: the run sheet is the one
 * schedule (its times win where the two disagree), and nothing the table says is lost.
 */
export function masterHairNotes(doc: PrintCenterDocument): Array<{ who: string; notes: string[] }> {
  const onRunSheet = new Set(
    doc.moments.wedding.flatMap((moment) => [moment.title, ...moment.details.map((detail) => detail.text)].map(sameLine)),
  );
  const out: Array<{ who: string; notes: string[] }> = [];
  for (const row of doc.hairSchedule) {
    const notes = row.notes.filter((note) => note.trim() && !onRunSheet.has(sameLine(note)));
    if (!notes.length) continue;
    const existing = out.find((entry) => entry.who === row.person);
    if (existing) existing.notes.push(...notes.filter((note) => !existing.notes.includes(note)));
    else out.push({ who: row.person, notes });
  }
  return out;
}

/**
 * Whether a section has anything of its own to print in the master packet. Hair & makeup
 * keeps its room key and the plan's own notes there; its time table is left out, because
 * the run sheet is the one schedule and the table's times can disagree with it.
 */
/**
 * Before the menu is published the meals page is only the guest list again ("awaiting
 * selections"), which the wedding party and guest pages already carry.
 */
export function masterShowsMealChoices(doc: PrintCenterDocument): boolean {
  return doc.meals.length > 0 && doc.mealsPublished;
}

export function masterSectionHasContent(doc: PrintCenterDocument, id: PrintSectionId): boolean {
  switch (id) {
    case "hair":
      return doc.hairRooms.length > 0 || masterHairNotes(doc).length > 0;
    case "contacts": {
      const contacts = masterContacts(doc);
      return contacts.vendors.length + contacts.dayOf.length > 0;
    }
    case "coordinator":
      return masterPlaybookRows(doc).coordinator.length > 0;
    case "meals":
      return masterShowsMealChoices(doc) || doc.shopping.length > 0;
    default:
      return sectionHasContent(doc, id);
  }
}

export function documentContainsInternalSecrets(text: string): boolean {
  return /pinHash|PinAccount|ws_session|DATABASE_URL|PIN_SESSION_SECRET/i.test(text);
}

export function triggerBrowserPrint(api: { print: () => void } = globalThis): void {
  api.print();
}

/** The places with no timeline to read: the same source the quick reference uses. */
const EMPTY_PLACES = weddingPlacesFromPlan([]);

export function emptyPrintDocument(): PrintCenterDocument {
  return {
    coupleNames: "David & Haley",
    weddingDateLabel: "Friday, October 16, 2026",
    dayLabels: { rehearsal: null, wedding: null },
    timezone: "America/Detroit",
    mcNames: [],
    quickReference: {
      coupleNames: "David & Haley",
      weddingDateLabel: "Friday, October 16, 2026",
      ceremonyTime: "3:30 PM",
      venueName: EMPTY_PLACES.venue.name,
      venueAddress: EMPTY_PLACES.venue.address,
      airbnbName: EMPTY_PLACES.lodging.name,
      airbnbAddress: EMPTY_PLACES.lodging.address,
      rehearsalDinnerName: EMPTY_PLACES.rehearsalDinner.name,
      rehearsalDinnerAddress: EMPTY_PLACES.rehearsalDinner.address,
      coordinatorName: "Avalon Green",
      coordinatorPhone: null,
      mistressOfCeremonies: null,
      mcName: null,
      receptionEnds: "10:00 PM",
      venueCloses: "11:00 PM",
      rsvp: null,
    },
    moments: { rehearsal: [], wedding: [] },
    brideMoments: [],
    mcCues: [],
    vendorContacts: [],
    dayOfContacts: [],
    otherContacts: [],
    assignments: [],
    setupContacts: [],
    setupMoments: [],
    setupConfirmed: [],
    setupOpen: [],
    setupDecor: [],
    coordinatorScope: [],
    hairMakeup: [],
    hairRooms: [],
    hairSchedule: [],
    shots: [],
    shotGroups: [],
    households: [],
    rsvpSummary: null,
    stay: [],
    mealsPublished: false,
    mealChoiceCount: 0,
    meals: [],
    shopping: [],
    tasks: [],
    taskGroups: [],
    doneTaskGroups: [],
    calendar: [],
    money: { committed: 0, paid: 0, remaining: 0, items: [] },
    weddingParty: {
      theme: null,
      colors: [],
      members: [],
      processional: [],
      lineUpTime: null,
      moments: [],
      openItems: [],
    },
    availableSections: [...PRINT_SECTION_IDS],
  };
}
