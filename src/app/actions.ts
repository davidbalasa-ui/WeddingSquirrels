"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canManageAccounts,
  moneyEditable,
  normalizeAccountFlags,
  timelineEditable,
} from "@/lib/access";
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

export async function setBudgetOwner(budgetItemId: string, ownerId: string | null) {
  const session = await requireSession();
  if (!session.canSeeBudget || !moneyEditable(session)) throw new Error("FORBIDDEN");

  if (ownerId !== null && ownerId !== "david" && ownerId !== "haley") {
    throw new Error("INVALID_OWNER");
  }

  await prisma.budgetItem.update({
    where: { id: budgetItemId },
    data: { ownerId },
  });

  revalidatePath("/money");
}

function parseMoney(raw: string) {
  if (!raw.trim()) return null;
  const n = Number.parseFloat(raw.replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseDueDate(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const d = new Date(`${trimmed}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function saveBudgetItem(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session.canSeeBudget || !moneyEditable(session)) throw new Error("FORBIDDEN");

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const price = parseMoney(String(formData.get("price") || "")) ?? 0;
  const amountPaid = parseMoney(String(formData.get("amountPaid") || "")) ?? 0;
  const note = String(formData.get("note") || "").trim();
  const ownerRaw = String(formData.get("ownerId") || "");
  const ownerId = ownerRaw === "david" || ownerRaw === "haley" ? ownerRaw : null;

  if (!id || !name) return;

  await prisma.budgetItem.update({
    where: { id },
    data: { name, price, amountPaid, note: note || null, ownerId },
  });

  revalidatePath("/money");
}

export async function createBudgetItem(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session.canSeeBudget || !moneyEditable(session)) throw new Error("FORBIDDEN");

  const name = String(formData.get("name") || "").trim();
  const price = parseMoney(String(formData.get("price") || "")) ?? 0;
  const amountPaid = parseMoney(String(formData.get("amountPaid") || "")) ?? 0;
  const note = String(formData.get("note") || "").trim();
  if (!name) return;

  const last = await prisma.budgetItem.findFirst({ orderBy: { sortOrder: "desc" } });
  await prisma.budgetItem.create({
    data: {
      name,
      price,
      amountPaid,
      note: note || null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  revalidatePath("/money");
}

export async function deleteBudgetItem(id: string): Promise<void> {
  const session = await requireSession();
  if (!session.canSeeBudget || !moneyEditable(session)) throw new Error("FORBIDDEN");

  await prisma.task.updateMany({ where: { budgetItemId: id }, data: { budgetItemId: null } });
  await prisma.budgetItem.delete({ where: { id } });
  revalidatePath("/money");
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

/**
 * TODO(WP3): When BudgetItemShare / TaskShare models exist, sync this account's
 * membership using setBudgetItemShares / setTaskShares (or equivalent account-scoped write).
 * Until then, share ID lists are accepted and ignored so the Accounts UI can land first.
 */
async function syncAccountShares(_args: {
  pinAccountId: string;
  sharedBudgetItemIds: string[];
  sharedTaskIds: string[];
}): Promise<void> {
  // no-op until WP3 share tables are available on this branch
}

export async function createPinAccount(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!canManageAccounts(session)) throw new Error("FORBIDDEN");

  const name = String(formData.get("name") || "").trim();
  const pin = String(formData.get("pin") || "").trim();
  const flags = parseAccountFlags(formData);

  if (!name || !/^\d{4,8}$/.test(pin)) return;

  if (flags.linkedPersonId) {
    const person = await prisma.person.findUnique({ where: { id: flags.linkedPersonId } });
    if (!person) return;
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
}

export async function updatePinAccount(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!canManageAccounts(session)) throw new Error("FORBIDDEN");

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const pin = String(formData.get("pin") || "").trim();
  const flags = parseAccountFlags(formData);
  const wantMaster = formData.get("isMaster") === "on";

  const existing = await prisma.pinAccount.findUnique({ where: { id } });
  if (!existing || !name) return;
  if (pin && !/^\d{4,8}$/.test(pin)) return;

  if (flags.linkedPersonId) {
    const person = await prisma.person.findUnique({ where: { id: flags.linkedPersonId } });
    if (!person) return;
  }

  // Cannot demote the last master.
  if (existing.isMaster && !wantMaster && formData.has("isMaster")) {
    const masterCount = await prisma.pinAccount.count({ where: { isMaster: true } });
    if (masterCount <= 1) throw new Error("Cannot demote the last master");
  }

  // Masters keep full privileges; only identity fields can change (unless demoted by another master).
  if (existing.isMaster && !(formData.has("isMaster") && !wantMaster)) {
    await prisma.pinAccount.update({
      where: { id },
      data: {
        name,
        linkedPersonId: flags.linkedPersonId,
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
      ...(formData.has("isMaster") ? { isMaster: wantMaster } : {}),
      canSeeTasks: flags.canSeeTasks,
      canSeeBudget: flags.canSeeBudget,
      canSeeGuests: flags.canSeeGuests,
      canSeeTimeline: flags.canSeeTimeline,
      canManageAccounts: flags.canManageAccounts,
      canSeeShop: flags.canSeeShop,
      canSeeCalendar: flags.canSeeCalendar,
      canSeePeople: flags.canSeePeople,
      canSeeRequests: flags.canSeeRequests,
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
}

export async function deletePinAccount(accountId: string) {
  const session = await requireSession();
  if (!canManageAccounts(session)) throw new Error("FORBIDDEN");

  const existing = await prisma.pinAccount.findUnique({ where: { id: accountId } });
  if (!existing) return;
  // Cannot delete masters (cascade of related rows is DB-level when shares/requests exist).
  if (existing.isMaster) throw new Error("FORBIDDEN");

  await prisma.pinAccount.delete({ where: { id: accountId } });
  revalidatePath("/accounts");
}

async function requireTimelineEditor() {
  const session = await requireSession();
  if (!session.canSeeTimeline || !timelineEditable(session)) throw new Error("FORBIDDEN");
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
