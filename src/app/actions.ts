"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  clearSession,
  hashPin,
  requireSession,
  unlockWithPin,
} from "@/lib/auth";
import { resolveAssigneeIds, setTaskAssignees } from "@/lib/people";

export type UnlockState = { error?: string };

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
  const session = await requireSession();
  if (!session.canSeeTasks) throw new Error("FORBIDDEN");

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignees: true, children: { include: { assignees: true } } },
  });
  if (!task) throw new Error("NOT_FOUND");

  if (session.assigneeFilter?.length) {
    const ok =
      task.assignees.some((a) => session.assigneeFilter!.includes(a.personId)) ||
      task.children.some((c) =>
        c.assignees.some((a) => session.assigneeFilter!.includes(a.personId)),
      );
    if (!ok) throw new Error("FORBIDDEN");
  }

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
  const session = await requireSession();
  if (!session.canSeeTasks) throw new Error("FORBIDDEN");

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignees: true, children: { include: { assignees: true } } },
  });
  if (!task || task.parentId) throw new Error("NOT_FOUND");

  if (session.assigneeFilter?.length) {
    const ok =
      task.assignees.some((a) => session.assigneeFilter!.includes(a.personId)) ||
      task.children.some((c) =>
        c.assignees.some((a) => session.assigneeFilter!.includes(a.personId)),
      );
    if (!ok) throw new Error("FORBIDDEN");
  }

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

export async function saveTaskWorkspace(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session.canSeeTasks) throw new Error("FORBIDDEN");

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
  if (!task || task.parentId) throw new Error("NOT_FOUND");

  if (session.assigneeFilter?.length) {
    const ok =
      task.assignees.some((a) => session.assigneeFilter!.includes(a.personId)) ||
      task.children.some((c) =>
        c.assignees.some((a) => session.assigneeFilter!.includes(a.personId)),
      );
    if (!ok) throw new Error("FORBIDDEN");
  }

  const amountNeeded =
    amountNeededRaw === "" ? null : Number.parseFloat(amountNeededRaw.replace(/[$,]/g, ""));
  const amountSpent =
    amountSpentRaw === "" ? 0 : Number.parseFloat(amountSpentRaw.replace(/[$,]/g, ""));

  // Only masters (or unscoped accounts) can reassign / add new people
  const canManageOwners = session.isMaster || !session.assigneeFilter?.length;

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

  revalidatePath("/today");
  revalidatePath("/people");
  revalidatePath(`/work/${id}`);
  revalidatePath("/money");
  revalidatePath("/calendar");
  redirect("/today");
}

export async function createTaskPackage(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session.canSeeTasks) throw new Error("FORBIDDEN");

  const title = String(formData.get("title") || "").trim();
  const summary = String(formData.get("summary") || "").trim();
  const planNotes = String(formData.get("planNotes") || "").trim();
  const dueDateRaw = String(formData.get("dueDate") || "").trim();
  const assigneeIds = formData.getAll("assignees").map(String).filter(Boolean);
  const newPerson = String(formData.get("newPerson") || "").trim();

  if (!title) return;

  const canManageOwners = session.isMaster || !session.assigneeFilter?.length;
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

  revalidatePath("/today");
  revalidatePath("/people");
  revalidatePath("/calendar");
  redirect(`/work/${task.id}`);
}

export async function saveStepNotes(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session.canSeeTasks) throw new Error("FORBIDDEN");

  const id = String(formData.get("id") || "");
  const planNotes = String(formData.get("planNotes") || "");

  const step = await prisma.task.findUnique({
    where: { id },
    include: { assignees: true },
  });
  if (!step) throw new Error("NOT_FOUND");

  if (session.assigneeFilter?.length) {
    const ok = step.assignees.some((a) => session.assigneeFilter!.includes(a.personId));
    if (!ok && !session.isMaster) throw new Error("FORBIDDEN");
  }

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
  if (!session.canSeeBudget || !session.isMaster) throw new Error("FORBIDDEN");

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
  if (!session.canSeeBudget || !session.isMaster) throw new Error("FORBIDDEN");

  await prisma.budgetItem.update({
    where: { id: itemId },
    data: { payByDate: parseDueDate(dateRaw) },
  });

  revalidatePath("/money");
  revalidatePath("/money/print");
}

export async function setBudgetPaidBy(itemId: string, paidById: string | null) {
  const session = await requireSession();
  if (!session.canSeeBudget || !session.isMaster) throw new Error("FORBIDDEN");

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
  if (!session.canSeeBudget || !session.isMaster) throw new Error("FORBIDDEN");

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
  if (!session.canSeeBudget || !session.isMaster) throw new Error("FORBIDDEN");

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
  if (!session.canSeeBudget || !session.isMaster) throw new Error("FORBIDDEN");

  await prisma.task.updateMany({ where: { budgetItemId: id }, data: { budgetItemId: null } });
  await prisma.budgetItem.delete({ where: { id } });
  revalidatePath("/money");
  revalidatePath("/money/print");
  revalidatePath("/today");
}

export async function saveMinorExpense(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session.canSeeBudget || !session.isMaster) throw new Error("FORBIDDEN");

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

export async function createPinAccount(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session.canManageAccounts) throw new Error("FORBIDDEN");

  const name = String(formData.get("name") || "").trim();
  const pin = String(formData.get("pin") || "").trim();
  const canSeeTasks = formData.get("canSeeTasks") === "on";
  const canSeeBudget = formData.get("canSeeBudget") === "on";
  const canSeeGuests = formData.get("canSeeGuests") === "on";
  const canSeeTimeline = formData.get("canSeeTimeline") === "on";
  const assigneeFilter = formData
    .getAll("assigneeFilter")
    .map(String)
    .filter(Boolean);

  if (!name || !/^\d{4,8}$/.test(pin)) return;

  await prisma.pinAccount.create({
    data: {
      name,
      pinHash: await hashPin(pin),
      isMaster: false,
      canSeeTasks,
      canSeeBudget,
      canSeeGuests,
      canSeeTimeline,
      canManageAccounts: false,
      assigneeFilterJson: assigneeFilter.length ? JSON.stringify(assigneeFilter) : null,
    },
  });

  revalidatePath("/accounts");
}

export async function updatePinAccount(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session.canManageAccounts) throw new Error("FORBIDDEN");

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const pin = String(formData.get("pin") || "").trim();
  const canSeeTasks = formData.get("canSeeTasks") === "on";
  const canSeeBudget = formData.get("canSeeBudget") === "on";
  const canSeeGuests = formData.get("canSeeGuests") === "on";
  const canSeeTimeline = formData.get("canSeeTimeline") === "on";
  const assigneeFilter = formData
    .getAll("assigneeFilter")
    .map(String)
    .filter(Boolean);

  const existing = await prisma.pinAccount.findUnique({ where: { id } });
  if (!existing || !name) return;
  if (pin && !/^\d{4,8}$/.test(pin)) return;

  // Masters keep full privileges; only name / PIN can change.
  if (existing.isMaster) {
    await prisma.pinAccount.update({
      where: { id },
      data: {
        name,
        ...(pin ? { pinHash: await hashPin(pin) } : {}),
      },
    });
    revalidatePath("/accounts");
    return;
  }

  await prisma.pinAccount.update({
    where: { id },
    data: {
      name,
      ...(pin ? { pinHash: await hashPin(pin) } : {}),
      canSeeTasks,
      canSeeBudget,
      canSeeGuests,
      canSeeTimeline,
      assigneeFilterJson: assigneeFilter.length ? JSON.stringify(assigneeFilter) : null,
    },
  });

  revalidatePath("/accounts");
}

export async function deletePinAccount(accountId: string) {
  const session = await requireSession();
  if (!session.canManageAccounts) throw new Error("FORBIDDEN");

  const existing = await prisma.pinAccount.findUnique({ where: { id: accountId } });
  if (!existing || existing.isMaster) throw new Error("FORBIDDEN");

  await prisma.pinAccount.delete({ where: { id: accountId } });
  revalidatePath("/accounts");
}

async function requireTimelineEditor() {
  const session = await requireSession();
  if (!session.canSeeTimeline) throw new Error("FORBIDDEN");
  // Helpers with timeline can edit; masters always can
  return session;
}

export async function saveTimelineBlock(formData: FormData): Promise<void> {
  await requireTimelineEditor();

  const id = String(formData.get("id") || "");
  const startAt = String(formData.get("startAt") || "").trim();
  const endAtRaw = String(formData.get("endAt") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!id || !startAt || !notes) return;

  await prisma.timelineBlock.update({
    where: { id },
    data: {
      startAt,
      endAt: endAtRaw || null,
      notes,
    },
  });

  revalidatePath("/day");
}

export async function createTimelineBlock(formData: FormData): Promise<void> {
  await requireTimelineEditor();

  const startAt = String(formData.get("startAt") || "").trim() || "TBD";
  const endAtRaw = String(formData.get("endAt") || "").trim();
  const notes = String(formData.get("notes") || "").trim() || "New moment";

  const last = await prisma.timelineBlock.findFirst({
    orderBy: { sortOrder: "desc" },
  });

  await prisma.timelineBlock.create({
    data: {
      startAt,
      endAt: endAtRaw || null,
      notes,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  revalidatePath("/day");
}

export async function deleteTimelineBlock(blockId: string): Promise<void> {
  await requireTimelineEditor();
  await prisma.timelineBlock.delete({ where: { id: blockId } });
  revalidatePath("/day");
}

export async function moveTimelineBlock(blockId: string, direction: "up" | "down"): Promise<void> {
  await requireTimelineEditor();

  const blocks = await prisma.timelineBlock.findMany({ orderBy: { sortOrder: "asc" } });
  const index = blocks.findIndex((b) => b.id === blockId);
  if (index < 0) return;

  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= blocks.length) return;

  const a = blocks[index];
  const b = blocks[swapWith];

  await prisma.$transaction([
    prisma.timelineBlock.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
    prisma.timelineBlock.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
  ]);

  revalidatePath("/day");
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
  if (!session.canSeeTasks) throw new Error("FORBIDDEN");

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
  if (!session.canSeeTasks) throw new Error("FORBIDDEN");

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
  if (!session.canSeeTasks) throw new Error("FORBIDDEN");

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
  if (!session.canSeeTasks) throw new Error("FORBIDDEN");

  await prisma.shoppingItem.delete({ where: { id: itemId } });
  revalidatePath("/shop");
}
