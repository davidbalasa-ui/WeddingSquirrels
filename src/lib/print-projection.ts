import { parseBlockNotes } from "@/lib/day-of-now";
import { compareParsedTimes, parseDayOfTime, parseTimelineSchedule } from "@/lib/day-of-time";
import { parseRsvpStatus } from "@/lib/guest-gifts";
import { MEAL_SECTIONS } from "@/lib/meals";
import { STAY_SECTIONS } from "@/lib/stay";
import { taskStatusIsDone } from "@/lib/task-actionable";

export type PrintRunSheetEvent = {
  timeLabel: string;
  title: string;
  notes: string[];
  kind: "event" | "mc-pointer" | "tbd";
};

export type PrintRunSheetPhase = {
  title: string;
  location: string | null;
  notes: string[];
  events: PrintRunSheetEvent[];
};

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
const TIME_PREFIX = new RegExp(
  `^${TIME_TOKEN}(?:\\s*[–—-]\\s*${TIME_TOKEN})?\\s*[—–:\\-]\\s+(.+)$`,
  "i",
);
const RANGE_OR = new RegExp(`${TIME_TOKEN}\\s+or\\s+${TIME_TOKEN}`, "i");

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
  for (const raw of lines) {
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
    const people =
      guest.people.length > 0
        ? guest.people
        : [guest.nameLine1, guest.nameLine2]
            .filter((name): name is string => Boolean(name?.trim()))
            .map((name) => ({ name, rsvpStatus: guest.rsvpStatus }));
    const members = people
      .map((person) => ({
        name: printGuestDisplayName(person.name),
        rsvpLabel: rsvpPrintLabel(person.rsvpStatus ?? guest.rsvpStatus),
      }))
      .filter((row) => row.name);
    return {
      title: householdPrintTitle(people),
      members: members.length ? members : [{ name: "Household", rsvpLabel: rsvpPrintLabel(guest.rsvpStatus) }],
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
    assignees: string[];
  }>,
): PrintTaskGroupView[] {
  const childrenByParent = new Map<string, typeof tasks>();
  const parents = new Map<string, (typeof tasks)[number]>();
  const standalone: typeof tasks = [];

  for (const task of tasks) {
    if (task.parentId) {
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
    standalone.push(task);
  }

  if (standalone.length) {
    groups.push({
      title: "Other open work",
      items: standalone.map((task) => ({
        title: task.title,
        done: taskStatusIsDone(task.status),
        dueLabel: task.dueLabel,
        assignees: task.assignees,
      })),
    });
  }

  return groups.filter((group) => group.items.length > 0);
}

export function projectKeyDates(
  events: Array<{ title: string; startDate: Date; endDate: Date; notes: string | null }>,
  timezone: string,
  weddingDate: Date | null,
  hasRehearsal: boolean,
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

  if (hasRehearsal && !rows.some((row) => /rehearsal/i.test(row.title))) {
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

function isMcCueLine(line: string): boolean {
  return CUE_LINE.test(line);
}

function isMusicLine(line: string): boolean {
  return MUSIC_LINE.test(line);
}

function mcPointerTitle(line: string, momentTitle: string): string {
  if (/dinner cue/i.test(line)) return "MC dinner cue";
  if (/welcome|silence your phones|find your seats/i.test(line) && /pre-ceremony|transition/i.test(momentTitle)) {
    return "MC welcome announcement";
  }
  if (/ceremony has concluded|celebration begin/i.test(line)) return "MC ceremony conclusion";
  if (/cocktail hour is nearing|making your way to the dinner/i.test(line)) return "MC seating announcement";
  if (/wedding party|newlyweds/i.test(line)) return "MC grand entrance";
  if (/feast begin/i.test(line)) return "MC dinner cue";
  if (/return to your seats/i.test(line)) return "MC toast setup";
  if (/cake table/i.test(line)) return "MC cake cutting";
  if (/center of the space|first dance/i.test(line)) return "MC first dances";
  if (/dance floor is officially open/i.test(line)) return "MC open dancing";
  if (/younger travelers|younger guests/i.test(line)) return "MC younger-guest reminder";
  if (/dollar dance/i.test(line)) return "MC dollar dance";
  if (/last call|final dance/i.test(line)) return "MC last call";
  if (/reached its end|reception conclusion/i.test(line)) return "MC closing";
  const heading = line.match(/—\s*([^:]+):/);
  if (heading) return `MC ${heading[1]!.trim()}`;
  return "MC cue";
}

function extractCueTime(line: string): string | null {
  const immediate = line.match(/immediately after(?: 5:00 pm)? entrance/i);
  if (immediate) return "Immediately after 5:00 PM entrance";
  const clock = line.match(new RegExp(TIME_TOKEN, "i"));
  if (clock) return normalizePrintTime(clock[1]!);
  return null;
}

function timedEventFromLine(line: string): PrintRunSheetEvent | null {
  const cleaned = professionalizePrintLine(line);
  if (!cleaned) return null;

  if (/\btime(?:\s+is)?\s+(?:still\s+)?tbd\b/i.test(cleaned) || /\bstill tbd\b/i.test(cleaned) || /\bTBD\b/.test(cleaned)) {
    let title = cleaned
      .replace(/\s*\([^)]*\)/g, "")
      .replace(/\btime(?:\s+is)?\s+(?:still\s+)?tbd\b/gi, "")
      .replace(/\bstill tbd\b/gi, "")
      .replace(/\bTBD\b/g, "")
      .replace(/^[:\s—–-]+|[:\s—–-]+$/g, "")
      .trim();
    title = title.replace(/\s{2,}/g, " ");
    if (/harmony and melody/i.test(cleaned) && /robe/i.test(cleaned)) {
      title = "Harmony and Melody get-ready robes";
    }
    if (/marriage license/i.test(cleaned)) title = "Marriage-license signing";
    if (/caterer arrival/i.test(cleaned)) title = "Caterer arrival";
    return {
      timeLabel: "Time TBD",
      title: title || cleaned,
      notes: [],
      kind: "tbd",
    };
  }

  const rangeOr = cleaned.match(RANGE_OR);
  const prefixed = cleaned.match(TIME_PREFIX);
  if (prefixed) {
    const start = normalizePrintTime(prefixed[1]!);
    const end = prefixed[2] ? normalizePrintTime(prefixed[2]!) : null;
    return {
      timeLabel: end ? `${start} – ${end}` : start,
      title: prefixed[3]!.trim(),
      notes: [],
      kind: "event",
    };
  }
  if (rangeOr) {
    const start = normalizePrintTime(rangeOr[1]!);
    const end = normalizePrintTime(rangeOr[2]!);
    const title = cleaned.replace(RANGE_OR, "").replace(/\s{2,}/g, " ").replace(/^[:\s—–-]+/, "").trim();
    return {
      timeLabel: `${start} – ${end}`,
      title: title || cleaned,
      notes: [],
      kind: "event",
    };
  }

  const arrive = cleaned.match(new RegExp(`^(.*?)\\s+arrives? at\\s+${TIME_TOKEN}(.*)$`, "i"));
  if (arrive) {
    return {
      timeLabel: normalizePrintTime(arrive[2]!),
      title: `${arrive[1]!.trim()} arrives${arrive[3]!.trim() ? ` ${arrive[3]!.trim()}` : ""}`.replace(/\s{2,}/g, " "),
      notes: [],
      kind: "event",
    };
  }

  const atTime = cleaned.match(new RegExp(`^(.*?)\\s+at\\s+${TIME_TOKEN}(.*)$`, "i"));
  if (atTime && atTime[1]!.trim().length > 0 && atTime[1]!.trim().length < 80) {
    return {
      timeLabel: normalizePrintTime(atTime[2]!),
      title: `${atTime[1]!.trim()}${atTime[3]!.trim() ? ` ${atTime[3]!.trim()}` : ""}`.replace(/\s{2,}/g, " "),
      notes: [],
      kind: "event",
    };
  }

  return null;
}

function eventSortKey(event: PrintRunSheetEvent): ReturnType<typeof parseDayOfTime> {
  if (event.kind === "tbd" || /^time tbd$/i.test(event.timeLabel)) {
    return { kind: "untimed", raw: event.timeLabel };
  }
  const start = event.timeLabel.split("–")[0]!.trim();
  const parsed = parseDayOfTime(start);
  if (parsed.kind === "timed") return parsed;
  const withPm = parseDayOfTime(`${start} PM`);
  return withPm.kind === "timed" ? withPm : { kind: "untimed", raw: event.timeLabel };
}

export function projectRunSheet(
  blocks: Array<{ startAt: string; endAt: string | null; notes: string; schedule?: string | null; sortOrder?: number }>,
): PrintRunSheetPhase[] {
  const wedding = [...blocks]
    .filter((row) => parseTimelineSchedule(row.schedule) === "wedding")
    .sort((a, b) => {
      const cmp = compareParsedTimes(parseDayOfTime(a.startAt), parseDayOfTime(b.startAt));
      if (cmp !== 0) return cmp;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });

  return wedding.map((block) => {
    const parsed = parseBlockNotes(block.notes);
    const events: PrintRunSheetEvent[] = [];
    const leftover: string[] = [];

    for (const line of parsed.detailLines) {
      if (isMusicLine(line)) continue;
      if (isMcCueLine(line)) {
        events.push({
          timeLabel: extractCueTime(line) ?? normalizePrintTime(block.startAt),
          title: mcPointerTitle(line, parsed.title),
          notes: ["See MC Run of Show"],
          kind: "mc-pointer",
        });
        continue;
      }
      const timed = timedEventFromLine(line);
      if (timed) {
        events.push(timed);
        continue;
      }
      const cleaned = professionalizePrintLine(line);
      if (cleaned && cleaned.toLowerCase() !== parsed.title.toLowerCase()) leftover.push(cleaned);
    }

    events.sort((a, b) => compareParsedTimes(eventSortKey(a), eventSortKey(b)));

    const unique: PrintRunSheetEvent[] = [];
    for (const event of events) {
      const dup = unique.find(
        (row) =>
          row.timeLabel === event.timeLabel &&
          row.title.toLowerCase() === event.title.toLowerCase(),
      );
      if (dup) {
        for (const note of event.notes) {
          if (!dup.notes.includes(note)) dup.notes.push(note);
        }
        continue;
      }
      unique.push(event);
    }

    const filtered = unique.filter((event) => {
      if (event.kind !== "event") return true;
      return event.title.toLowerCase() !== parsed.title.toLowerCase();
    });

    if (filtered.length === 0 && leftover.length) {
      leftover.forEach((note) => {
        filtered.push({
          timeLabel: "",
          title: note,
          notes: [],
          kind: "event",
        });
      });
      leftover.length = 0;
    }

    return {
      title: parsed.title,
      location: parsed.location,
      notes: leftover,
      events: filtered,
    };
  });
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
    role: contact.directoryLabel?.trim() || null,
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
    notes: professionalizePrintLines([item.detail, item.notes].filter((line): line is string => Boolean(line))),
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
}): PrintQuickReference {
  const all = [...input.rehearsalBlocks, ...input.weddingBlocks];
  const ceremony = input.weddingBlocks.find((block) => /^ceremony$/i.test(parseBlockNotes(block.notes).title));
  const dancing = input.weddingBlocks.find((block) => /open dancing/i.test(parseBlockNotes(block.notes).title));
  const teardown = input.weddingBlocks.find((block) => /tear down|clean up/i.test(parseBlockNotes(block.notes).title));
  const avalon = input.contacts.find((contact) => /avalon/i.test(contact.name));
  const venueLine = firstMatchingLine(all, /342\s+62nd|black sheep shelter/i);
  const airbnbLine = firstMatchingLine(all, /10268\s+51st|airbnb:/i);
  const hawksLine = firstMatchingLine(all, /hawkshead|523 hawks/i);
  const closeLine = firstMatchingLine(input.weddingBlocks, /venue closes/i);

  let coordinatorPhone = avalon?.phone?.trim() || input.coordinatorPhoneHint;
  if (coordinatorPhone) coordinatorPhone = coordinatorPhone.replace(/\./g, "-");

  return {
    coupleNames: input.coupleNames,
    weddingDateLabel: input.weddingDateLabel,
    ceremonyTime: ceremony ? normalizePrintTime(ceremony.startAt) : "3:30 PM",
    venueName: "Black Sheep Shelter",
    venueAddress: venueLine && /342/.test(venueLine)
      ? addressesFromLine(venueLine.replace(/^.*?(342)/, "342"))
      : ["342 62nd St", "South Haven, MI 49090"],
    airbnbName: "Airbnb",
    airbnbAddress: airbnbLine && /10268/.test(airbnbLine)
      ? addressesFromLine(airbnbLine)
      : ["10268 51st St", "Grand Junction, MI 49056"],
    rehearsalDinnerName: "Hawkshead",
    rehearsalDinnerAddress: hawksLine && /523/.test(hawksLine)
      ? addressesFromLine(hawksLine.replace(/^.*?(523)/, "523"))
      : ["523 Hawks Nest Dr", "South Haven, MI"],
    coordinatorName: avalon ? avalon.name.split("·")[0]!.trim() : "Avalon Green",
    coordinatorPhone,
    mistressOfCeremonies: input.mistressOfCeremonies,
    mcName: input.mcName,
    receptionEnds: dancing?.endAt ? normalizePrintTime(dancing.endAt) : "10:00 PM",
    venueCloses: closeLine
      ? normalizePrintTime(closeLine.match(new RegExp(TIME_TOKEN, "i"))?.[1] ?? "11:00 PM")
      : teardown?.endAt
        ? normalizePrintTime(teardown.endAt)
        : "11:00 PM",
    rsvp: input.rsvp,
  };
}

export function mcRoleSplit(
  people: Array<{ name: string; directoryLabel?: string | null }>,
): { mistressOfCeremonies: string | null; mcName: string | null } {
  let mistressOfCeremonies: string | null = null;
  let mcName: string | null = null;
  for (const person of people) {
    const label = person.directoryLabel ?? "";
    if (/mistress of ceremon/i.test(label)) mistressOfCeremonies = person.name;
    else if (/(^|\b)mc(\b|$)/i.test(label) || /master of ceremon/i.test(label)) mcName = person.name;
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
