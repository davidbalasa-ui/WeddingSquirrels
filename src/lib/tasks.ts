import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { SessionAccount } from "@/lib/types";
import { startOfDay, endOfDay, addDays } from "date-fns";

export type TaskWithAssignees = Prisma.TaskGetPayload<{
  include: {
    assignees: { include: { person: true } };
    children: true;
  };
}>;

export type TaskWorkspace = Prisma.TaskGetPayload<{
  include: {
    assignees: { include: { person: true } };
    children: {
      include: { assignees: { include: { person: true } } };
      orderBy: { sortOrder: "asc" };
    };
    budgetItem: true;
  };
}>;

export function taskVisibilityWhere(session: SessionAccount): Prisma.TaskWhereInput {
  if (!session.canSeeTasks) {
    return { id: "__none__" };
  }
  if (session.isMaster || !session.assigneeFilter?.length) {
    return {};
  }
  return {
    OR: [
      { assignees: { some: { personId: { in: session.assigneeFilter } } } },
      {
        children: {
          some: { assignees: { some: { personId: { in: session.assigneeFilter } } } },
        },
      },
    ],
  };
}

export async function listTasks(
  session: SessionAccount,
  opts: { showDone?: boolean; personId?: string | null } = {},
) {
  const base = taskVisibilityWhere(session);
  const and: Prisma.TaskWhereInput[] = [base, { parentId: null }];

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
      and.push({
        OR: [
          { assignees: { some: { personId: opts.personId } } },
          {
            children: {
              some: { assignees: { some: { personId: opts.personId } } },
            },
          },
        ],
      });
    }
  }

  const tasks = await prisma.task.findMany({
    where: { AND: and },
    include: {
      assignees: { include: { person: true } },
      children: true,
    },
    orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }, { title: "asc" }],
  });

  return rankTasks(tasks);
}

export async function getTaskWorkspace(session: SessionAccount, id: string) {
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      assignees: { include: { person: true } },
      children: {
        include: { assignees: { include: { person: true } } },
        orderBy: { sortOrder: "asc" },
      },
      budgetItem: true,
    },
  });
  if (!task) return null;

  // Only top-level packages are workspaces; if child, redirect to parent
  if (task.parentId) {
    return getTaskWorkspace(session, task.parentId);
  }

  if (!session.canSeeTasks) return null;
  if (session.assigneeFilter?.length) {
    const ok =
      task.assignees.some((a) => session.assigneeFilter!.includes(a.personId)) ||
      task.children.some((c) =>
        c.assignees.some((a) => session.assigneeFilter!.includes(a.personId)),
      );
    if (!ok) return null;
  }

  return task;
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
