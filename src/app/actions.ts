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

export async function saveTaskWorkspace(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session.canSeeTasks) throw new Error("FORBIDDEN");

  const id = String(formData.get("id") || "");
  const planNotes = String(formData.get("planNotes") || "");
  const summary = String(formData.get("summary") || "");
  const amountNeededRaw = String(formData.get("amountNeeded") || "").trim();
  const amountSpentRaw = String(formData.get("amountSpent") || "").trim();
  const markDone = formData.get("markDone") === "on";

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

  await prisma.task.update({
    where: { id },
    data: {
      planNotes,
      summary: summary || task.summary,
      amountNeeded: Number.isFinite(amountNeeded as number) ? amountNeeded : null,
      amountSpent: Number.isFinite(amountSpent) ? amountSpent : 0,
      status: markDone ? "done" : task.status === "done" ? "todo" : task.status,
      completedAt: markDone ? new Date() : null,
    },
  });

  revalidatePath("/today");
  revalidatePath("/people");
  revalidatePath(`/work/${id}`);
  revalidatePath("/money");
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
  if (!session.canSeeBudget || !session.isMaster) throw new Error("FORBIDDEN");

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

export async function saveBudgetItem(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!session.canSeeBudget || !session.isMaster) throw new Error("FORBIDDEN");

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
  if (!session.canSeeBudget || !session.isMaster) throw new Error("FORBIDDEN");

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
  if (!session.canSeeBudget || !session.isMaster) throw new Error("FORBIDDEN");

  await prisma.task.updateMany({ where: { budgetItemId: id }, data: { budgetItemId: null } });
  await prisma.budgetItem.delete({ where: { id } });
  revalidatePath("/money");
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
  if (!existing || existing.isMaster || !name) return;
  if (pin && !/^\d{4,8}$/.test(pin)) return;

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
