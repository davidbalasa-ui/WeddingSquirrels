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
  type PrintRunSheetPhase,
  type PrintSetupConfirmed,
  type PrintShotGroup,
  type PrintStaySectionView,
  type PrintTaskGroupView,
} from "@/lib/print-projection";

export const PRINT_SECTION_IDS = [
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
  "guests",
  "stay",
  "meals",
  "tasks",
  "calendar",
  "money",
] as const;

export type PrintSectionId = (typeof PRINT_SECTION_IDS)[number];
export type PrintPresetId = "binder" | "packet";

export const PRINT_SECTION_LABELS: Record<PrintSectionId, string> = {
  overview: "Quick reference",
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
  calendar: "Key dates",
  money: "Money",
};

export const FULL_BINDER_SECTIONS: PrintSectionId[] = [
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
  "guests",
  "stay",
  "meals",
  "tasks",
  "calendar",
  "money",
];

export const DAY_OF_PACKET_SECTIONS: PrintSectionId[] = [
  "overview",
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
  rehearsal: PrintTimelineRow[];
  timeline: PrintTimelineRow[];
  runSheet: PrintRunSheetPhase[];
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
  calendar: PrintCalendarEvent[];
  money: {
    committed: number;
    paid: number;
    remaining: number;
    items: PrintMoneyItem[];
  };
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

export function sectionsForPreset(preset: PrintPresetId): PrintSectionId[] {
  return preset === "packet" ? [...DAY_OF_PACKET_SECTIONS] : [...FULL_BINDER_SECTIONS];
}

export function presetMatchesSelection(
  preset: PrintPresetId,
  selected: Iterable<PrintSectionId>,
): boolean {
  const wanted = sectionsForPreset(preset);
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
    case "rehearsal":
      return doc.rehearsal.length > 0;
    case "timeline":
      return doc.runSheet.length > 0 || doc.timeline.length > 0;
    case "mc":
      return doc.mcCues.length > 0 || doc.mcNames.length > 0;
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
      return doc.stay.length > 0;
    case "meals":
      return doc.meals.length > 0 || doc.shopping.length > 0;
    case "tasks":
      return doc.taskGroups.length > 0 || doc.tasks.length > 0;
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
  return PRINT_SECTION_IDS.filter(
    (id) => chosen.has(id) && doc.availableSections.includes(id) && sectionHasContent(doc, id),
  );
}

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
    rehearsal: [],
    timeline: [],
    runSheet: [],
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
    calendar: [],
    money: { committed: 0, paid: 0, remaining: 0, items: [] },
    availableSections: [...PRINT_SECTION_IDS],
  };
}
