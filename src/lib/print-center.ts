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

export const FULL_BINDER_SECTIONS: PrintSectionId[] = [
  "overview",
  "party",
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
  "calendar",
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
    title: "Groom's Binder",
    body: "Everything: operations, guests, stay, meals, open work, key dates, and money.",
    kicker: "Wedding Binder",
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
): PrintSectionId[] {
  const chosen = new Set(selected);
  const printed = PRINT_SECTION_IDS.filter(
    (id) => chosen.has(id) && doc.availableSections.includes(id) && sectionHasContent(doc, id),
  );
  // David, 2026-10-10: in a binder the open items come first, then Thursday's and
  // Friday's schedules, then everything else. Packets without open work keep their order.
  if (!printed.includes("tasks")) return printed;
  const first = BINDER_PRIORITY.filter((id) => printed.includes(id));
  return [...first, ...printed.filter((id) => !first.includes(id))];
}

const BINDER_PRIORITY: PrintSectionId[] = ["tasks", "rehearsal", "timeline"];

export function documentContainsInternalSecrets(text: string): boolean {
  return /pinHash|PinAccount|ws_session|DATABASE_URL|PIN_SESSION_SECRET/i.test(text);
}

export function triggerBrowserPrint(api: { print: () => void } = globalThis): void {
  api.print();
}

export function emptyPrintDocument(): PrintCenterDocument {
  return {
    coupleNames: "David & Haley",
    weddingDateLabel: "Friday, October 16, 2026",
    timezone: "America/Detroit",
    mcNames: [],
    quickReference: {
      coupleNames: "David & Haley",
      weddingDateLabel: "Friday, October 16, 2026",
      ceremonyTime: "3:30 PM",
      venueName: "Black Sheep Shelter",
      venueAddress: ["342 62nd St", "South Haven, MI 49090"],
      airbnbName: "Airbnb",
      airbnbAddress: ["10268 51st St", "Grand Junction, MI 49056"],
      rehearsalDinnerName: "Hawkshead",
      rehearsalDinnerAddress: ["523 Hawks Nest Dr", "South Haven, MI"],
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
