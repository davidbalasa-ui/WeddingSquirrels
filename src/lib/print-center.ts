import { parseBlockNotes } from "@/lib/day-of-now";
import { compareParsedTimes, parseDayOfTime, parseTimelineSchedule } from "@/lib/day-of-time";
import { guestAddressLines } from "@/lib/guest-gifts";
import { MEAL_SECTIONS } from "@/lib/meals";
import { buildMoneySummary, contractPaidTotal, type BudgetContractSnapshot } from "@/lib/money";
import { STAY_SECTIONS } from "@/lib/stay";

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
  "guests",
  "stay",
  "meals",
  "shopping",
  "tasks",
  "calendar",
  "money",
] as const;

export type PrintSectionId = (typeof PRINT_SECTION_IDS)[number];
export type PrintPresetId = "binder" | "packet";

export const PRINT_SECTION_LABELS: Record<PrintSectionId, string> = {
  overview: "Wedding overview",
  rehearsal: "Rehearsal dinner + rehearsal",
  timeline: "Wedding-day timeline",
  mc: "MC & music cues",
  hair: "Hair & makeup",
  shots: "Photo shot list",
  contacts: "Vendor & day-of contacts",
  assignments: "Day assignments / responsibilities",
  setup: "Setup / teardown",
  guests: "Guests / households",
  stay: "Stay",
  meals: "Meals",
  shopping: "Shopping",
  tasks: "Tasks",
  calendar: "Calendar",
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
  "guests",
  "stay",
  "meals",
  "shopping",
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

export type PrintHousehold = {
  names: string[];
  addressLines: string[];
  rsvp: string;
};

export type PrintStaySection = {
  title: string;
  detail: string | null;
  slots: Array<{ label: string; occupant: string }>;
  notes: string[];
};

export type PrintMealSection = {
  title: string;
  guests: Array<{ name: string; selection: string | null }>;
};

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
  rehearsal: PrintTimelineRow[];
  timeline: PrintTimelineRow[];
  mcCues: PrintMcCue[];
  vendorContacts: PrintContact[];
  dayOfContacts: PrintContact[];
  otherContacts: PrintContact[];
  assignments: PrintAssignment[];
  setupContacts: PrintContact[];
  setupMoments: PrintTimelineRow[];
  setupDecor: PrintPlaybookRow[];
  coordinatorScope: PrintPlaybookRow[];
  hairMakeup: PrintPlaybookRow[];
  shots: PrintPlaybookRow[];
  households: PrintHousehold[];
  stay: PrintStaySection[];
  mealsPublished: boolean;
  mealChoiceCount: number;
  meals: PrintMealSection[];
  shopping: PrintShoppingItem[];
  tasks: PrintTask[];
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
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone,
  });
}

export function formatTimelineTimeLabel(startAt: string, endAt: string | null): string {
  if (endAt?.trim()) return `${startAt} – ${endAt}`;
  return startAt;
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
  const notes = [item.detail, item.notes].filter((line): line is string => Boolean(line?.trim()));
  return {
    timeLabel: item.startAt,
    title: item.title,
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
    notes: parsed.detailLines,
  };
}

function parseCueLine(line: string, momentTitle: string): PrintMcCue | null {
  const match = line.match(CUE_LINE);
  if (!match) return null;
  let rest = (match[2] ?? "").trim();
  rest = rest.replace(/^at\s+/i, "");

  let time: string | null = null;
  const immediate = rest.match(/^immediately after entrance\b/i);
  const clock = rest.match(/^(\d{1,2}:\d{2}\s*(?:AM|PM)?)\b/i);
  if (immediate) {
    time = "Immediately after entrance";
    rest = rest.slice(immediate[0].length).trim();
  } else if (clock) {
    time = clock[1]!.replace(/\s+/g, " ").trim();
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
  };
}

function parseMusicLine(line: string): string | null {
  const match = line.match(MUSIC_LINE);
  if (!match) return null;
  const kind = match[1]!.trim();
  const value = match[2]!.trim();
  if (!value) return null;
  return kind.toLowerCase() === "playlist" || kind.toLowerCase() === "music"
    ? `${kind}: ${value}`
    : `${kind}: ${value}`;
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
    let pendingMusic: string[] = [];
    let current: PrintMcCue | null = null;
    for (const line of lines) {
      const music = parseMusicLine(line);
      if (music) {
        if (current) current.music.push(music);
        else pendingMusic.push(music);
        continue;
      }
      const cue = parseCueLine(line, parsed.title);
      if (cue) {
        cue.music = [...pendingMusic, ...cue.music];
        pendingMusic = [];
        current = cue;
        cues.push(cue);
      }
    }
  }
  return cues;
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
    role: contact.directoryLabel?.trim() || null,
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
      role: contact.directoryLabel?.trim() || null,
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
  slots: Array<{ sectionId: string; label: string; occupant: string }>,
  notes: Array<{ sectionId: string; note: string }>,
): PrintStaySection[] {
  const bySection = new Map<string, PrintStaySection>();
  for (const def of STAY_SECTIONS) {
    bySection.set(def.id, {
      title: def.title,
      detail: def.detail,
      slots: [],
      notes: [],
    });
  }
  for (const slot of slots) {
    const section =
      bySection.get(slot.sectionId) ??
      (() => {
        const created: PrintStaySection = {
          title: slot.sectionId,
          detail: null,
          slots: [],
          notes: [],
        };
        bySection.set(slot.sectionId, created);
        return created;
      })();
    section.slots.push({
      label: slot.label,
      occupant: slot.occupant.trim() || "—",
    });
  }
  for (const note of notes) {
    const section = bySection.get(note.sectionId);
    if (section && note.note.trim()) section.notes.push(note.note.trim());
  }
  return [...bySection.values()].filter((section) => section.slots.length > 0);
}

export function mealSectionsFromGuests(
  guests: Array<{
    name: string;
    sectionId: string;
    choices: Record<string, string>;
  }>,
  courses: Array<{ id: string; label: string; options: Array<{ id: string; label: string }> }>,
): PrintMealSection[] {
  const optionLabel = (courseId: string, optionId: string | undefined) => {
    if (!optionId) return null;
    const course = courses.find((row) => row.id === courseId);
    return course?.options.find((option) => option.id === optionId)?.label ?? null;
  };
  const bySection = new Map<string, PrintMealSection>();
  for (const def of MEAL_SECTIONS) {
    bySection.set(def.id, { title: def.title, guests: [] });
  }
  for (const guest of guests) {
    const section =
      bySection.get(guest.sectionId) ??
      (() => {
        const created: PrintMealSection = { title: guest.sectionId, guests: [] };
        bySection.set(guest.sectionId, created);
        return created;
      })();
    const selections = Object.entries(guest.choices)
      .map(([courseId, optionId]) => optionLabel(courseId, optionId))
      .filter((label): label is string => Boolean(label));
    section.guests.push({
      name: guest.name,
      selection: selections.length ? selections.join(" · ") : null,
    });
  }
  return [...bySection.values()].filter((section) => section.guests.length > 0);
}

export function householdsFromGuests(
  guests: Array<{
    street: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    rsvpStatus: string;
    people: Array<{ name: string }>;
    nameLine1?: string;
    nameLine2?: string | null;
  }>,
): PrintHousehold[] {
  return guests.map((guest) => ({
    names:
      guest.people.length > 0
        ? guest.people.map((person) => person.name).filter(Boolean)
        : [guest.nameLine1, guest.nameLine2].filter((name): name is string => Boolean(name?.trim())),
    addressLines: guestAddressLines(guest),
    rsvp: guest.rsvpStatus,
  }));
}

export function sectionHasContent(doc: PrintCenterDocument, id: PrintSectionId): boolean {
  switch (id) {
    case "overview":
      return Boolean(doc.coupleNames || doc.weddingDateLabel);
    case "rehearsal":
      return doc.rehearsal.length > 0;
    case "timeline":
      return doc.timeline.length > 0;
    case "mc":
      return doc.mcCues.length > 0 || doc.mcNames.length > 0;
    case "hair":
      return doc.hairMakeup.length > 0;
    case "shots":
      return doc.shots.length > 0;
    case "contacts":
      return doc.vendorContacts.length + doc.dayOfContacts.length + doc.otherContacts.length > 0;
    case "assignments":
      return doc.assignments.length > 0;
    case "setup":
      return (
        doc.setupContacts.length +
          doc.setupMoments.length +
          doc.setupDecor.length +
          doc.coordinatorScope.length >
        0
      );
    case "guests":
      return doc.households.length > 0;
    case "stay":
      return doc.stay.length > 0;
    case "meals":
      return doc.meals.length > 0;
    case "shopping":
      return doc.shopping.length > 0;
    case "tasks":
      return doc.tasks.length > 0;
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
    weddingDateLabel: "October 16, 2026",
    timezone: "America/Detroit",
    mcNames: [],
    rehearsal: [],
    timeline: [],
    mcCues: [],
    vendorContacts: [],
    dayOfContacts: [],
    otherContacts: [],
    assignments: [],
    setupContacts: [],
    setupMoments: [],
    setupDecor: [],
    coordinatorScope: [],
    hairMakeup: [],
    shots: [],
    households: [],
    stay: [],
    mealsPublished: false,
    mealChoiceCount: 0,
    meals: [],
    shopping: [],
    tasks: [],
    calendar: [],
    money: { committed: 0, paid: 0, remaining: 0, items: [] },
    availableSections: [...PRINT_SECTION_IDS],
  };
}
