"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  assertCan,
  canManageAccounts,
  canSeeDinnerTab,
  mealsEditable,
  moneyEditable,
  normalizeAccountFlags,
  timelineEditable,
} from "@/lib/access";
import {
  clearSession,
  getSession,
  hashPin,
  requireSession,
  unlockWithPin,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  applyPeerOrder,
  parsedTimeFields,
  prepareTimelineCreate,
  prepareTimelineSave,
  sortTimelineBlocks,
} from "@/lib/day-of-time";
import { resolveAssigneeIds, setTaskAssignees } from "@/lib/people";
import { sessionCanMutateTask } from "@/lib/tasks";
import { isMealGuestId, shouldDeleteMealOptionOnClear } from "@/lib/meals";
import { isStaySectionId, isStaySlotId } from "@/lib/stay";
import {
  canCompleteRequest,
  canDeclineRequest,
  canDeleteRequest,
  canEditRequest,
  canReopenRequest,
  canViewRequest,
} from "@/lib/requests";

export type UnlockState = { error?: string };
export type TaskFormState = { error?: string };

export async function unlockAction(
  _prev: UnlockState,
  formData: FormData,
): Promise<UnlockState> {
  const pin = String(formData.get("pin") || "").trim();
  if (!/^\d{4,8}$/.test(pin)) {
    return { error: "Enter a 4–8 digit PIN" };
  }
  const account = await unlockWithPin(pin);
  if (!account) {
    return { error: "Incorrect PIN" };
  }
  redirect("/today");
}

export async function lockAction() {
  await clearSession();
  redirect("/");
}

export async function toggleTaskDone(taskId: string) {
  const session = await getSession();
  if (!session?.canSeeTasks) return;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignees: true, children: { include: { assignees: true } } },
  });
  if (!task) return;
  if (!(await sessionCanMutateTask(session, task))) return;

  const done = task.status === "done";
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: done ? "todo" : "done",
      completedAt: done ? null : new Date(),
    },
  });

  revalidatePath("/today");
  revalidatePath("/people");
  revalidatePath(`/work/${task.parentId || task.id}`);
}

export async function toggleTaskEscalation(taskId: string) {
  const session = await getSession();
  if (!session?.canSeeTasks) return;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignees: true, children: { include: { assignees: true } } },
  });
  if (!task || task.parentId) return;
  if (!(await sessionCanMutateTask(session, task))) return;

  const escalated = Boolean(task.escalatedAt);
  await prisma.task.update({
    where: { id: taskId },
    data: escalated
      ? { escalatedAt: null, escalatedBy: null }
      : { escalatedAt: new Date(), escalatedBy: session.name },
  });

  revalidatePath("/today");
  revalidatePath("/people");
  revalidatePath(`/work/${taskId}`);
}

export async function saveTaskWorkspace(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const session = await getSession();
  if (!session) redirect("/");
  if (!session.canSeeTasks) {
    return { error: "This PIN can't edit tasks." };
  }

  const id = String(formData.get("id") || "");
  const planNotes = String(formData.get("planNotes") || "");
  const summary = String(formData.get("summary") || "");
  const amountNeededRaw = String(formData.get("amountNeeded") || "").trim();
  const amountSpentRaw = String(formData.get("amountSpent") || "").trim();
  const dueDateRaw = String(formData.get("dueDate") || "").trim();
  const markDone = formData.get("markDone") === "on";
  const assigneeIds = formData.getAll("assignees").map(String).filter(Boolean);
  const newPerson = String(formData.get("newPerson") || "").trim();

  const task = await prisma.task.findUnique({
    where: { id },
    include: { assignees: true, children: { include: { assignees: true } } },
  });
  if (!task || task.parentId) {
    return { error: "That task is gone." };
  }
  if (!(await sessionCanMutateTask(session, task))) {
    return { error: "You can only save tasks assigned to you." };
  }

  const amountNeeded =
    amountNeededRaw === "" ? null : Number.parseFloat(amountNeededRaw.replace(/[$,]/g, ""));
  const amountSpent =
    amountSpentRaw === "" ? 0 : Number.parseFloat(amountSpentRaw.replace(/[$,]/g, ""));

  // Only masters (or unscoped accounts) can reassign / add new people
  const canManageOwners = session.isMaster || !session.assigneeFilter?.length;

  try {
    await prisma.task.update({
      where: { id },
      data: {
        planNotes,
        summary: summary || task.summary,
        dueDate: parseDueDate(dueDateRaw),
        amountNeeded: Number.isFinite(amountNeeded as number) ? amountNeeded : null,
        amountSpent: Number.isFinite(amountSpent) ? amountSpent : 0,
        status: markDone ? "done" : task.status === "done" ? "todo" : task.status,
        completedAt: markDone ? new Date() : null,
      },
    });

    if (canManageOwners) {
      const people = await resolveAssigneeIds(assigneeIds, newPerson || null, {
        fallback: task.assignees.map((a) => a.personId),
      });
      if (people.length > 0) {
        await setTaskAssignees(id, people);
      }
    }
  } catch (err) {
    console.error(err);
    return { error: "Couldn't save that task. Try again." };
  }

  revalidatePath("/today");
  revalidatePath("/people");
  revalidatePath(`/work/${id}`);
  revalidatePath("/money");
  revalidatePath("/calendar");
  redirect("/today");
}

export async function createTaskPackage(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const session = await getSession();
  if (!session) redirect("/");
  if (!session.canSeeTasks) {
    return { error: "This PIN can't add tasks." };
  }

  const title = String(formData.get("title") || "").trim();
  const summary = String(formData.get("summary") || "").trim();
  const planNotes = String(formData.get("planNotes") || "").trim();
  const dueDateRaw = String(formData.get("dueDate") || "").trim();
  const assigneeIds = formData.getAll("assignees").map(String).filter(Boolean);
  const newPerson = String(formData.get("newPerson") || "").trim();

  if (!title) return { error: "Add a title." };

  const canManageOwners = session.isMaster || !session.assigneeFilter?.length;
  let taskId: string;
  try {
    const people = await resolveAssigneeIds(
      assigneeIds,
      canManageOwners ? newPerson || null : null,
      {
        restrictTo: session.assigneeFilter,
        fallback: session.assigneeFilter?.length ? session.assigneeFilter : ["david", "haley"],
      },
    );

    const last = await prisma.task.findFirst({
      where: { parentId: null },
      orderBy: { sortOrder: "desc" },
    });

    const task = await prisma.task.create({
      data: {
        title,
        summary:
          summary ||
          "Open this card to write the decision, money needed, money spent, and mark it done when finished.",
        planNotes,
        dueDate: parseDueDate(dueDateRaw),
        status: "todo",
        sortOrder: (last?.sortOrder ?? -1) + 1,
        amountSpent: 0,
      },
    });

    await setTaskAssignees(task.id, people);
    const assigned = await prisma.taskAssignee.count({ where: { taskId: task.id } });
    if (people.length > 0 && assigned === 0) {
      await prisma.task.delete({ where: { id: task.id } });
      return { error: "Couldn't assign that owner. Try again." };
    }
    taskId = task.id;
  } catch (err) {
    console.error(err);
    return { error: "Couldn't create that task. Try again." };
  }

  revalidatePath("/today");
  revalidatePath("/people");
  revalidatePath("/calendar");
  redirect(`/work/${taskId}`);
}

export async function saveStepNotes(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session?.canSeeTasks) return;

  const id = String(formData.get("id") || "");
  const planNotes = String(formData.get("planNotes") || "");

  const step = await prisma.task.findUnique({
    where: { id },
    include: { assignees: true },
  });
  if (!step) return;
  if (!(await sessionCanMutateTask(session, step))) return;

  await prisma.task.update({
    where: { id },
    data: { planNotes },
  });

  revalidatePath(`/work/${step.parentId || step.id}`);
  revalidatePath("/today");
}

function parseBudgetPersonId(raw: string): string | null {
  if (raw === "david" || raw === "haley") return raw;
  return null;
}

function assertBudgetPersonId(id: string | null): asserts id is string | null {
  if (id !== null && id !== "david" && id !== "haley") {
    throw new Error("INVALID_PERSON");
  }
}

export async function setBudgetOwner(budgetItemId: string, ownerId: string | null) {
  const session = await requireSession();
  if (!session.canSeeBudget || !moneyEditable(session)) throw new Error("FORBIDDEN");

  assertBudgetPersonId(ownerId);

  await prisma.budgetItem.update({
    where: { id: budgetItemId },
    data: { ownerId },
  });

  revalidatePath("/money");
  revalidatePath("/money/print");
}

function parseMoney(raw: string) {
  if (!raw.trim()) return null;
  const n = Number.parseFloat(raw.replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function clampMoney(n: number) {
  return Math.max(0, n);
}

function parseDueDate(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const d = new Date(`${trimmed}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function setBudgetPayByDate(itemId: string, dateRaw: string) {
  const session = await requireSession();
  if (!session.canSeeBudget || !moneyEditable(session)) throw new Error("FORBIDDEN");

  await prisma.budgetItem.update({
    where: { id: itemId },
    data: { payByDate: parseDueDate(dateRaw) },
  });

  revalidatePath("/money");
  revalidatePath("/money/print");
}

export async function setBudgetPaidBy(itemId: string, paidById: string | null) {
  const session = await requireSession();
  if (!session.canSeeBudget || !moneyEditable(session)) throw new Error("FORBIDDEN");

  assertBudgetPersonId(paidById);

  await prisma.budgetItem.update({
    where: { id: itemId },
    data: { paidById },
  });

  revalidatePath("/money");
  revalidatePath("/money/print");
}

export async function saveBudgetItem(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session.canSeeBudget || !moneyEditable(session)) throw new Error("FORBIDDEN");

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const price = clampMoney(parseMoney(String(formData.get("price") || "")) ?? 0);
  const amountPaid = clampMoney(parseMoney(String(formData.get("amountPaid") || "")) ?? 0);
  const note = String(formData.get("note") || "").trim();
  const ownerId = parseBudgetPersonId(String(formData.get("ownerId") || ""));
  const paidById = parseBudgetPersonId(String(formData.get("paidById") || ""));
  const payByDate = parseDueDate(String(formData.get("payByDate") || ""));

  if (!id || !name) return;

  await prisma.budgetItem.update({
    where: { id },
    data: {
      name,
      price,
      amountPaid,
      note: note || null,
      ownerId,
      paidById,
      payByDate,
    },
  });

  revalidatePath("/money");
  revalidatePath("/money/print");
}

export async function createBudgetItem(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session.canSeeBudget || !moneyEditable(session)) throw new Error("FORBIDDEN");

  const name = String(formData.get("name") || "").trim();
  const price = clampMoney(parseMoney(String(formData.get("price") || "")) ?? 0);
  const amountPaid = clampMoney(parseMoney(String(formData.get("amountPaid") || "")) ?? 0);
  const note = String(formData.get("note") || "").trim();
  const ownerId = parseBudgetPersonId(String(formData.get("ownerId") || ""));
  const paidById = parseBudgetPersonId(String(formData.get("paidById") || ""));
  const payByDate = parseDueDate(String(formData.get("payByDate") || ""));
  if (!name) return;

  const last = await prisma.budgetItem.findFirst({ orderBy: { sortOrder: "desc" } });
  await prisma.budgetItem.create({
    data: {
      name,
      price,
      amountPaid,
      note: note || null,
      ownerId,
      paidById,
      payByDate,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  revalidatePath("/money");
  revalidatePath("/money/print");
}

export async function deleteBudgetItem(id: string): Promise<void> {
  const session = await requireSession();
  if (!session.canSeeBudget || !moneyEditable(session)) throw new Error("FORBIDDEN");

  await prisma.task.updateMany({ where: { budgetItemId: id }, data: { budgetItemId: null } });
  await prisma.budgetItem.delete({ where: { id } });
  revalidatePath("/money");
  revalidatePath("/money/print");
  revalidatePath("/today");
}

export async function saveMinorExpense(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session.canSeeBudget || !moneyEditable(session)) throw new Error("FORBIDDEN");

  const id = String(formData.get("id") || "");
  const amountNeeded = parseMoney(String(formData.get("amountNeeded") || ""));
  const amountSpent = parseMoney(String(formData.get("amountSpent") || "")) ?? 0;
  const planNotes = String(formData.get("planNotes") || "");

  if (!id) return;

  await prisma.task.update({
    where: { id },
    data: {
      amountNeeded,
      amountSpent,
      planNotes,
    },
  });

  revalidatePath("/money");
  revalidatePath("/money/print");
  revalidatePath(`/work/${id}`);
  revalidatePath("/today");
}

function parseLinkedPersonId(raw: string): string | null {
  const value = raw.trim();
  return value ? value : null;
}

function parseAccountFlags(formData: FormData) {
  const raw = {
    canSeeTasks: formData.get("canSeeTasks") === "on",
    canSeeBudget: formData.get("canSeeBudget") === "on",
    canSeeGuests: formData.get("canSeeGuests") === "on",
    canSeeTimeline: formData.get("canSeeTimeline") === "on",
    canManageAccounts: formData.get("canManageAccounts") === "on",
    canSeeShop: formData.get("canSeeShop") === "on",
    canSeeCalendar: formData.get("canSeeCalendar") === "on",
    canSeePeople: formData.get("canSeePeople") === "on",
    canSeeRequests: formData.get("canSeeRequests") === "on",
    canSeeDinner: formData.get("canSeeDinner") === "on",
    canEditBudget: formData.get("canEditBudget") === "on",
    canEditTimeline: formData.get("canEditTimeline") === "on",
    linkedPersonId: parseLinkedPersonId(String(formData.get("linkedPersonId") || "")),
    assigneeFilter: formData.getAll("assigneeFilter").map(String).filter(Boolean),
    sharedBudgetItemIds: formData.getAll("sharedBudgetItemIds").map(String).filter(Boolean),
    sharedTaskIds: formData.getAll("sharedTaskIds").map(String).filter(Boolean),
  };
  return {
    ...normalizeAccountFlags(raw),
    linkedPersonId: raw.linkedPersonId,
    assigneeFilter: raw.assigneeFilter,
    sharedBudgetItemIds: raw.sharedBudgetItemIds,
    sharedTaskIds: raw.sharedTaskIds,
  };
}

/** Account-scoped share sync — does not wipe other accounts' item shares. */
async function syncAccountShares(args: {
  pinAccountId: string;
  sharedBudgetItemIds: string[];
  sharedTaskIds: string[];
}): Promise<void> {
  const wantedBudget = [...new Set(args.sharedBudgetItemIds.filter(Boolean))];
  const wantedTasks = [...new Set(args.sharedTaskIds.filter(Boolean))];

  if (wantedBudget.length) {
    const found = await prisma.budgetItem.count({ where: { id: { in: wantedBudget } } });
    if (found !== wantedBudget.length) throw new Error("INVALID_BUDGET_SHARE");
  }
  if (wantedTasks.length) {
    const found = await prisma.task.count({
      where: { id: { in: wantedTasks }, parentId: null },
    });
    if (found !== wantedTasks.length) throw new Error("INVALID_TASK_SHARE");
  }

  await prisma.$transaction(async (tx) => {
    await tx.budgetItemShare.deleteMany({
      where: wantedBudget.length
        ? { pinAccountId: args.pinAccountId, budgetItemId: { notIn: wantedBudget } }
        : { pinAccountId: args.pinAccountId },
    });
    if (wantedBudget.length) {
      await tx.budgetItemShare.createMany({
        data: wantedBudget.map((budgetItemId) => ({
          budgetItemId,
          pinAccountId: args.pinAccountId,
        })),
        skipDuplicates: true,
      });
    }

    await tx.taskShare.deleteMany({
      where: wantedTasks.length
        ? { pinAccountId: args.pinAccountId, taskId: { notIn: wantedTasks } }
        : { pinAccountId: args.pinAccountId },
    });
    if (wantedTasks.length) {
      await tx.taskShare.createMany({
        data: wantedTasks.map((taskId) => ({
          taskId,
          pinAccountId: args.pinAccountId,
        })),
        skipDuplicates: true,
      });
    }
  });

  revalidatePath("/money");
  revalidatePath("/today");
  revalidatePath("/people");
  revalidatePath("/accounts");
}

export async function createPinAccount(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!canManageAccounts(session)) throw new Error("FORBIDDEN");

  const name = String(formData.get("name") || "").trim();
  const pin = String(formData.get("pin") || "").trim();
  const flags = parseAccountFlags(formData);

  if (!name) throw new Error("Name is required");
  if (!/^\d{4,8}$/.test(pin)) throw new Error("PIN must be 4–8 digits");

  if (flags.linkedPersonId) {
    const person = await prisma.person.findUnique({ where: { id: flags.linkedPersonId } });
    if (!person) throw new Error("Linked person was not found");
  }

  const created = await prisma.pinAccount.create({
    data: {
      name,
      pinHash: await hashPin(pin),
      isMaster: false,
      canSeeTasks: flags.canSeeTasks,
      canSeeBudget: flags.canSeeBudget,
      canSeeGuests: flags.canSeeGuests,
      canSeeTimeline: flags.canSeeTimeline,
      canManageAccounts: flags.canManageAccounts,
      canSeeShop: flags.canSeeShop,
      canSeeCalendar: flags.canSeeCalendar,
      canSeePeople: flags.canSeePeople,
      canSeeRequests: flags.canSeeRequests,
      canSeeDinner: flags.canSeeDinner,
      canEditBudget: flags.canEditBudget,
      canEditTimeline: flags.canEditTimeline,
      linkedPersonId: flags.linkedPersonId,
      assigneeFilterJson: flags.assigneeFilter.length
        ? JSON.stringify(flags.assigneeFilter)
        : null,
    },
  });

  await syncAccountShares({
    pinAccountId: created.id,
    sharedBudgetItemIds: flags.sharedBudgetItemIds,
    sharedTaskIds: flags.sharedTaskIds,
  });

  revalidatePath("/accounts");
  revalidatePath("/", "layout");
}

export async function updatePinAccount(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!canManageAccounts(session)) throw new Error("FORBIDDEN");

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const pin = String(formData.get("pin") || "").trim();
  const flags = parseAccountFlags(formData);

  const existing = await prisma.pinAccount.findUnique({ where: { id } });
  if (!existing) throw new Error("Account not found");
  if (!name) throw new Error("Name is required");
  if (pin && !/^\d{4,8}$/.test(pin)) throw new Error("PIN must be 4–8 digits");

  // Masters keep full privileges; only name / PIN / linked person can change.
  if (existing.isMaster) {
    await prisma.pinAccount.update({
      where: { id },
      data: {
        name,
        linkedPersonId: flags.linkedPersonId,
        ...(pin ? { pinHash: await hashPin(pin) } : {}),
      },
    });
    revalidatePath("/accounts");
    revalidatePath("/", "layout");
    return;
  }

  if (flags.linkedPersonId) {
    const person = await prisma.person.findUnique({ where: { id: flags.linkedPersonId } });
    if (!person) throw new Error("Linked person was not found");
  }

  await prisma.pinAccount.update({
    where: { id },
    data: {
      name,
      ...(pin ? { pinHash: await hashPin(pin) } : {}),
      canSeeTasks: flags.canSeeTasks,
      canSeeBudget: flags.canSeeBudget,
      canSeeGuests: flags.canSeeGuests,
      canSeeTimeline: flags.canSeeTimeline,
      canManageAccounts: flags.canManageAccounts,
      canSeeShop: flags.canSeeShop,
      canSeeCalendar: flags.canSeeCalendar,
      canSeePeople: flags.canSeePeople,
      canSeeRequests: flags.canSeeRequests,
      canSeeDinner: flags.canSeeDinner,
      canEditBudget: flags.canEditBudget,
      canEditTimeline: flags.canEditTimeline,
      linkedPersonId: flags.linkedPersonId,
      assigneeFilterJson: flags.assigneeFilter.length
        ? JSON.stringify(flags.assigneeFilter)
        : null,
    },
  });

  await syncAccountShares({
    pinAccountId: id,
    sharedBudgetItemIds: flags.sharedBudgetItemIds,
    sharedTaskIds: flags.sharedTaskIds,
  });

  revalidatePath("/accounts");
  revalidatePath("/", "layout");
}

export async function deletePinAccount(accountId: string) {
  const session = await requireSession();
  if (!canManageAccounts(session)) throw new Error("FORBIDDEN");

  const existing = await prisma.pinAccount.findUnique({ where: { id: accountId } });
  if (!existing || existing.isMaster) throw new Error("FORBIDDEN");

  await prisma.pinAccount.delete({ where: { id: accountId } });
  revalidatePath("/accounts");
  revalidatePath("/", "layout");
}

export async function setBudgetItemShares(budgetItemId: string, pinAccountIds: string[]) {
  const session = await requireSession();
  if (!session.canSeeBudget || !moneyEditable(session)) throw new Error("FORBIDDEN");

  const item = await prisma.budgetItem.findUnique({ where: { id: budgetItemId }, select: { id: true } });
  if (!item) throw new Error("NOT_FOUND");

  const uniqueIds = [...new Set(pinAccountIds.filter(Boolean))];
  if (uniqueIds.length) {
    const accounts = await prisma.pinAccount.findMany({
      where: { id: { in: uniqueIds }, isMaster: false },
      select: { id: true },
    });
    if (accounts.length !== uniqueIds.length) throw new Error("INVALID_ACCOUNT");
  }

  await prisma.$transaction([
    prisma.budgetItemShare.deleteMany({ where: { budgetItemId } }),
    ...(uniqueIds.length
      ? [
          prisma.budgetItemShare.createMany({
            data: uniqueIds.map((pinAccountId) => ({ budgetItemId, pinAccountId })),
          }),
        ]
      : []),
  ]);

  revalidatePath("/money");
  revalidatePath("/money/print");
}

export async function setTaskShares(taskId: string, pinAccountIds: string[]) {
  const session = await getSession();
  if (!session?.canSeeTasks) return;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignees: true, children: { include: { assignees: true } } },
  });
  if (!task || task.parentId) return;
  if (!(await sessionCanMutateTask(session, task))) return;

  const uniqueIds = [...new Set(pinAccountIds.filter(Boolean))];
  if (uniqueIds.length) {
    const accounts = await prisma.pinAccount.findMany({
      where: { id: { in: uniqueIds }, isMaster: false },
      select: { id: true },
    });
    if (accounts.length !== uniqueIds.length) throw new Error("INVALID_ACCOUNT");
  }

  await prisma.$transaction([
    prisma.taskShare.deleteMany({ where: { taskId } }),
    ...(uniqueIds.length
      ? [
          prisma.taskShare.createMany({
            data: uniqueIds.map((pinAccountId) => ({ taskId, pinAccountId })),
          }),
        ]
      : []),
  ]);

  revalidatePath("/today");
  revalidatePath("/people");
  revalidatePath(`/work/${taskId}`);
}

function revalidateRequests() {
  revalidatePath("/requests");
  revalidatePath("/", "layout");
}

export async function createRequest(formData: FormData): Promise<void> {
  const session = await requireSession();
  assertCan(session, "canSeeRequests");

  const title = String(formData.get("title") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const recipientAccountId = String(formData.get("recipientAccountId") || "").trim();
  const taskIdRaw = String(formData.get("taskId") || "").trim();

  if (!title || !recipientAccountId) return;
  if (recipientAccountId === session.id) throw new Error("INVALID_RECIPIENT");

  const recipient = await prisma.pinAccount.findUnique({
    where: { id: recipientAccountId },
    select: { id: true },
  });
  if (!recipient) throw new Error("NOT_FOUND");

  let taskId: string | null = null;
  if (taskIdRaw) {
    const task = await prisma.task.findFirst({
      where: { id: taskIdRaw, parentId: null },
      select: { id: true },
    });
    if (!task) throw new Error("NOT_FOUND");
    taskId = task.id;
  }

  await prisma.request.create({
    data: {
      title,
      note: note || null,
      status: "open",
      senderAccountId: session.id,
      recipientAccountId,
      taskId,
    },
  });

  revalidateRequests();
}

export async function saveRequest(formData: FormData): Promise<void> {
  const session = await requireSession();
  assertCan(session, "canSeeRequests");

  const id = String(formData.get("id") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const taskIdRaw = String(formData.get("taskId") || "").trim();

  if (!id || !title) return;

  const row = await prisma.request.findUnique({ where: { id } });
  if (!row || !canViewRequest(session, row) || !canEditRequest(session, row)) {
    throw new Error("FORBIDDEN");
  }

  let taskId: string | null = null;
  if (taskIdRaw) {
    const task = await prisma.task.findFirst({
      where: { id: taskIdRaw, parentId: null },
      select: { id: true },
    });
    if (!task) throw new Error("NOT_FOUND");
    taskId = task.id;
  }

  await prisma.request.update({
    where: { id },
    data: {
      title,
      note: note || null,
      taskId,
    },
  });

  revalidateRequests();
}

export async function markRequestRead(requestId: string): Promise<void> {
  const session = await requireSession();
  assertCan(session, "canSeeRequests");

  const row = await prisma.request.findUnique({ where: { id: requestId } });
  if (!row || !canViewRequest(session, row)) throw new Error("FORBIDDEN");
  if (row.recipientAccountId !== session.id) throw new Error("FORBIDDEN");
  if (row.readAt) return;

  await prisma.request.update({
    where: { id: requestId },
    data: { readAt: new Date() },
  });

  revalidateRequests();
}

export async function completeRequest(requestId: string): Promise<void> {
  const session = await requireSession();
  assertCan(session, "canSeeRequests");

  const row = await prisma.request.findUnique({ where: { id: requestId } });
  if (!row || !canViewRequest(session, row) || !canCompleteRequest(session, row)) {
    throw new Error("FORBIDDEN");
  }

  await prisma.request.update({
    where: { id: requestId },
    data: {
      status: "done",
      completedAt: new Date(),
      declinedAt: null,
      declineNote: null,
      readAt: row.readAt ?? new Date(),
    },
  });

  revalidateRequests();
}

export async function declineRequest(formData: FormData): Promise<void> {
  const session = await requireSession();
  assertCan(session, "canSeeRequests");

  const id = String(formData.get("id") || "").trim();
  const declineNote = String(formData.get("declineNote") || "").trim();
  if (!id) return;

  const row = await prisma.request.findUnique({ where: { id } });
  if (!row || !canViewRequest(session, row) || !canDeclineRequest(session, row)) {
    throw new Error("FORBIDDEN");
  }

  await prisma.request.update({
    where: { id },
    data: {
      status: "declined",
      declinedAt: new Date(),
      declineNote: declineNote || null,
      completedAt: null,
      readAt: row.readAt ?? new Date(),
    },
  });

  revalidateRequests();
}

export async function reopenRequest(requestId: string): Promise<void> {
  const session = await requireSession();
  assertCan(session, "canSeeRequests");

  const row = await prisma.request.findUnique({ where: { id: requestId } });
  if (!row || !canViewRequest(session, row) || !canReopenRequest(session, row)) {
    throw new Error("FORBIDDEN");
  }

  await prisma.request.update({
    where: { id: requestId },
    data: {
      status: "open",
      completedAt: null,
      declinedAt: null,
      declineNote: null,
      readAt: null,
    },
  });

  revalidateRequests();
}

export async function deleteRequest(requestId: string): Promise<void> {
  const session = await requireSession();
  assertCan(session, "canSeeRequests");

  const row = await prisma.request.findUnique({ where: { id: requestId } });
  if (!row || !canViewRequest(session, row) || !canDeleteRequest(session, row)) {
    throw new Error("FORBIDDEN");
  }

  await prisma.request.delete({ where: { id: requestId } });
  revalidateRequests();
}

export type TimelineWriteResult =
  | { ok: true; id: string; order: string[] }
  | { ok: false; reason: "forbidden" | "not_found" | "empty_notes" | "invalid" | "noop" };

async function requireTimelineEditor() {
  try {
    const session = await requireSession();
    if (!timelineEditable(session)) return null;
    return session;
  } catch {
    return null;
  }
}

async function resequenceTimeline(): Promise<string[]> {
  const blocks = await prisma.timelineBlock.findMany();
  const sorted = sortTimelineBlocks(blocks);
  await prisma.$transaction(
    sorted.map((block, index) =>
      prisma.timelineBlock.update({
        where: { id: block.id },
        data: {
          sortOrder: index,
          ...parsedTimeFields(block.startAt, block.endAt),
        },
      }),
    ),
  );
  return sorted.map((block) => block.id);
}

export async function saveTimelineBlock(input: {
  id: string;
  startAt: string;
  endAt: string;
  notes: string;
}): Promise<TimelineWriteResult> {
  if (!(await requireTimelineEditor())) return { ok: false, reason: "forbidden" };

  const id = input.id.trim();
  if (!id) return { ok: false, reason: "invalid" };

  const existing = await prisma.timelineBlock.findUnique({ where: { id } });
  if (!existing) return { ok: false, reason: "not_found" };

  const prepared = prepareTimelineSave(
    { startAt: input.startAt, endAt: input.endAt, notes: input.notes },
    {
      startAt: existing.startAt,
      endAt: existing.endAt ?? "",
      notes: existing.notes,
    },
  );

  if (!prepared.ok) {
    return { ok: false, reason: prepared.reason === "empty_notes" ? "empty_notes" : "noop" };
  }

  await prisma.timelineBlock.update({
    where: { id },
    data: {
      startAt: prepared.startAt,
      endAt: prepared.endAt,
      notes: prepared.notes,
      ...parsedTimeFields(prepared.startAt, prepared.endAt),
    },
  });

  const order = await resequenceTimeline();
  return { ok: true, id, order };
}

export async function createTimelineBlock(input: {
  startAt: string;
  endAt: string;
  notes: string;
}): Promise<TimelineWriteResult> {
  if (!(await requireTimelineEditor())) return { ok: false, reason: "forbidden" };

  const prepared = prepareTimelineCreate({
    startAt: input.startAt,
    endAt: input.endAt,
    notes: input.notes,
  });
  if (!prepared.ok) return { ok: false, reason: "invalid" };

  const created = await prisma.timelineBlock.create({
    data: {
      startAt: prepared.startAt,
      endAt: prepared.endAt,
      notes: prepared.notes,
      sortOrder: 9999,
      ...parsedTimeFields(prepared.startAt, prepared.endAt),
    },
  });

  const order = await resequenceTimeline();
  revalidatePath("/day");
  return { ok: true, id: created.id, order };
}

export async function deleteTimelineBlock(blockId: string): Promise<TimelineWriteResult> {
  if (!(await requireTimelineEditor())) return { ok: false, reason: "forbidden" };

  try {
    await prisma.timelineBlock.delete({ where: { id: blockId } });
  } catch {
    return { ok: false, reason: "not_found" };
  }

  const order = await resequenceTimeline();
  revalidatePath("/day");
  return { ok: true, id: blockId, order };
}

export async function saveTimelinePeerOrder(orderedPeerIds: string[]): Promise<TimelineWriteResult> {
  if (!(await requireTimelineEditor())) return { ok: false, reason: "forbidden" };
  if (orderedPeerIds.length < 2) return { ok: false, reason: "invalid" };

  const blocks = sortTimelineBlocks(await prisma.timelineBlock.findMany());
  const next = applyPeerOrder(blocks, orderedPeerIds);
  if (!next) return { ok: false, reason: "invalid" };

  await prisma.$transaction(
    next.map((block, index) =>
      prisma.timelineBlock.update({
        where: { id: block.id },
        data: { sortOrder: index },
      }),
    ),
  );

  return { ok: true, id: orderedPeerIds[0], order: next.map((block) => block.id) };
}

export async function saveGuest(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session.canSeeGuests) throw new Error("FORBIDDEN");

  const id = String(formData.get("id") || "");
  const nameLine1 = String(formData.get("nameLine1") || "").trim();
  const nameLine2Raw = String(formData.get("nameLine2") || "").trim();
  const person1TableNumberRaw = String(formData.get("person1TableNumber") || "").trim();
  const person1TableSpot = String(formData.get("person1TableSpot") || "").trim();
  const person2TableNumberRaw = String(formData.get("person2TableNumber") || "").trim();
  const person2TableSpot = String(formData.get("person2TableSpot") || "").trim();

  if (!id || !nameLine1) return;

  const parseTableNumber = (raw: string) => {
    if (!raw) return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  };

  await prisma.guest.update({
    where: { id },
    data: {
      nameLine1,
      nameLine2: nameLine2Raw || null,
      person1TableNumber: parseTableNumber(person1TableNumberRaw),
      person1TableSpot: person1TableSpot || null,
      person2TableNumber: parseTableNumber(person2TableNumberRaw),
      person2TableSpot: person2TableSpot || null,
    },
  });

  revalidatePath("/guests");
}

function parseShoppingOwnerId(raw: string): string | null {
  return raw === "david" || raw === "haley" ? raw : null;
}

async function resolveShoppingTaskId(raw: string): Promise<string | null> {
  if (!raw) return null;
  const task = await prisma.task.findFirst({
    where: { id: raw, parentId: null },
    select: { id: true },
  });
  return task?.id ?? null;
}

export async function createShoppingItem(formData: FormData): Promise<void> {
  const session = await requireSession();
  assertCan(session, "canSeeShop");

  const name = String(formData.get("name") || "").trim();
  const quantity = String(formData.get("quantity") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const ownerId = parseShoppingOwnerId(String(formData.get("ownerId") || ""));
  const taskId = await resolveShoppingTaskId(String(formData.get("taskId") || "").trim());

  if (!name) return;

  const last = await prisma.shoppingItem.findFirst({ orderBy: { sortOrder: "desc" } });
  await prisma.shoppingItem.create({
    data: {
      name,
      quantity: quantity || null,
      note: note || null,
      ownerId,
      taskId,
      purchased: false,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  revalidatePath("/shop");
}

export async function saveShoppingItem(formData: FormData): Promise<void> {
  const session = await requireSession();
  assertCan(session, "canSeeShop");

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const quantity = String(formData.get("quantity") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const ownerId = parseShoppingOwnerId(String(formData.get("ownerId") || ""));
  const taskId = await resolveShoppingTaskId(String(formData.get("taskId") || "").trim());
  const purchased = formData.get("purchased") === "on";

  if (!id || !name) return;

  await prisma.shoppingItem.update({
    where: { id },
    data: {
      name,
      quantity: quantity || null,
      note: note || null,
      ownerId,
      taskId,
      purchased,
    },
  });

  revalidatePath("/shop");
}

export async function toggleShoppingPurchased(itemId: string): Promise<void> {
  const session = await requireSession();
  assertCan(session, "canSeeShop");

  const item = await prisma.shoppingItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error("NOT_FOUND");

  await prisma.shoppingItem.update({
    where: { id: itemId },
    data: { purchased: !item.purchased },
  });

  revalidatePath("/shop");
}

export async function deleteShoppingItem(itemId: string): Promise<void> {
  const session = await requireSession();
  assertCan(session, "canSeeShop");

  await prisma.shoppingItem.delete({ where: { id: itemId } });
  revalidatePath("/shop");
}

export type StayWriteResult =
  | { ok: true; id: string }
  | { ok: false; reason: "forbidden" | "not_found" | "invalid" };

export async function saveStayOccupant(slotId: string, occupant: string): Promise<StayWriteResult> {
  try {
    await requireSession();
  } catch {
    return { ok: false, reason: "forbidden" };
  }
  if (!isStaySlotId(slotId)) return { ok: false, reason: "invalid" };

  const existing = await prisma.staySlot.findUnique({ where: { id: slotId } });
  if (!existing) return { ok: false, reason: "not_found" };

  await prisma.staySlot.update({
    where: { id: slotId },
    data: { occupant: occupant.trim() },
  });
  return { ok: true, id: slotId };
}

export async function addStayBathNote(sectionId: string): Promise<StayWriteResult> {
  try {
    await requireSession();
  } catch {
    return { ok: false, reason: "forbidden" };
  }
  if (!isStaySectionId(sectionId)) return { ok: false, reason: "invalid" };

  const last = await prisma.stayBathNote.findFirst({
    where: { sectionId },
    orderBy: { sortOrder: "desc" },
  });
  const created = await prisma.stayBathNote.create({
    data: {
      sectionId,
      note: "",
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  return { ok: true, id: created.id };
}

export async function saveStayBathNote(noteId: string, note: string): Promise<StayWriteResult> {
  try {
    await requireSession();
  } catch {
    return { ok: false, reason: "forbidden" };
  }

  const existing = await prisma.stayBathNote.findUnique({ where: { id: noteId } });
  if (!existing) return { ok: false, reason: "not_found" };

  const trimmed = note.trim();
  if (!trimmed) {
    await prisma.stayBathNote.delete({ where: { id: noteId } });
    return { ok: true, id: noteId };
  }

  await prisma.stayBathNote.update({
    where: { id: noteId },
    data: { note: trimmed },
  });
  return { ok: true, id: noteId };
}

export async function deleteStayBathNote(noteId: string): Promise<StayWriteResult> {
  try {
    await requireSession();
  } catch {
    return { ok: false, reason: "forbidden" };
  }

  try {
    await prisma.stayBathNote.delete({ where: { id: noteId } });
  } catch {
    return { ok: false, reason: "not_found" };
  }
  return { ok: true, id: noteId };
}

export type MealWriteResult =
  | { ok: true; id: string }
  | { ok: false; reason: "forbidden" | "not_found" | "invalid" };

async function requireMealEditor() {
  try {
    const session = await requireSession();
    if (!mealsEditable(session)) return null;
    return session;
  } catch {
    return null;
  }
}

function revalidateDinner(opts?: { layout?: boolean }) {
  revalidatePath("/dinner");
  if (opts?.layout) revalidatePath("/", "layout");
}

export async function addMealOption(): Promise<MealWriteResult> {
  if (!(await requireMealEditor())) return { ok: false, reason: "forbidden" };

  const last = await prisma.mealOption.findFirst({ orderBy: { sortOrder: "desc" } });
  const created = await prisma.mealOption.create({
    data: {
      label: "",
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  return { ok: true, id: created.id };
}

export async function saveMealOption(optionId: string, label: string): Promise<MealWriteResult> {
  if (!(await requireMealEditor())) return { ok: false, reason: "forbidden" };

  const existing = await prisma.mealOption.findUnique({ where: { id: optionId } });
  if (!existing) return { ok: false, reason: "not_found" };

  const trimmed = label.trim();
  if (!trimmed) {
    if (!shouldDeleteMealOptionOnClear(existing.label, trimmed)) {
      return { ok: false, reason: "invalid" };
    }
    await prisma.mealGuest.updateMany({ where: { optionId }, data: { optionId: null } });
    await prisma.mealOption.delete({ where: { id: optionId } });
    return { ok: true, id: optionId };
  }

  await prisma.mealOption.update({
    where: { id: optionId },
    data: { label: trimmed },
  });
  return { ok: true, id: optionId };
}

export async function deleteMealOption(optionId: string): Promise<MealWriteResult> {
  if (!(await requireMealEditor())) return { ok: false, reason: "forbidden" };

  try {
    await prisma.mealGuest.updateMany({ where: { optionId }, data: { optionId: null } });
    await prisma.mealOption.delete({ where: { id: optionId } });
  } catch {
    return { ok: false, reason: "not_found" };
  }
  return { ok: true, id: optionId };
}

export async function setMealPublished(published: boolean): Promise<MealWriteResult> {
  if (!(await requireMealEditor())) return { ok: false, reason: "forbidden" };

  await prisma.mealSettings.upsert({
    where: { id: 1 },
    create: { id: 1, published },
    update: { published },
  });
  revalidateDinner({ layout: true });
  return { ok: true, id: "1" };
}

export async function saveMealChoice(guestId: string, optionId: string | null): Promise<MealWriteResult> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { ok: false, reason: "forbidden" };
  }
  if (!canSeeDinnerTab(session)) return { ok: false, reason: "forbidden" };
  const settings = await prisma.mealSettings.findUnique({ where: { id: 1 } });
  if (!settings?.published && !mealsEditable(session)) {
    return { ok: false, reason: "forbidden" };
  }
  if (!isMealGuestId(guestId)) return { ok: false, reason: "invalid" };

  const existing = await prisma.mealGuest.findUnique({ where: { id: guestId } });
  if (!existing) return { ok: false, reason: "not_found" };

  if (optionId) {
    const option = await prisma.mealOption.findUnique({ where: { id: optionId } });
    if (!option) return { ok: false, reason: "invalid" };
  }

  await prisma.mealGuest.update({
    where: { id: guestId },
    data: { optionId },
  });
  return { ok: true, id: guestId };
}
