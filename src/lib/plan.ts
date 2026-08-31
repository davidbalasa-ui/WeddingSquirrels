import { startOfDay } from "date-fns";
import { prisma } from "@/lib/db";
import { taskVisibilityWhere } from "@/lib/tasks";
import type { ModuleIconName } from "@/lib/modules";
import type { SessionAccount } from "@/lib/types";

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
  href: string;
  icon: ModuleIconName;
  attention?: boolean;
};

export type PlanCounts = {
  tasks?: { open: number; overdue: number };
  timeline?: { moments: number };
  rehearsal?: { moments: number; mealGuests: number; mealChoices: number; published: boolean };
  stay?: { assigned: number; total: number };
  shopping?: { remaining: number; purchased: number };
  calendar?: { upcoming: number; nextTitle: string | null };
};

export function buildPlanDomainSummaries(
  session: SessionAccount,
  counts: PlanCounts,
): PlanDomainSummary[] {
  const rows: PlanDomainSummary[] = [];

  if (session.canSeeTasks && counts.tasks) {
    const overdue = counts.tasks.overdue;
    rows.push({
      key: "tasks",
      label: "Tasks",
      detail: overdue
        ? `${counts.tasks.open} open · ${overdue} overdue`
        : `${counts.tasks.open} open · nothing overdue`,
      href: "/plan/tasks",
      icon: "tasks",
      attention: overdue > 0,
    });
  }

  if (session.canSeeTimeline && counts.timeline) {
    rows.push({
      key: "timeline",
      label: "Wedding timeline",
      detail: `${counts.timeline.moments} ${counts.timeline.moments === 1 ? "moment" : "moments"} mapped`,
      href: "/day",
      icon: "day",
    });
  }

  if (session.canSeeDinner && counts.rehearsal) {
    const dinner =
      counts.rehearsal.mealGuests > 0
        ? `${counts.rehearsal.mealChoices}/${counts.rehearsal.mealGuests} guests have choices`
        : "Dinner choices not started";
    rows.push({
      key: "rehearsal",
      label: "Rehearsal & dinner",
      detail: `${counts.rehearsal.moments} schedule moments · ${dinner}${
        counts.rehearsal.published ? " · published" : ""
      }`,
      href: "/rehearsal",
      icon: "rehearsal",
    });
  }

  if (session.canSeeStay && counts.stay) {
    rows.push({
      key: "stay",
      label: "Stay",
      detail: `${counts.stay.assigned}/${counts.stay.total} beds assigned`,
      href: "/stay",
      icon: "stay",
      attention: counts.stay.assigned < counts.stay.total,
    });
  }

  if (session.canSeeShop && counts.shopping) {
    rows.push({
      key: "shopping",
      label: "Shopping",
      detail: `${counts.shopping.remaining} to buy · ${counts.shopping.purchased} purchased`,
      href: "/plan/shopping",
      icon: "shop",
      attention: counts.shopping.remaining > 0,
    });
  }

  if (session.canSeeCalendar && counts.calendar) {
    rows.push({
      key: "calendar",
      label: "Calendar",
      detail: counts.calendar.nextTitle
        ? `${counts.calendar.upcoming} upcoming · next: ${counts.calendar.nextTitle}`
        : "No upcoming events",
      href: "/plan/calendar",
      icon: "calendar",
    });
  }

  return rows;
}

export async function loadPlanPageData(session: SessionAccount) {
  const today = startOfDay(new Date());

  const [taskCounts, timelineCount, rehearsal, staySlots, shopping, calendar] =
    await Promise.all([
      session.canSeeTasks
        ? Promise.all([
            prisma.task.count({
              where: {
                AND: [
                  taskVisibilityWhere(session),
                  { parentId: null, orgKey: null, status: { not: "done" } },
                ],
              },
            }),
            prisma.task.count({
              where: {
                AND: [
                  taskVisibilityWhere(session),
                  {
                    parentId: null,
                    orgKey: null,
                    status: { not: "done" },
                    dueDate: { lt: today },
                  },
                ],
              },
            }),
          ])
        : Promise.resolve(null),
      session.canSeeTimeline
        ? prisma.timelineBlock.count({ where: { schedule: "wedding" } })
        : Promise.resolve(null),
      session.canSeeDinner
        ? Promise.all([
            prisma.timelineBlock.count({ where: { schedule: "rehearsal" } }),
            prisma.mealGuest.count(),
            prisma.mealChoice.groupBy({ by: ["guestId"] }),
            prisma.mealSettings.findUnique({ where: { id: 1 }, select: { published: true } }),
          ])
        : Promise.resolve(null),
      session.canSeeStay
        ? prisma.staySlot.findMany({ select: { occupant: true } })
        : Promise.resolve(null),
      session.canSeeShop
        ? Promise.all([
            prisma.shoppingItem.count({ where: { purchased: false } }),
            prisma.shoppingItem.count({ where: { purchased: true } }),
          ])
        : Promise.resolve(null),
      session.canSeeCalendar
        ? Promise.all([
            prisma.calendarEvent.count({ where: { endDate: { gte: today } } }),
            prisma.calendarEvent.findFirst({
              where: { endDate: { gte: today } },
              orderBy: { startDate: "asc" },
              select: { title: true },
            }),
          ])
        : Promise.resolve(null),
    ]);

  const counts: PlanCounts = {
    ...(taskCounts
      ? { tasks: { open: taskCounts[0], overdue: taskCounts[1] } }
      : {}),
    ...(timelineCount !== null ? { timeline: { moments: timelineCount } } : {}),
    ...(rehearsal
      ? {
          rehearsal: {
            moments: rehearsal[0],
            mealGuests: rehearsal[1],
            mealChoices: rehearsal[2].length,
            published: Boolean(rehearsal[3]?.published),
          },
        }
      : {}),
    ...(staySlots
      ? {
          stay: {
            assigned: staySlots.filter((slot) => slot.occupant.trim()).length,
            total: staySlots.length,
          },
        }
      : {}),
    ...(shopping
      ? { shopping: { remaining: shopping[0], purchased: shopping[1] } }
      : {}),
    ...(calendar
      ? { calendar: { upcoming: calendar[0], nextTitle: calendar[1]?.title ?? null } }
      : {}),
  };

  return {
    rows: buildPlanDomainSummaries(session, counts),
    openTasks: counts.tasks?.open ?? 0,
  };
}
