/**
 * Applies the Apply cards' changes on David's account in one locked transaction.
 *
 * Two phones loading at once both reach here; the advisory lock makes the second wait,
 * re-read the rows and find nothing left, so nothing is added twice. Every change is
 * recorded in AppliedCorrection (see applied-corrections.ts), so it is never redone.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  pendingTaskCorrections,
  pendingTimelineCorrections,
  taskCorrectionsApplied,
  timelineCorrectionsApplied,
} from "@/lib/applied-corrections";
import { addContact, loadPrintoutCorrectionsPlan, writePhone, type PrintoutCorrectionsPlan } from "@/lib/printout-corrections-data";
import { planReconciledTimeline, type ReconciledPlan } from "@/lib/reconciled-timeline";
import { dueDateFor } from "@/lib/task-corrections";

type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

/** Same table the build creates (scripts/ensure-directory-schema.ts); created here too if a build skipped it. */
export const APPLIED_CORRECTION_TABLE_SQL =
  'CREATE TABLE IF NOT EXISTS "AppliedCorrection" ("key" TEXT NOT NULL PRIMARY KEY, "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)';

/** Any fixed number; only this code takes the lock. */
const APPLY_LOCK = 4_161_026;

/** Keys of every change already applied. A database without the table yet has none. */
export async function loadAppliedKeys(db: Db = prisma): Promise<Set<string>> {
  try {
    const rows = await db.$queryRawUnsafe<Array<{ key: string }>>('SELECT "key" FROM "AppliedCorrection"');
    return new Set(rows.map((row) => row.key));
  } catch {
    return new Set();
  }
}

/** The task card as David should see it: only what has not been applied before. */
export async function loadPendingTaskCorrections(db: Db = prisma): Promise<PrintoutCorrectionsPlan> {
  const [plan, applied] = await Promise.all([loadPrintoutCorrectionsPlan(db), loadAppliedKeys(db)]);
  return pendingTaskCorrections(plan, applied);
}

export async function loadPendingTimelineCorrections(db: Db = prisma): Promise<ReconciledPlan> {
  const [existing, applied] = await Promise.all([
    db.timelineBlock.findMany({
      select: { id: true, seedKey: true, schedule: true, startAt: true, endAt: true, notes: true, sortOrder: true },
    }),
    loadAppliedKeys(db),
  ]);
  return pendingTimelineCorrections(planReconciledTimeline(existing), applied);
}

async function writeTaskCorrections(tx: Tx, plan: PrintoutCorrectionsPlan, now: Date) {
  const tasks = plan.tasks;
  for (const row of tasks.inserts) {
    await tx.task.create({
      data: {
        title: row.title,
        summary: row.summary,
        dueDate: row.due ? dueDateFor(row.due) : null,
        ...(row.done ? { status: "done", completedAt: now } : {}),
      },
    });
  }
  for (const row of tasks.marks) {
    await tx.task.updateMany({ where: { id: row.id, status: { not: "done" } }, data: { status: "done", completedAt: now } });
  }
  // A day only where the job still has none, so a date David set himself stays.
  for (const row of tasks.dueFills) {
    await tx.task.updateMany({ where: { id: row.id, dueDate: null }, data: { dueDate: dueDateFor(row.due) } });
  }
  // A note only where the job still has none, so a note David wrote himself stays.
  for (const row of tasks.noteFills) {
    const untouched = row.before ? { summary: row.before } : { OR: [{ summary: null }, { summary: "" }] };
    await tx.task.updateMany({ where: { id: row.id, ...untouched }, data: { summary: row.summary } });
  }
  // New numbers only; a person with a different number saved is left for David to pick.
  for (const row of plan.phones) {
    if (row.status === "add" && row.write) await writePhone(tx, row.write);
  }
  for (const row of plan.contacts) await addContact(tx, row);
  if (plan.dayJobs.length) {
    const last = await tx.dayAssignment.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    let next = (last?.sortOrder ?? -1) + 1;
    for (const job of plan.dayJobs) {
      await tx.dayAssignment.create({ data: { title: job.title, notes: job.notes, sortOrder: next++ } });
    }
  }
  // Only while the job still reads exactly as this card first wrote it.
  for (const row of plan.dayJobRewords) {
    await tx.dayAssignment.updateMany({ where: { id: row.id, title: row.before }, data: { title: row.title, notes: row.notes } });
  }
  for (const row of plan.playbookRewords) {
    await tx.playbookItem.updateMany({ where: { id: row.id, notes: row.before }, data: { notes: row.notes } });
  }
}

async function writeTimelineCorrections(tx: Tx, plan: ReconciledPlan, removals: boolean) {
  if (removals) {
    for (const row of plan.removals) await tx.timelineBlock.delete({ where: { id: row.id } });
  }
  for (const data of plan.inserts) await tx.timelineBlock.create({ data });
  // Only rows still worded exactly as the app wrote them; the owner's own wording is never touched.
  for (const { id, before: _before, sortOrder: _sortOrder, correction: _correction, ...data } of plan.rewords) {
    await tx.timelineBlock.update({ where: { id }, data });
  }
}

export type AppliedResult = {
  /** What changed, one plain line each, for the "Applied just now" list. */
  lines: string[];
  tasksChanged: boolean;
  timelineChanged: boolean;
};

/**
 * `tasks` and `timeline` pick the cards; `removals` also takes out the duplicate rows the
 * Wedding Day card folds away, which only ever happens on David's own tap.
 */
export async function applyCorrections(options: { tasks: boolean; timeline: boolean; removals: boolean }): Promise<AppliedResult> {
  const now = new Date();
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${APPLY_LOCK})`);
      await tx.$executeRawUnsafe(APPLIED_CORRECTION_TABLE_SQL);
      const keys: string[] = [];
      const lines: string[] = [];
      let tasksChanged = false;
      let timelineChanged = false;

      if (options.tasks) {
        const plan = await loadPendingTaskCorrections(tx);
        const applied = taskCorrectionsApplied(plan);
        if (applied.keys.length) {
          await writeTaskCorrections(tx, plan, now);
          keys.push(...applied.keys);
          lines.push(...applied.lines);
          tasksChanged = true;
        }
      }
      if (options.timeline) {
        const plan = await loadPendingTimelineCorrections(tx);
        const applied = timelineCorrectionsApplied(plan);
        const removing = options.removals && plan.removals.length > 0;
        if (applied.keys.length || removing) {
          await writeTimelineCorrections(tx, plan, options.removals);
          keys.push(...applied.keys);
          lines.push(...applied.lines);
          if (removing) lines.push(...plan.removals.map((row) => `Removed the duplicate “${row.title}”`));
          timelineChanged = true;
        }
      }
      for (const key of keys) {
        await tx.$executeRaw`INSERT INTO "AppliedCorrection" ("key") VALUES (${key}) ON CONFLICT ("key") DO NOTHING`;
      }
      return { lines, tasksChanged, timelineChanged };
    },
    { timeout: 30_000, maxWait: 30_000 },
  );
}
