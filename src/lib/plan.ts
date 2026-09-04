import { addDays, differenceInCalendarDays, endOfDay, format, startOfDay } from "date-fns";
import { can, canSeeDinnerTab, canSeeStayTab } from "@/lib/access";
import { prisma } from "@/lib/db";
import { countFinishedGuests, type MealChoiceMap, type MealCourseView } from "@/lib/meals";
import { reviewNoteLines, sortTimelineBlocks } from "@/lib/day-of-time";
import { listTasks, type TaskWithAssignees } from "@/lib/tasks";
import type { SessionAccount } from "@/lib/types";

export const PLAN_TASK_DUE_SOON_DAYS = 7;

export type PlanDomainKey =
  | "tasks"
  | "timeline"
  | "rehearsal"
  | "stay"
  | "shopping"
  | "calendar";

export type PlanDomainSummary = {
  key: PlanDomainKey;
  label: string;
  detail: string;
  explanation: string;
  href: string;
  attention?: boolean;
};

export type PlanTaskCounts = {
  open: number;
  overdue: number;
  dueSoon: number;
};

export type PlanTimelineCounts = {
  moments: number;
  nextLabel: string | null;
  nextTime: string | null;
};

export type PlanRehearsalCounts = {
  moments: number;
  mealGuests: number;
  mealChoices: number;
  published: boolean;
};

export type PlanStayCounts = {
  assigned: number;
  total: number;
  open: number;
};

export type PlanShoppingCounts = {
  remaining: number;
  purchased: number;
};

export type PlanCalendarCounts = {
  upcoming: number;
  nextTitle: string | null;
  nextWhen: string | null;
};

export type PlanCounts = {
  tasks?: PlanTaskCounts;
  timeline?: PlanTimelineCounts;
  rehearsal?: PlanRehearsalCounts;
  stay?: PlanStayCounts;
  shopping?: PlanShoppingCounts;
  calendar?: PlanCalendarCounts;
};

export type PlanTaskView = "open" | "overdue" | "soon" | "mine" | "done";

export function parsePlanTaskView(raw: string | null | undefined): PlanTaskView {
  if (raw === "overdue" || raw === "soon" || raw === "mine" || raw === "done") return raw;
  return "open";
}

function dayStart(now: Date) {
  return startOfDay(now);
}

export function taskIsOverdue(dueDate: Date | null | undefined, now: Date) {
  if (!dueDate) return false;
  return dueDate < dayStart(now);
}

export function taskIsDueSoon(dueDate: Date | null | undefined, now: Date) {
  if (!dueDate) return false;
  const today = dayStart(now);
  if (dueDate < today) return false;
  return dueDate <= endOfDay(addDays(today, PLAN_TASK_DUE_SOON_DAYS - 1));
}

export function summarizeVisibleTasks(
  tasks: Array<{ dueDate: Date | null }>,
  now: Date,
): PlanTaskCounts {
  const open = tasks.length;
  let overdue = 0;
  let dueSoon = 0;
  for (const task of tasks) {
    if (taskIsOverdue(task.dueDate, now)) overdue += 1;
    else if (taskIsDueSoon(task.dueDate, now)) dueSoon += 1;
  }
  return { open, overdue, dueSoon };
}

export function taskMatchesMine(
  task: { assignees: Array<{ personId: string }> },
  session: Pick<SessionAccount, "linkedPersonId" | "assigneeFilter">,
) {
  const ids = new Set<string>();
  if (session.linkedPersonId) ids.add(session.linkedPersonId);
  for (const id of session.assigneeFilter ?? []) ids.add(id);
  if (ids.size === 0) return false;
  return task.assignees.some((row) => ids.has(row.personId));
}

export function filterTasksForPlanView(
  tasks: TaskWithAssignees[],
  view: PlanTaskView,
  session: Pick<SessionAccount, "linkedPersonId" | "assigneeFilter">,
  now: Date,
): TaskWithAssignees[] {
  if (view === "done") return tasks.filter((task) => task.status === "done");
  const open = tasks.filter((task) => task.status !== "done");
  if (view === "overdue") return open.filter((task) => taskIsOverdue(task.dueDate, now));
  if (view === "soon") return open.filter((task) => taskIsDueSoon(task.dueDate, now));
  if (view === "mine") return open.filter((task) => taskMatchesMine(task, session));
  return open;
}

function timelineTitle(notes: string) {
  return reviewNoteLines(notes)[0] ?? null;
}

export function summarizeWeddingTimeline(
  blocks: Array<{
    id: string;
    startAt: string;
    notes: string;
    sortOrder: number;
    schedule?: string | null;
  }>,
): PlanTimelineCounts {
  const wedding = sortTimelineBlocks(
    blocks.filter((block) => (block.schedule ?? "wedding") === "wedding"),
  );
  const first = wedding[0];
  const nextLabel = first ? timelineTitle(first.notes) : null;
  const nextTime = first?.startAt.trim() ? first.startAt.trim() : null;
  return {
    moments: wedding.length,
    nextLabel,
    nextTime,
  };
}

export function summarizeRehearsal(input: {
  blocks: Array<{ schedule?: string | null }>;
  courses: MealCourseView[];
  guests: Array<{ choices: MealChoiceMap }>;
  published: boolean;
}): PlanRehearsalCounts {
  const moments = input.blocks.filter((block) => block.schedule === "rehearsal").length;
  return {
    moments,
    mealGuests: input.guests.length,
    mealChoices: countFinishedGuests(input.courses, input.guests),
    published: input.published,
  };
}

export function summarizeStayOccupancy(
  slots: Array<{ occupant: string | null; optional: boolean }>,
): PlanStayCounts {
  const required = slots.filter((slot) => !slot.optional);
  const assigned = required.filter((slot) => Boolean(slot.occupant?.trim())).length;
  const total = required.length;
  return {
    assigned,
    total,
    open: Math.max(0, total - assigned),
  };
}

export function summarizeShoppingItems(
  items: Array<{ purchased: boolean }>,
): PlanShoppingCounts {
  let remaining = 0;
  let purchased = 0;
  for (const item of items) {
    if (item.purchased) purchased += 1;
    else remaining += 1;
  }
  return { remaining, purchased };
}

export type PlanCalendarEvent = {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
};

export function upcomingCalendarEvents(events: PlanCalendarEvent[], now: Date): PlanCalendarEvent[] {
  const today = dayStart(now);
  return events
    .filter((event) => event.endDate >= today)
    .sort((a, b) => {
      const start = a.startDate.getTime() - b.startDate.getTime();
      if (start !== 0) return start;
      const end = a.endDate.getTime() - b.endDate.getTime();
      if (end !== 0) return end;
      return a.title.localeCompare(b.title);
    });
}

export function formatPlanEventWhen(date: Date, now: Date) {
  const day = startOfDay(date);
  const today = dayStart(now);
  const diff = differenceInCalendarDays(day, today);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff > 1 && diff < 7) return format(day, "EEEE");
  return format(day, "MMM d");
}

export function summarizeCalendarEvents(
  events: PlanCalendarEvent[],
  now: Date,
): PlanCalendarCounts {
  const upcoming = upcomingCalendarEvents(events, now);
  const next = upcoming[0] ?? null;
  return {
    upcoming: upcoming.length,
    nextTitle: next?.title ?? null,
    nextWhen: next ? formatPlanEventWhen(next.startDate, now) : null,
  };
}

function taskDetail(counts: PlanTaskCounts) {
  if (counts.open === 0) return "Nothing open right now";
  const parts: string[] = [`${counts.open} open`];
  if (counts.overdue > 0) {
    parts.push(`${counts.overdue} overdue`);
  } else if (counts.dueSoon > 0) {
    parts.push(`${counts.dueSoon} due this week`);
  }
  return parts.join(" · ");
}

function timelineDetail(counts: PlanTimelineCounts) {
  if (counts.moments === 0) return "No moments mapped yet";
  const noun = counts.moments === 1 ? "timeline moment" : "timeline moments";
  if (counts.nextTime) return `${counts.moments} ${noun} · from ${counts.nextTime}`;
  return `${counts.moments} ${noun}`;
}

function rehearsalDetail(counts: PlanRehearsalCounts) {
  const parts: string[] = [];
  if (counts.moments === 0) parts.push("No walkthrough yet");
  else parts.push(`${counts.moments} walkthrough ${counts.moments === 1 ? "moment" : "moments"}`);

  if (counts.mealGuests === 0) {
    parts.push("Dinner not started");
  } else if (counts.mealChoices === 0) {
    parts.push("Meal choices still open");
  } else if (counts.mealChoices < counts.mealGuests) {
    parts.push(`${counts.mealChoices} of ${counts.mealGuests} meals chosen`);
  } else {
    parts.push("Meal choices complete");
  }

  if (counts.mealGuests > 0 && !counts.published) {
    parts.push("not published");
  }

  return parts.join(" · ");
}

function stayDetail(counts: PlanStayCounts) {
  if (counts.total === 0) return "Beds are not laid out yet";
  if (counts.assigned === 0) return `${counts.total} beds open`;
  if (counts.open === 0) return `All ${counts.total} beds assigned`;
  return `${counts.assigned} of ${counts.total} beds assigned`;
}

function shoppingDetail(counts: PlanShoppingCounts) {
  if (counts.remaining === 0 && counts.purchased === 0) return "List is empty";
  if (counts.remaining === 0) return "Everything is purchased";
  if (counts.remaining === 1) return "1 thing left";
  return `${counts.remaining} things left`;
}

function calendarNextPhrase(when: string) {
  if (when === "today" || when === "tomorrow") return when;
  return `next ${when}`;
}

function calendarDetail(counts: PlanCalendarCounts) {
  if (counts.upcoming === 0) return "Nothing upcoming";
  if (counts.nextWhen) {
    const nextBit = calendarNextPhrase(counts.nextWhen);
    if (counts.upcoming === 1) {
      return nextBit === "today" || nextBit === "tomorrow"
        ? nextBit.charAt(0).toUpperCase() + nextBit.slice(1)
        : `Next ${counts.nextWhen}`;
    }
    return `${counts.upcoming} upcoming · ${nextBit}`;
  }
  return counts.upcoming === 1 ? "1 upcoming" : `${counts.upcoming} upcoming`;
}

export function buildPlanDomainSummaries(
  session: SessionAccount,
  counts: PlanCounts,
): PlanDomainSummary[] {
  const rows: PlanDomainSummary[] = [];

  if (can(session, "canSeeTasks") && counts.tasks) {
    rows.push({
      key: "tasks",
      label: "Tasks",
      detail: taskDetail(counts.tasks),
      explanation: "Keep the plan moving.",
      href: "/plan/tasks",
      attention: counts.tasks.overdue > 0,
    });
  }

  if (can(session, "canSeeTimeline") && counts.timeline) {
    rows.push({
      key: "timeline",
      label: "Wedding Day",
      detail: timelineDetail(counts.timeline),
      explanation: "Shape the day from getting ready to last dance.",
      href: "/plan/timeline",
    });
  }

  if (canSeeDinnerTab(session) && counts.rehearsal) {
    rows.push({
      key: "rehearsal",
      label: "Rehearsal & Dinner",
      detail: rehearsalDetail(counts.rehearsal),
      explanation: "Walkthrough, dinner, and meal choices.",
      href: "/plan/rehearsal",
    });
  }

  if (canSeeStayTab(session) && counts.stay) {
    rows.push({
      key: "stay",
      label: "Stay",
      detail: stayDetail(counts.stay),
      explanation: "Know where everyone is sleeping.",
      href: "/plan/stay",
    });
  }

  if (can(session, "canSeeShop") && counts.shopping) {
    rows.push({
      key: "shopping",
      label: "Shopping",
      detail: shoppingDetail(counts.shopping),
      explanation: "Everything still to buy.",
      href: "/plan/shopping",
      attention: counts.shopping.remaining > 0,
    });
  }

  if (can(session, "canSeeCalendar") && counts.calendar) {
    rows.push({
      key: "calendar",
      label: "Calendar",
      detail: calendarDetail(counts.calendar),
      explanation: "See the wedding at a glance.",
      href: "/plan/calendar",
    });
  }

  return rows;
}

export async function loadPlanPageData(session: SessionAccount, now = new Date()) {
  const [taskRows, timelineBlocks, rehearsal, staySlots, shoppingItems, calendarEvents] =
    await Promise.all([
      can(session, "canSeeTasks") ? listTasks(session) : Promise.resolve(null),
      can(session, "canSeeTimeline")
        ? prisma.timelineBlock.findMany({
            where: { schedule: "wedding" },
            select: { id: true, startAt: true, notes: true, sortOrder: true, schedule: true },
          })
        : Promise.resolve(null),
      canSeeDinnerTab(session)
        ? Promise.all([
            prisma.timelineBlock.findMany({
              where: { schedule: "rehearsal" },
              select: { schedule: true },
            }),
            prisma.mealCourse.findMany({
              orderBy: { sortOrder: "asc" },
              include: { options: { orderBy: { sortOrder: "asc" } } },
            }),
            prisma.mealGuest.findMany({
              include: { choices: true },
              orderBy: { sortOrder: "asc" },
            }),
            prisma.mealSettings.findUnique({ where: { id: 1 }, select: { published: true } }),
          ])
        : Promise.resolve(null),
      canSeeStayTab(session)
        ? prisma.staySlot.findMany({ select: { occupant: true, optional: true } })
        : Promise.resolve(null),
      can(session, "canSeeShop")
        ? prisma.shoppingItem.findMany({ select: { purchased: true } })
        : Promise.resolve(null),
      can(session, "canSeeCalendar")
        ? prisma.calendarEvent.findMany({
            select: { id: true, title: true, startDate: true, endDate: true },
          })
        : Promise.resolve(null),
    ]);

  const counts: PlanCounts = {
    ...(taskRows ? { tasks: summarizeVisibleTasks(taskRows, now) } : {}),
    ...(timelineBlocks ? { timeline: summarizeWeddingTimeline(timelineBlocks) } : {}),
    ...(rehearsal
      ? {
          rehearsal: summarizeRehearsal({
            blocks: rehearsal[0],
            courses: rehearsal[1].map((course) => ({
              id: course.id,
              label: course.label,
              options: course.options.map((option) => ({
                id: option.id,
                label: option.label,
              })),
            })),
            guests: rehearsal[2].map((guest) => ({
              choices: Object.fromEntries(
                guest.choices.map((choice) => [choice.courseId, choice.optionId]),
              ),
            })),
            published: Boolean(rehearsal[3]?.published),
          }),
        }
      : {}),
    ...(staySlots ? { stay: summarizeStayOccupancy(staySlots) } : {}),
    ...(shoppingItems ? { shopping: summarizeShoppingItems(shoppingItems) } : {}),
    ...(calendarEvents ? { calendar: summarizeCalendarEvents(calendarEvents, now) } : {}),
  };

  return {
    rows: buildPlanDomainSummaries(session, counts),
    counts,
  };
}
