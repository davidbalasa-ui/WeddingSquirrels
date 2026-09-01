import { startOfDay } from "date-fns";
import { prisma } from "@/lib/db";
import { countFinishedGuests } from "@/lib/meals";
import type { ModuleIconName } from "@/lib/modules";
import { assigneeDisplayNames } from "@/lib/people";
import { dueLabel, listTasks } from "@/lib/tasks";
import type { SessionAccount } from "@/lib/types";

export type PlanDomainKey =
  | "tasks"
  | "timeline"
  | "rehearsal"
  | "stay"
  | "shopping";

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
};

export type PlanFocus = {
  title: string;
  detail: string | null;
  ownerLabel: string;
  dueLabel: string | null;
  href: string;
  escalated: boolean;
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

  return rows;
}

export async function loadPlanPageData(session: SessionAccount) {
  const today = startOfDay(new Date());

  const [taskRows, timelineCount, rehearsal, staySlots, shopping] =
    await Promise.all([
      session.canSeeTasks
        ? listTasks(session)
        : Promise.resolve(null),
      session.canSeeTimeline
        ? prisma.timelineBlock.count({ where: { schedule: "wedding" } })
        : Promise.resolve(null),
      session.canSeeDinner
        ? Promise.all([
            prisma.timelineBlock.count({ where: { schedule: "rehearsal" } }),
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
      session.canSeeStay
        ? prisma.staySlot.findMany({ select: { occupant: true, optional: true } })
        : Promise.resolve(null),
      session.canSeeShop
        ? Promise.all([
            prisma.shoppingItem.count({ where: { purchased: false } }),
            prisma.shoppingItem.count({ where: { purchased: true } }),
          ])
        : Promise.resolve(null),
    ]);

  const counts: PlanCounts = {
    ...(taskRows
      ? {
          tasks: {
            open: taskRows.length,
            overdue: taskRows.filter((task) => task.dueDate && task.dueDate < today).length,
          },
        }
      : {}),
    ...(timelineCount !== null ? { timeline: { moments: timelineCount } } : {}),
    ...(rehearsal
      ? {
          rehearsal: {
            moments: rehearsal[0],
            mealGuests: rehearsal[2].length,
            mealChoices: countFinishedGuests(
              rehearsal[1].map((course) => ({
                id: course.id,
                label: course.label,
                options: course.options.map((option) => ({
                  id: option.id,
                  label: option.label,
                })),
              })),
              rehearsal[2].map((guest) => ({
                choices: Object.fromEntries(
                  guest.choices.map((choice) => [choice.courseId, choice.optionId]),
                ),
              })),
            ),
            published: Boolean(rehearsal[3]?.published),
          },
        }
      : {}),
    ...(staySlots
      ? {
          stay: {
            assigned: staySlots.filter((slot) => !slot.optional && slot.occupant.trim()).length,
            total: staySlots.filter((slot) => !slot.optional).length,
          },
        }
      : {}),
    ...(shopping
      ? { shopping: { remaining: shopping[0], purchased: shopping[1] } }
      : {}),
  };

  const focusTask = taskRows?.[0] ?? null;
  const focus: PlanFocus | null = focusTask
    ? {
        title: focusTask.title,
        detail: focusTask.planNotes?.trim() || focusTask.summary,
        ownerLabel: assigneeDisplayNames(focusTask.assignees) || "Unassigned",
        dueLabel: dueLabel(focusTask.dueDate, focusTask.status),
        href: `/work/${focusTask.id}`,
        escalated: Boolean(focusTask.escalatedAt),
      }
    : null;

  return {
    rows: buildPlanDomainSummaries(session, counts),
    openTasks: counts.tasks?.open ?? 0,
    focus,
  };
}
