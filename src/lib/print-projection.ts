import { parseBlockNotes } from "@/lib/day-of-now";
import { parseDayOfTime } from "@/lib/day-of-time";
import { parseRsvpStatus } from "@/lib/guest-gifts";
import { MEAL_SECTIONS } from "@/lib/meals";
import { ceremonyLineUpTime, scheduleLines } from "@/lib/schedule-consistency";
import { STAY_SECTIONS } from "@/lib/stay";
import { taskStatusIsDone } from "@/lib/task-actionable";

export type PrintHairRoom = {
  title: string;
  detail: string;
};

export type PrintHairRow = {
  timeLabel: string;
  showTime: boolean;
  person: string;
  service: string | null;
  location: string | null;
  notes: string[];
};

export type PrintShotItem = {
  title: string;
  notes: string[];
  completed: boolean;
  inferredPairing: boolean;
};

export type PrintShotGroup = {
  section: string;
  confirmationNote: string | null;
  items: PrintShotItem[];
};

export type PrintHouseholdMember = {
  name: string;
  rsvpLabel: string;
};

export type PrintHouseholdCard = {
  title: string;
  members: PrintHouseholdMember[];
};

export type PrintRsvpSummary = {
  attending: number;
  declined: number;
  awaiting: number;
};

export type PrintStaySlotView = {
  label: string;
  occupant: string;
};

export type PrintStaySectionView = {
  title: string;
  detail: string | null;
  slots: PrintStaySlotView[];
  notes: string[];
};

export type PrintMealSectionView = {
  title: string;
  guests: Array<{ name: string; selection: string | null }>;
};

export type PrintTaskItemView = {
  title: string;
  done: boolean;
  dueLabel: string | null;
  assignees: string[];
};

export type PrintTaskGroupView = {
  title: string;
  items: PrintTaskItemView[];
};

export type PrintSetupConfirmed = {
  owner: string;
  work: string;
};

export type PrintQuickReference = {
  coupleNames: string;
  weddingDateLabel: string;
  ceremonyTime: string | null;
  venueName: string | null;
  venueAddress: string[];
  airbnbName: string | null;
  airbnbAddress: string[];
  rehearsalDinnerName: string | null;
  rehearsalDinnerAddress: string[];
  coordinatorName: string | null;
  coordinatorPhone: string | null;
  mistressOfCeremonies: string | null;
  mcName: string | null;
  receptionEnds: string | null;
  venueCloses: string | null;
  rsvp: PrintRsvpSummary | null;
};

const MUSIC_LINE =
  /^(Playlist|Music|Grand Entrance Song|After Dollar Dance)\s*:\s*(.+)$/i;
const CUE_LINE = /^(MC cue(?:\s+at)?|Dinner cue)\b(.*)$/i;
const TIME_TOKEN = "(\\d{1,2}:\\d{2}\\s*(?:AM|PM)?)";
const STAY_PRINT_TITLES: Record<string, string> = {
  bride: "Bedroom 1 — Bride Side",
  couple: "Bedroom 2 — Couple",
  groom: "Bedroom 3 — Groom Side",
};

const MEAL_PRINT_TITLES: Record<string, string> = {
  ceremony: "MC Team",
};

const SHOT_SECTION_LABELS: Record<string, string> = {
  Details: "Details",
  Portraits: "Portraits",
  "Bridal party": "Bridal party",
  Family: "Family",
};

export function professionalizePrintLine(raw: string): string | null {
  let line = raw.replace(/\s+/g, " ").trim();
  if (!line) return null;

  if (/money fact/i.test(line) && /not a new task/i.test(line)) {
    line = line
      .replace(/\.?\s*week-of remaining balance is a money fact, not a new task\.?/i, "")
      .replace(/money fact, not a new task\.?/i, "")
      .trim();
    if (!line) return null;
  }

  if (/katie/i.test(line) && /haley'?s hair/i.test(line) && /(not diy|confirmed)/i.test(line)) {
    return "Katie — Haley's hairstylist";
  }
  if (/katie is confirmed for haley'?s hair/i.test(line) || /do not treat this as diy/i.test(line)) {
    return /katie/i.test(line) ? "Katie — Haley's hairstylist" : null;
  }

  if (
    /before ceremony vs/i.test(line) ||
    (/marriage[- ]license/i.test(line) && /(still tbd|\bTBD\b)/i.test(line))
  ) {
    if (/avalon|contracted to assist/i.test(line)) {
      return "Avalon assists with the marriage-license signing. Time TBD.";
    }
    return "Marriage-license signing. Time TBD.";
  }

  if (
    /avalon/i.test(line) &&
    /(does not (personally )?own|not avalon personally owning|not own removal)/i.test(line)
  ) {
    return "Avalon handles décor breakdown. Haley's parents and assigned crew handle removal and transport.";
  }
  if (/avalon breaks down(?: decor)? for the point person/i.test(line) && /does not own/i.test(line)) {
    return "Avalon handles décor breakdown. Haley's parents and assigned crew handle removal and transport.";
  }

  line = line.replace(/\s*\(not the older [^)]*pdf[^)]*\)/gi, "");
  line = line.replace(/\s*\(not the 5:15 if-by-the-bar maybe\)/gi, "");
  line = line.replace(/\s*[—–-]\s*confirmed, not diy\.?/gi, "");
  line = line.replace(/\bconfirmed, not diy\b/gi, "");
  line = line.replace(/\bdo not treat this as diy\.?/gi, "");
  line = line.replace(/\bmoney fact, not a new task\.?/gi, "");
  line = line.replace(/\bnot a new task\.?/gi, "");
  line = line.replace(/\s*\(\s*see hair & makeup page\s*\)/gi, "");
  line = line.replace(/\s*see hair & makeup page\b/gi, "");
  line = line.replace(/\bcake cutting stays at 6:15 with toasts\b/gi, "Cake cutting at 6:15 PM with toasts");
  line = line.replace(/\bdance floor opens at 7:00 pm in the glass house\b/gi, "Dance floor opens at 7:00 PM in the glass house");

  if (
    /\b(not the older|source-conflict|implementation|do not invent|not diy|money fact|reconstruction)\b/i.test(
      line,
    )
  ) {
    return null;
  }

  line = line.replace(/\s{2,}/g, " ").replace(/\s+([.,;:])/g, "$1").trim();
  return line || null;
}

export function professionalizePrintLines(lines: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of scheduleLines(lines)) {
    const next = professionalizePrintLine(raw);
    if (!next) continue;
    const key = next.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(next);
  }
  return out;
}

export function normalizePrintTime(
  raw: string,
  fallbackMeridiem: "AM" | "PM" | null = "PM",
): string {
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (!trimmed) return trimmed;
  if (/^immediately after(?: 5:00 pm)? entrance$/i.test(trimmed)) {
    return "Immediately after 5:00 PM entrance";
  }

  const range = trimmed.match(
    new RegExp(`^${TIME_TOKEN}\\s*[–—-]\\s*${TIME_TOKEN}$`, "i"),
  );
  if (range) {
    const left = normalizePrintTime(range[1]!, fallbackMeridiem);
    const rightMeridiem = /am|pm/i.test(range[2]!) ? null : fallbackMeridiem;
    const rightHasMeridiem = /am|pm/i.test(range[2]!);
    const shared = range[2]!.match(/\s*(AM|PM)$/i);
    const rightRaw =
      !rightHasMeridiem && shared ? `${range[2]}` : range[2]!;
    const right = normalizePrintTime(
      rightRaw,
      rightHasMeridiem ? null : (shared?.[1]?.toUpperCase() as "AM" | "PM" | undefined) ?? rightMeridiem,
    );
    return `${left} – ${right}`;
  }

  const parsed = parseDayOfTime(trimmed);
  if (parsed.kind === "timed") return parsed.display;

  if (fallbackMeridiem && /^\d{1,2}:\d{2}$/.test(trimmed)) {
    const withMeridiem = parseDayOfTime(`${trimmed} ${fallbackMeridiem}`);
    if (withMeridiem.kind === "timed") return withMeridiem.display;
  }

  return trimmed;
}

export function formatPrintTimeRange(startAt: string, endAt: string | null): string {
  const start = normalizePrintTime(startAt);
  if (!endAt?.trim()) return start;
  const end = normalizePrintTime(endAt);
  if (start === end) return start;
  return `${start} – ${end}`;
}

export function rsvpPrintLabel(status: string): string {
  const parsed = parseRsvpStatus(status);
  if (parsed === "attending") return "Attending";
  if (parsed === "not_attending") return "Declined";
  return "Awaiting RSVP";
}

export function printGuestDisplayName(name: string): string {
  const trimmed = name.trim();
  const guess = trimmed.match(/^guess of\s+(.+)$/i);
  if (guess) return `Guest of ${guess[1]!.trim()} — name TBD`;
  const plus = trimmed.match(/^(.+?)\s*\+\s*1$/i);
  if (plus) return `Guest of ${plus[1]!.trim()}`;
  if (trimmed === "+1") return "Guest — name TBD";
  return trimmed;
}

export function householdPrintTitle(members: Array<{ name: string }>): string {
  const primary =
    members.find((row) => !/\+\s*1$/i.test(row.name) && !/^guess of\b/i.test(row.name)) ??
    members[0];
  const name = primary ? printGuestDisplayName(primary.name) : "Household";
  if (members.length <= 1) return name;
  return `${name} Household`;
}

export function summarizePersonRsvp(
  members: Array<{ rsvpStatus: string }>,
): PrintRsvpSummary {
  const summary: PrintRsvpSummary = { attending: 0, declined: 0, awaiting: 0 };
  for (const member of members) {
    const label = rsvpPrintLabel(member.rsvpStatus);
    if (label === "Attending") summary.attending += 1;
    else if (label === "Declined") summary.declined += 1;
    else summary.awaiting += 1;
  }
  return summary;
}

export function projectHouseholds(
  guests: Array<{
    rsvpStatus: string;
    people: Array<{ name: string; rsvpStatus?: string }>;
    nameLine1?: string;
    nameLine2?: string | null;
  }>,
): { households: PrintHouseholdCard[]; summary: PrintRsvpSummary } {
  const households: PrintHouseholdCard[] = guests.map((guest) => {
    if (guest.people.length > 0) {
      const members = guest.people
        .map((person) => ({
          name: printGuestDisplayName(person.name),
          rsvpLabel: rsvpPrintLabel(person.rsvpStatus ?? "pending"),
        }))
        .filter((row) => row.name);
      return {
        title: householdPrintTitle(guest.people),
        members: members.length
          ? members
          : [{ name: "Household", rsvpLabel: rsvpPrintLabel(guest.rsvpStatus) }],
      };
    }
    const fallbackNames = [guest.nameLine1, guest.nameLine2]
      .filter((name): name is string => Boolean(name?.trim()))
      .map((name) => ({ name }));
    return {
      title: householdPrintTitle(fallbackNames.length ? fallbackNames : [{ name: "Household" }]),
      members: [{ name: "Household", rsvpLabel: rsvpPrintLabel(guest.rsvpStatus) }],
    };
  });
  const summary = summarizePersonRsvp(
    households.flatMap((house) =>
      house.members.map((member) => ({
        rsvpStatus:
          member.rsvpLabel === "Attending"
            ? "attending"
            : member.rsvpLabel === "Declined"
              ? "not_attending"
              : "pending",
      })),
    ),
  );
  return { households, summary };
}

export function projectStaySections(
  slots: Array<{ sectionId: string; label: string; occupant: string; optional?: boolean }>,
  notes: Array<{ sectionId: string; note: string }>,
): PrintStaySectionView[] {
  const bySection = new Map<string, PrintStaySectionView>();
  for (const def of STAY_SECTIONS) {
    bySection.set(def.id, {
      title: STAY_PRINT_TITLES[def.id] ?? def.title,
      detail: def.detail,
      slots: [],
      notes: [],
    });
  }
  for (const slot of slots) {
    const section =
      bySection.get(slot.sectionId) ??
      (() => {
        const created: PrintStaySectionView = {
          title: STAY_PRINT_TITLES[slot.sectionId] ?? slot.sectionId,
          detail: null,
          slots: [],
          notes: [],
        };
        bySection.set(slot.sectionId, created);
        return created;
      })();
    const occupant = slot.occupant.trim();
    section.slots.push({
      label: slot.label,
      occupant: occupant
        ? occupant
        : slot.optional
          ? "Optional / available"
          : "Unassigned",
    });
  }
  for (const note of notes) {
    const section = bySection.get(note.sectionId);
    const cleaned = professionalizePrintLine(note.note);
    if (section && cleaned) section.notes.push(cleaned);
  }
  return [...bySection.values()].filter((section) => section.slots.length > 0);
}

export function mealPrintTitle(sectionId: string, fallback: string): string {
  return MEAL_PRINT_TITLES[sectionId] ?? fallback;
}

export function projectMealSections(
  guests: Array<{
    name: string;
    sectionId: string;
    choices: Record<string, string>;
  }>,
  courses: Array<{ id: string; label: string; options: Array<{ id: string; label: string }> }>,
): PrintMealSectionView[] {
  const optionLabel = (courseId: string, optionId: string | undefined) => {
    if (!optionId) return null;
    const course = courses.find((row) => row.id === courseId);
    return course?.options.find((option) => option.id === optionId)?.label ?? null;
  };
  const bySection = new Map<string, PrintMealSectionView>();
  for (const def of MEAL_SECTIONS) {
    bySection.set(def.id, { title: mealPrintTitle(def.id, def.title), guests: [] });
  }
  for (const guest of guests) {
    const section =
      bySection.get(guest.sectionId) ??
      (() => {
        const created: PrintMealSectionView = {
          title: mealPrintTitle(guest.sectionId, guest.sectionId),
          guests: [],
        };
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

export function projectTaskGroups(
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    parentId: string | null;
    parentTitle?: string | null;
    dueLabel: string | null;
    /** Printed day heading for a dated task, e.g. "Monday, October 12". */
    dueDay?: string | null;
    /** Due time in ms, for putting the days in order. */
    dueAt?: number | null;
    assignees: string[];
  }>,
  /** "open" for the Open work pages; "done" for the separate Completed work section. */
  which: "open" | "done" = "open",
): PrintTaskGroupView[] {
  const keep = (status: string) => taskStatusIsDone(status) === (which === "done");
  const childrenByParent = new Map<string, typeof tasks>();
  const parents = new Map<string, (typeof tasks)[number]>();
  const standalone: typeof tasks = [];

  for (const task of tasks) {
    if (task.parentId) {
      // Open work prints only what is still open; finished steps print under Completed work.
      if (!keep(task.status)) continue;
      const list = childrenByParent.get(task.parentId) ?? [];
      list.push(task);
      childrenByParent.set(task.parentId, list);
    } else {
      parents.set(task.id, task);
    }
  }

  const groups: PrintTaskGroupView[] = [];
  const usedParents = new Set<string>();

  for (const [parentId, children] of childrenByParent) {
    const parent = parents.get(parentId);
    const title = parent?.title ?? children[0]?.parentTitle ?? "Open work";
    usedParents.add(parentId);
    groups.push({
      title,
      items: children.map((child) => ({
        title: child.title,
        done: taskStatusIsDone(child.status),
        dueLabel: child.dueLabel,
        assignees: child.assignees,
      })),
    });
  }

  for (const task of tasks) {
    if (task.parentId) continue;
    if (usedParents.has(task.id)) continue;
    if (childrenByParent.has(task.id)) continue;
    if (tasks.some((other) => other.parentId === task.id)) continue;
    if (!keep(task.status)) continue;
    standalone.push(task);
  }

  // A task of its own with a due date prints under its day, days in order; the rest stay together.
  const dated = standalone
    .filter((task) => task.dueDay)
    .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0));
  const undated = standalone.filter((task) => !task.dueDay);
  const byDay = new Map<string, typeof tasks>();
  for (const task of dated) {
    const list = byDay.get(task.dueDay!) ?? [];
    list.push(task);
    byDay.set(task.dueDay!, list);
  }
  for (const [day, dayTasks] of byDay) {
    groups.push({
      title: day,
      items: dayTasks.map((task) => ({
        title: task.title,
        done: taskStatusIsDone(task.status),
        dueLabel: task.dueLabel,
        assignees: task.assignees,
      })),
    });
  }

  if (undated.length) {
    groups.push({
      title: which === "done" ? "Other completed work" : "Other open work",
      items: undated.map((task) => ({
        title: task.title,
        done: taskStatusIsDone(task.status),
        dueLabel: task.dueLabel,
        assignees: task.assignees,
      })),
    });
  }

  return groups.filter((group) => group.items.length > 0);
}

/**
 * David, 2026-10-10: an "Open: …" line on a Wedding Day moment is open work too, so
 * the Open work pages list each one under its day, with the moment it belongs to.
 * Words are quoted from the moment as written.
 */
export function projectTimelineOpenItems(input: {
  rehearsal: Array<{ startAt: string; endAt: string | null; notes: string }>;
  wedding: Array<{ startAt: string; endAt: string | null; notes: string }>;
  rehearsalDay?: string | null;
  weddingDay?: string | null;
}): PrintTaskGroupView[] {
  const group = (title: string, blocks: typeof input.wedding): PrintTaskGroupView => ({
    title,
    items: blocks.flatMap((block) => {
      const parsed = parseBlockNotes(block.notes);
      return parsed.detailLines
        .filter((line) => OPEN_LINE.test(line))
        .map((line) => line.replace(OPEN_LINE, "").trim())
        .filter(Boolean)
        .map((text) => ({
          title: text,
          done: false,
          dueLabel: `${formatPrintTimeRange(block.startAt, block.endAt)} · ${parsed.title}`,
          assignees: [],
        }));
    }),
  });
  return [
    group(`Open on the rehearsal day${input.rehearsalDay ? ` · ${input.rehearsalDay}` : ""}`, input.rehearsal),
    group(`Open on the wedding day${input.weddingDay ? ` · ${input.weddingDay}` : ""}`, input.wedding),
  ].filter((entry) => entry.items.length > 0);
}

/** Same prefix the Wedding Day page shows as "Open:". */
const OPEN_LINE = /^open items?:\s*/i;

export function projectKeyDates(
  events: Array<{ title: string; startDate: Date; endDate: Date; notes: string | null }>,
  timezone: string,
  weddingDate: Date | null,
  _hasRehearsal = true,
): Array<{ title: string; when: string; notes: string | null }> {
  const wedding = weddingDate ?? new Date("2026-10-16T12:00:00");
  const rehearsal = new Date(wedding);
  rehearsal.setDate(wedding.getDate() - 1);

  const key = (value: Date) =>
    value.toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: timezone,
    });

  const allowed = new Set([key(rehearsal), key(wedding)]);
  const long = (value: Date) =>
    value.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: timezone,
    });

  const filtered = events.filter((event) => allowed.has(key(event.startDate)) || allowed.has(key(event.endDate)));
  const rows = filtered.map((event) => {
    const start = long(event.startDate);
    const end = long(event.endDate);
    const weddingish = /wedding/i.test(event.title);
    return {
      title: weddingish ? "Wedding Day" : event.title,
      when: start === end ? start : `${start} – ${end}`,
      notes: event.notes ? professionalizePrintLine(event.notes) : null,
    };
  });

  if (!rows.some((row) => /rehearsal/i.test(row.title))) {
    rows.unshift({
      title: "Rehearsal Dinner + Rehearsal",
      when: long(rehearsal),
      notes: null,
    });
  }
  if (!rows.some((row) => /wedding/i.test(row.title))) {
    rows.push({
      title: "Wedding Day",
      when: long(wedding),
      notes: null,
    });
  }
  return rows;
}

export function isMcCueLine(line: string): boolean {
  return CUE_LINE.test(line);
}

export function isMusicLine(line: string): boolean {
  return MUSIC_LINE.test(line);
}

function compactRoomDetail(item: {
  title: string;
  detail: string | null;
  notes: string | null;
}): string {
  const bits = [item.detail, item.notes].filter((line): line is string => Boolean(line?.trim()));
  const joined = bits.join(" ");
  if (/makeup/i.test(joined) && /up to 2/i.test(joined)) return "Makeup · up to 2";
  if (/haley'?s get-ready/i.test(joined)) return "Haley get-ready room";
  if (/hair/i.test(joined) && /1 station|one station/i.test(joined)) return "Hair · one station";
  if (/overflow/i.test(joined) || /living room/i.test(item.title)) return "Overflow / mirrors / lighting";
  const cleaned = professionalizePrintLines(bits);
  return cleaned.join(" · ");
}

function parseHairTitle(title: string): { person: string; service: string | null } {
  const dashed = title.match(/^(.*?)\s+[—–-]\s+(hair|makeup)$/i);
  if (dashed) return { person: dashed[1]!.trim(), service: dashed[2]![0]!.toUpperCase() + dashed[2]!.slice(1).toLowerCase() };
  if (/starts hair with katie/i.test(title)) return { person: "Haley", service: "Hair" };
  if (/katie and belle arrive/i.test(title)) return { person: "Katie and Belle", service: "Arrival" };
  if (/makeup done|break/i.test(title)) return { person: "Haley", service: "Break" };
  if (/packed and cleaned/i.test(title)) return { person: "Airbnb", service: "Pack / clean" };
  if (/eat, pack cars/i.test(title)) return { person: "Bridal party", service: "Leave window" };
  if (/leaves the airbnb/i.test(title)) return { person: "Bridal party", service: "Depart" };
  if (/arrives at black sheep/i.test(title)) return { person: "Bridal party", service: "Arrive" };
  if (/photographer arrives/i.test(title)) return { person: "Haley, David, and Belle", service: "Depart Airbnb" };
  if (/retouch|get-ready photos/i.test(title)) return { person: "Haley", service: "Retouch" };
  if (/hair & makeup starts/i.test(title)) return { person: "Bridal party", service: "Hair & makeup begins" };
  return { person: title, service: null };
}

export function projectHairMakeup(
  items: Array<{
    section: string;
    startAt: string | null;
    title: string;
    location: string | null;
    notes: string | null;
    detail: string | null;
    sortOrder: number;
  }>,
): { rooms: PrintHairRoom[]; rows: PrintHairRow[] } {
  const ordered = [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  const rooms = ordered
    .filter((item) => !item.startAt && (/rooms/i.test(item.section) || /bedroom|bathroom|living/i.test(item.title)))
    .map((item) => ({
      title: item.title,
      detail: compactRoomDetail(item),
    }));

  const schedule = ordered.filter((item) => item.startAt);
  const rows: PrintHairRow[] = [];
  let lastTime = "";
  for (const item of schedule) {
    const timeLabel = normalizePrintTime(item.startAt!);
    const parsed = parseHairTitle(item.title);
    const notes = professionalizePrintLines([item.detail, item.notes].filter((line): line is string => Boolean(line)));
    const serviceFromDetail = notes.find((line) => /^(hair|makeup)$/i.test(line));
    const filteredNotes = notes.filter((line) => !/^(hair|makeup)$/i.test(line));
    rows.push({
      timeLabel,
      showTime: timeLabel !== lastTime,
      person: parsed.person,
      service: parsed.service ?? serviceFromDetail ?? null,
      location: item.location,
      notes: filteredNotes,
    });
    lastTime = timeLabel;
  }
  return { rooms, rows };
}

function isInferredPairing(title: string, section: string): boolean {
  if (!/^bridal party$/i.test(section)) return false;
  return /^(Bride|Groom) with (?!wedding party\b)[A-Z][a-z]+$/.test(title);
}

export function projectShotGroups(
  items: Array<{
    section: string;
    title: string;
    notes: string | null;
    detail: string | null;
    completed: boolean;
    sortOrder: number;
  }>,
): PrintShotGroup[] {
  const groups: PrintShotGroup[] = [];
  const index = new Map<string, number>();
  for (const item of [...items].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const section = SHOT_SECTION_LABELS[item.section] ?? item.section;
    const inferred = isInferredPairing(item.title, item.section);
    const entry: PrintShotItem = {
      title: item.title,
      notes: professionalizePrintLines([item.detail, item.notes].filter((line): line is string => Boolean(line))),
      completed: item.completed,
      inferredPairing: inferred,
    };
    const existing = index.get(section);
    if (existing == null) {
      index.set(section, groups.length);
      groups.push({
        section,
        confirmationNote: inferred
          ? "Individual pairings follow the ceremony processional. Confirm with David & Haley before the photographer uses this list."
          : null,
        items: [entry],
      });
    } else {
      const group = groups[existing]!;
      group.items.push(entry);
      if (inferred && !group.confirmationNote) {
        group.confirmationNote =
          "Individual pairings follow the ceremony processional. Confirm with David & Haley before the photographer uses this list.";
      }
    }
  }
  return groups;
}

export function professionalizeAssignmentNotes(notes: string | null): string | null {
  if (!notes?.trim()) return null;
  const lines = professionalizePrintLines(notes.split("\n"));
  return lines
    .map((line) => {
      const uncertain = line.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*\??$/i);
      if (uncertain || /\b\d{1,2}\s*am\s*\?/i.test(line)) {
        const clock = line.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
        if (clock) {
          const time = normalizePrintTime(`${clock[1]}:${clock[2] ?? "00"} ${clock[3]}`, null);
          return `Target: approximately ${time} · Time to confirm`;
        }
      }
      return line.replace(/\b10 am\?/i, "Target: approximately 10:00 AM · Time to confirm");
    })
    .join("\n") || null;
}

export function projectSetupPlan(input: {
  contacts: Array<{ name: string; directoryLabel?: string | null; phone: string | null; email: string | null }>;
  decor: Array<{ title: string; detail: string | null; notes: string | null; section: string }>;
  tasks: Array<{ title: string; status: string; parentTitle?: string | null; assignees: string[] }>;
}): {
  contacts: Array<{ name: string; role: string | null; phone: string | null; email: string | null }>;
  confirmed: PrintSetupConfirmed[];
  open: string[];
} {
  const contacts = input.contacts.map((contact) => ({
    name: contact.name,
    role: printContactRole(contact.name, contact.directoryLabel),
    phone: contact.phone?.trim() || null,
    email: contact.email?.trim() || null,
  }));

  const confirmed: PrintSetupConfirmed[] = [];
  for (const row of input.decor) {
    if (!/cleanup|clean/i.test(row.section) && !/trash|take home|breakdown|sweep|tables, chairs/i.test(row.title)) {
      continue;
    }
    if (/trash/i.test(row.title)) {
      confirmed.push({ owner: "Haley's parents", work: "Trash" });
      continue;
    }
    if (/goes home|take-home|take home/i.test(row.title) || /decor leaves with/i.test(row.notes ?? "")) {
      confirmed.push({
        owner: "Haley's parents / people staying with them",
        work: "Décor transport",
      });
      continue;
    }
    if (/tables, chairs, pews, sweep/i.test(row.title)) {
      const note = professionalizePrintLine(row.notes ?? row.title);
      confirmed.push({
        owner: "Assigned crew",
        work: note ?? "Tables, chairs, pews, and sweep",
      });
    }
  }
  if (!confirmed.some((row) => /breakdown/i.test(row.work))) {
    confirmed.push({
      owner: "Avalon",
      work: "Décor breakdown for the point person",
    });
  }

  const open: string[] = [];
  const teardownTasks = input.tasks.filter(
    (task) =>
      !taskStatusIsDone(task.status) &&
      /tear\s*down|teardown|cleanup plan/i.test(`${task.title} ${task.parentTitle ?? ""}`),
  );
  if (teardownTasks.some((task) => /coordinator/i.test(task.title) && task.assignees.length === 0)) {
    open.push("Overall teardown coordinator — not assigned");
  }
  if (teardownTasks.some((task) => /assign teardown|teardown responsibilities/i.test(task.title))) {
    open.push("Remaining individual teardown responsibilities — not finalized");
  }

  return { contacts, confirmed, open };
}

export function projectCoordinatorRows(
  items: Array<{ title: string; detail: string | null; notes: string | null; location: string | null; startAt: string | null; section: string }>,
): Array<{ title: string; notes: string[]; location: string | null; timeLabel: string | null; section: string }> {
  return items.map((item) => ({
    title: item.title.replace(/^package:\s*/i, ""),
    timeLabel: item.startAt,
    location: item.location,
    section: item.section,
    notes: professionalizePrintLines(
      [item.detail, item.notes].filter((line): line is string => Boolean(line)),
    ).filter((line) => !/^\$[\d,.]+ total\b/i.test(line)),
  }));
}

export function projectDecorGroups(
  items: Array<{ section: string; title: string; detail: string | null; notes: string | null; location: string | null; sortOrder: number }>,
): Array<{ section: string; items: Array<{ title: string; notes: string[]; location: string | null }> }> {
  const groups: Array<{ section: string; items: Array<{ title: string; notes: string[]; location: string | null }> }> = [];
  const index = new Map<string, number>();
  for (const item of [...items].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (/^theme$/i.test(item.section)) continue;
    const notes = professionalizePrintLines(
      [item.detail, item.notes].filter((line): line is string => Boolean(line)),
    );
    const entry = { title: item.title, notes, location: item.location };
    const existing = index.get(item.section);
    if (existing == null) {
      index.set(item.section, groups.length);
      groups.push({ section: item.section, items: [entry] });
    } else {
      groups[existing]!.items.push(entry);
    }
  }
  return groups;
}

function firstMatchingLine(
  blocks: Array<{ notes: string }>,
  pattern: RegExp,
): string | null {
  for (const block of blocks) {
    for (const line of block.notes.split("\n")) {
      if (pattern.test(line)) return line.trim();
    }
  }
  return null;
}

function addressesFromLine(line: string): string[] {
  const cleaned = line.replace(/^(airbnb|venue|hawkshead)\s*[:—–-]\s*/i, "").trim();
  const parts = cleaned.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return parts.length === 3 ? [parts[0]!, `${parts[1]}, ${parts[2]}`] : [cleaned];
  }
  return cleaned ? [cleaned] : [];
}

export function buildQuickReference(input: {
  coupleNames: string;
  weddingDateLabel: string;
  weddingBlocks: Array<{ startAt: string; endAt: string | null; notes: string }>;
  rehearsalBlocks: Array<{ startAt: string; endAt: string | null; notes: string }>;
  contacts: Array<{ name: string; directoryLabel?: string | null; phone: string | null }>;
  mistressOfCeremonies: string | null;
  mcName: string | null;
  coordinatorPhoneHint: string | null;
  rsvp: PrintRsvpSummary | null;
  canonicalPlaces?: {
    venueName?: string | null;
    venueAddress?: string[];
    rehearsalDinnerName?: string | null;
    rehearsalDinnerAddress?: string[];
    airbnbName?: string | null;
    airbnbAddress?: string[];
  } | null;
}): PrintQuickReference {
  const all = [...input.rehearsalBlocks, ...input.weddingBlocks];
  const ceremony = input.weddingBlocks.find((block) => /^ceremony$/i.test(parseBlockNotes(block.notes).title));
  // The reconciled day has two open-dancing sets; the reception ends at its own moment or after the last set.
  const receptionEnd = input.weddingBlocks.find((block) => /^reception ends$/i.test(parseBlockNotes(block.notes).title));
  const dancing = input.weddingBlocks.findLast((block) => /open dancing/i.test(parseBlockNotes(block.notes).title));
  const teardown = input.weddingBlocks.find((block) => /tear down|clean up/i.test(parseBlockNotes(block.notes).title));
  const avalon = input.contacts.find((contact) => /avalon/i.test(contact.name));
  const venueLine = firstMatchingLine(all, /342\s+62nd|black sheep shelter/i);
  const airbnbLine = firstMatchingLine(all, /10268\s+51st|airbnb:/i);
  const hawksLine = firstMatchingLine(all, /hawkshead|523 hawks/i);
  const closeLine = firstMatchingLine(input.weddingBlocks, /venue closes/i);

  let coordinatorPhone = avalon?.phone?.trim() || input.coordinatorPhoneHint;
  if (coordinatorPhone) coordinatorPhone = coordinatorPhone.replace(/\./g, "-");

  const canonical = input.canonicalPlaces;
  const legacyVenueAddress =
    venueLine && /342/.test(venueLine)
      ? addressesFromLine(venueLine.replace(/^.*?(342)/, "342"))
      : ["342 62nd St", "South Haven, MI 49090"];
  const legacyAirbnbAddress =
    airbnbLine && /10268/.test(airbnbLine)
      ? addressesFromLine(airbnbLine)
      : ["10268 51st St", "Grand Junction, MI 49056"];
  const legacyRehearsalAddress =
    hawksLine && /523/.test(hawksLine)
      ? addressesFromLine(hawksLine.replace(/^.*?(523)/, "523"))
      : ["523 Hawks Nest Dr", "South Haven, MI"];

  return {
    coupleNames: input.coupleNames,
    weddingDateLabel: input.weddingDateLabel,
    ceremonyTime: ceremony ? normalizePrintTime(ceremony.startAt) : "3:30 PM",
    venueName: canonical?.venueName?.trim() || "Black Sheep Shelter",
    venueAddress:
      canonical?.venueAddress?.length ? canonical.venueAddress : legacyVenueAddress,
    airbnbName: canonical?.airbnbName?.trim() || "Airbnb",
    airbnbAddress:
      canonical?.airbnbAddress?.length ? canonical.airbnbAddress : legacyAirbnbAddress,
    rehearsalDinnerName: canonical?.rehearsalDinnerName?.trim() || "Hawkshead",
    rehearsalDinnerAddress:
      canonical?.rehearsalDinnerAddress?.length
        ? canonical.rehearsalDinnerAddress
        : legacyRehearsalAddress,
    coordinatorName: avalon ? avalon.name.split("·")[0]!.trim() : "Avalon Green",
    coordinatorPhone,
    mistressOfCeremonies: input.mistressOfCeremonies?.trim() || "Wendy Rush",
    mcName: input.mcName?.trim() || "Kurt Huizenga",
    receptionEnds: receptionEnd
      ? normalizePrintTime(receptionEnd.startAt)
      : dancing?.endAt
        ? normalizePrintTime(dancing.endAt)
        : "10:00 PM",
    venueCloses: closeLine
      ? normalizePrintTime(closeLine.match(new RegExp(TIME_TOKEN, "i"))?.[1] ?? "11:00 PM")
      : teardown?.endAt
        ? normalizePrintTime(teardown.endAt)
        : "11:00 PM",
    rsvp: input.rsvp,
  };
}

export function printContactRole(name: string, directoryLabel?: string | null): string | null {
  const label = directoryLabel?.trim() || "";
  if (/mistress of ceremon/i.test(label)) return "Mistress of Ceremonies";
  if (label && (/(^|\b)mc(\b|$)/i.test(label) || /master of ceremon/i.test(label))) return "MC";
  if (label) return label;
  if (/^kurt huizenga$/i.test(name)) return "MC";
  if (/^wendy rush$/i.test(name)) return "Mistress of Ceremonies";
  return null;
}

export function mcRoleSplit(
  people: Array<{ name: string; directoryLabel?: string | null }>,
): { mistressOfCeremonies: string | null; mcName: string | null } {
  let mistressOfCeremonies: string | null = null;
  let mcName: string | null = null;
  for (const person of people) {
    const role = printContactRole(person.name, person.directoryLabel);
    if (/mistress of ceremon/i.test(role ?? "") || /^wendy rush$/i.test(person.name)) {
      mistressOfCeremonies = person.name;
    } else if (role === "MC" || /^kurt huizenga$/i.test(person.name)) {
      mcName = person.name;
    }
  }
  return { mistressOfCeremonies, mcName };
}

export function coordinatorPhoneFromPlaybook(notes: Array<string | null>): string | null {
  for (const note of notes) {
    const match = note?.match(/(\d{3}[-.]?\d{3}[-.]?\d{4})/);
    if (match) return match[1]!.replace(/\./g, "-");
  }
  return null;
}

export function isProcessionalMusic(value: string): boolean {
  return /aisle|processional|walking down/i.test(value);
}

export function isWaitingMusic(value: string): boolean {
  return /wait/i.test(value);
}

export function isDinnerBedMusic(kind: string, value: string): boolean {
  return /minstrel/i.test(value) || (/playlist/i.test(kind) && /^dinner\b/i.test(value));
}

export function musicAttachTarget(kind: string, value: string): string | null {
  if (/grand entrance/i.test(kind) || /grand entrance/i.test(value)) return "entrance";
  if (/dollar dance/i.test(kind) || /dollar dance/i.test(value)) return "dollar";
  if (/last dance/i.test(kind) || /last dance/i.test(value)) return "last";
  if (/first dance|father.?daughter/i.test(value) || /^music$/i.test(kind) && /first dance/i.test(value)) {
    return "first-dance";
  }
  if (/kids section/i.test(value)) return "kids";
  if (/adults section/i.test(value)) return "adults";
  if (isProcessionalMusic(value)) return "processional";
  if (isWaitingMusic(value)) return "waiting";
  if (isDinnerBedMusic(kind, value)) return "dinner-bed";
  return null;
}

/* ---------------------------------------------------------------------------
 * Wedding party packet
 * ------------------------------------------------------------------------- */

export type PrintPartyMember = {
  name: string;
  role: string;
  walksWith: string | null;
  phone: string | null;
};

export type PrintPartyStep = {
  order: number;
  title: string;
};

export type PrintPartyMoment = {
  timeLabel: string;
  title: string;
  notes: string[];
};

export type PrintWeddingPartyView = {
  theme: string | null;
  colors: string[];
  members: PrintPartyMember[];
  processional: PrintPartyStep[];
  lineUpTime: string | null;
  moments: PrintPartyMoment[];
  openItems: string[];
};

/** Lineup rows that are family or the couple, not wedding party members. */
const LINEUP_NOT_PARTY =
  /mother|father|officiant|\bmom\b|\bdad\b|\bwith dad\b|^david$|^haley\b/i;

/** Wedding-day moments where the wedding party has a job or a call time. */
const PARTY_MOMENT =
  /wedding party|bridal party|groomsmen|bridesmaid|lines? up|first look|portraits|toasts|first dances|grand entrance|tear down|clean up|leaves? (the )?airbnb|getting dressed/i;

/**
 * Open questions the planning sources still leave unanswered for the wedding
 * party. They print on purpose so nobody assumes an answer that was never given.
 */
export const WEDDING_PARTY_OPEN_ITEMS: string[] = [
  "Which side each person stands on at the front — not decided.",
  "Attire: who wears which color, where outfits come from, and the order-by date.",
  "Whether Harmony walks in the processional and joins the get-ready robe photos.",
  "Reception entrance order and wedding party seating at dinner.",
  "Who gives a toast, in what order, and how long each one runs.",
  "Parking and carpool plan for Friday.",
];

export function lineupRole(title: string): { names: string[]; role: string | null } {
  const dashRole = title.match(/^(.+?)\s*[—–-]\s*(.+)$/);
  if (dashRole) {
    return { names: [dashRole[1]!.trim()], role: dashRole[2]!.trim() };
  }
  return {
    names: title
      .split(/\s*(?:&|\band\b)\s*/i)
      .map((name) => name.trim())
      .filter(Boolean),
    role: null,
  };
}

function titleCaseRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function projectWeddingParty(input: {
  lineup: Array<{ title: string; startAt: string | null; sortOrder: number }>;
  decor: Array<{ title: string; notes: string | null }>;
  weddingBlocks: Array<{ startAt: string; endAt: string | null; notes: string }>;
  contacts: Array<{ name: string; phone: string | null }>;
}): PrintWeddingPartyView {
  const ordered = [...input.lineup].sort((a, b) => a.sortOrder - b.sortOrder);
  const processional = ordered.map((row, index) => ({ order: index + 1, title: row.title }));
  // The schedule decides the line-up time; the lineup rows' own time is the fallback.
  const lineUpTime = ceremonyLineUpTime(input.weddingBlocks) ?? ordered.find((row) => row.startAt)?.startAt ?? null;

  // Lineup rows carry first names only. A phone is printed only when exactly
  // one person (by full name, with or without a phone) shares that first name;
  // two Evans print TBD rather than a guess.
  const phoneFor = (name: string): string | null => {
    const first = name.toLowerCase();
    const people = new Map<string, string | null>();
    for (const row of input.contacts) {
      // "Avalon Green · Planner" and "Avalon Green" are the same person.
      const full = row.name.split("·")[0]!.trim().toLowerCase();
      if ((full.split(/\s+/)[0] ?? "") !== first) continue;
      people.set(full, people.get(full) || row.phone?.trim() || null);
    }
    return people.size === 1 ? [...people.values()][0]! : null;
  };

  const members: PrintPartyMember[] = [];
  for (const row of ordered) {
    if (LINEUP_NOT_PARTY.test(row.title)) continue;
    const parsed = lineupRole(row.title);
    for (const name of parsed.names) {
      const partner = parsed.names.find((other) => other !== name) ?? null;
      members.push({
        name,
        role: parsed.role ? titleCaseRole(parsed.role) : "Wedding party",
        walksWith: partner,
        phone: phoneFor(name),
      });
    }
  }

  const themeRow = input.decor.find((row) => /bridal party colors|wedding party colors/i.test(row.notes ?? ""));
  const colorMatch = themeRow?.notes?.match(/colors?\s*:\s*([^.\n]+)/i);
  const colors = colorMatch
    ? colorMatch[1]!
        .split(/\s*,\s*/)
        .map((color) => color.trim())
        .filter(Boolean)
    : [];

  const moments: PrintPartyMoment[] = [];
  for (const block of input.weddingBlocks) {
    const parsed = parseBlockNotes(block.notes);
    const relevant = parsed.detailLines.filter((line) => PARTY_MOMENT.test(line));
    if (!PARTY_MOMENT.test(parsed.title) && relevant.length === 0) continue;
    moments.push({
      timeLabel: formatPrintTimeRange(block.startAt, block.endAt),
      title: parsed.title,
      notes: professionalizePrintLines(relevant.length ? relevant : parsed.detailLines).slice(0, 4),
    });
  }

  return {
    theme: themeRow?.title ?? null,
    colors,
    members,
    processional,
    lineUpTime: lineUpTime ? normalizePrintTime(lineUpTime) : null,
    moments,
    openItems: [...WEDDING_PARTY_OPEN_ITEMS],
  };
}
