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

type TaskAccessShape = {
  id: string;
  parentId?: string | null;
  assignees: { personId: string }[];
  children?: { assignees: { personId: string }[] }[];
};

/** True when a filtered PIN can see/edit this task via owners (not shares). */
export function taskMatchesAssigneeFilter(
  task: Pick<TaskAccessShape, "assignees" | "children">,
  filter: string[] | null | undefined,
): boolean {
  if (!filter?.length) return true;
  if (task.assignees.some((row) => filter.includes(row.personId))) return true;
  return (task.children ?? []).some((child) =>
    child.assignees.some((row) => filter.includes(row.personId)),
  );
}

export async function sessionCanMutateTask(
  session: SessionAccount,
  task: TaskAccessShape,
): Promise<boolean> {
  if (!session.canSeeTasks) return false;
  if (session.isMaster || !session.assigneeFilter?.length) return true;
  const rootId = task.parentId || task.id;
  const shared = await prisma.taskShare.findFirst({
    where: { taskId: rootId, pinAccountId: session.id },
    select: { taskId: true },
  });
  if (shared) return true;
  if (taskMatchesAssigneeFilter(task, session.assigneeFilter)) return true;
  if (task.parentId) {
    const parent = await prisma.task.findUnique({
      where: { id: task.parentId },
      include: { assignees: true },
    });
    if (parent && taskMatchesAssigneeFilter(parent, session.assigneeFilter)) return true;
  }
  return false;
}

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
      { shares: { some: { pinAccountId: session.id } } },
    ],
  };
}

export async function listTasks(
  session: SessionAccount,
  opts: { showDone?: boolean; personId?: string | null } = {},
) {
  const base = taskVisibilityWhere(session);
  const and: Prisma.TaskWhereInput[] = [base, { parentId: null }, { orgKey: null }];

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
    } else if (opts.personId === "david") {
      and.push({
        AND: [
          { assignees: { some: { personId: "david" } } },
          { NOT: { assignees: { some: { personId: "haley" } } } },
        ],
      });
    } else if (opts.personId === "haley") {
      and.push({
        AND: [
          { assignees: { some: { personId: "haley" } } },
          { NOT: { assignees: { some: { personId: "david" } } } },
        ],
      });
    } else {
      and.push({
        assignees: { some: { personId: opts.personId } },
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

export async function listOrgCards(session: SessionAccount, opts: { showDone?: boolean } = {}) {
  const base = taskVisibilityWhere(session);
  const and: Prisma.TaskWhereInput[] = [
    base,
    { parentId: null },
    { orgKey: { in: ["week_before", "day_before"] } },
  ];
  if (!opts.showDone) {
    and.push({ status: { not: "done" } });
  }

  return prisma.task.findMany({
    where: { AND: and },
    include: {
      assignees: { include: { person: true } },
      children: true,
    },
    orderBy: [{ sortOrder: "asc" }],
  });
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

  if (!(await sessionCanMutateTask(session, task))) return null;

  return task;
}

function rankTasks(tasks: TaskWithAssignees[]) {
  const today = startOfDay(new Date());
  const week = endOfDay(addDays(today, 7));

  const score = (task: TaskWithAssignees) => {
    if (task.escalatedAt) return -1;
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
    if (a.escalatedAt && b.escalatedAt) {
      return b.escalatedAt.getTime() - a.escalatedAt.getTime();
    }
    const da = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const db = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (da !== db) return da - db;
    return a.title.localeCompare(b.title);
  });
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dueDateInputValue(value: Date | string | null | undefined): string {
  const d = asDate(value);
  if (!d) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dueLabel(dueDate: Date | string | null | undefined, status: string) {
  const parsed = asDate(dueDate);
  if (!parsed || status === "done") return null;
  const today = startOfDay(new Date());
  const d = startOfDay(parsed);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return `Overdue · ${Math.abs(diff)}d`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  if (diff <= 7) return `Due in ${diff}d`;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
