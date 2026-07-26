import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { SessionAccount } from "@/lib/types";
import { startOfDay, endOfDay, addDays } from "date-fns";

export type TaskWithAssignees = Prisma.TaskGetPayload<{
  include: { assignees: { include: { person: true } } };
}>;

export function taskVisibilityWhere(session: SessionAccount): Prisma.TaskWhereInput {
  if (!session.canSeeTasks) {
    return { id: "__none__" };
  }
  if (session.isMaster || !session.assigneeFilter?.length) {
    return {};
  }
  return {
    assignees: {
      some: {
        personId: { in: session.assigneeFilter },
      },
    },
  };
}

export async function listTasks(
  session: SessionAccount,
  opts: { showDone?: boolean; personId?: string | null } = {},
) {
  const base = taskVisibilityWhere(session);
  const and: Prisma.TaskWhereInput[] = [base];

  if (!opts.showDone) {
    and.push({ status: { not: "done" } });
  }

  if (opts.personId) {
    if (opts.personId === "both") {
      and.push({
        AND: [
          { assignees: { some: { personId: "david" } } },
          { assignees: { some: { personId: "haley" } } },
        ],
      });
    } else {
      and.push({ assignees: { some: { personId: opts.personId } } });
    }
  }

  const tasks = await prisma.task.findMany({
    where: { AND: and },
    include: { assignees: { include: { person: true } } },
    orderBy: [{ dueDate: "asc" }, { title: "asc" }],
  });

  return rankTasks(tasks);
}

function rankTasks(tasks: TaskWithAssignees[]) {
  const today = startOfDay(new Date());
  const week = endOfDay(addDays(today, 7));

  const score = (task: TaskWithAssignees) => {
    if (task.status === "done") return 9000;
    if (!task.dueDate) return 8000;
    const d = task.dueDate;
    if (d < today) return 0;
    if (d <= endOfDay(today)) return 1;
    if (d <= week) return 2;
    return 3;
  };

  return [...tasks].sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    if (sa !== sb) return sa - sb;
    const da = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const db = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (da !== db) return da - db;
    return a.title.localeCompare(b.title);
  });
}

export function dueLabel(dueDate: Date | null | undefined, status: string) {
  if (!dueDate || status === "done") return null;
  const today = startOfDay(new Date());
  const d = startOfDay(dueDate);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return `Overdue · ${Math.abs(diff)}d`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  if (diff <= 7) return `Due in ${diff}d`;
  return dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
