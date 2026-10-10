/**
 * What an Apply card has already done on David's account, by a stable key per change.
 *
 * Since 2026-10-10 (David: "can you auto apply the changes so I stop needing to hit
 * apply?") the cards' additive changes apply themselves on his master account. A change
 * applied once is recorded here and never planned again, so a job, step, note or moment
 * he removes or changes afterwards stays the way he left it.
 */
import type { PrintoutCorrectionsPlan } from "./printout-corrections-data";
import type { ReconciledPlan } from "./reconciled-timeline";
import type { TaskCorrectionsPlan } from "./task-corrections";
import { parseBlockNotes } from "./day-of-now";

export const correctionKey = {
  taskAdd: (title: string) => `task:add:${title}`,
  taskDone: (card: string | null, title: string) => `task:done:${card ? `${card} › ` : ""}${title}`,
  taskDue: (title: string) => `task:due:${title}`,
  taskNote: (title: string, summary?: string) => (summary ? `task:note:${title}:${summary.slice(-60)}` : `task:note:${title}`),
  phone: (label: string) => `phone:${label}`,
  contact: (name: string) => `contact:${name}`,
  dayJob: (title: string) => `dayjob:add:${title}`,
  dayJobReword: (title: string) => `dayjob:reword:${title}`,
  playbookReword: (sourceKey: string) => `playbook:reword:${sourceKey}`,
  momentAdd: (seedKey: string) => `timeline:add:${seedKey}`,
  momentReword: (seedKey: string, correction: string) => `timeline:reword:${seedKey}:${correction}`,
};

/** A note filled in, or a card's own note brought up to date: each is its own change. */
function noteKey(row: { title: string; summary: string; before?: string }): string {
  return row.before ? correctionKey.taskNote(row.title, row.summary) : correctionKey.taskNote(row.title);
}

/** The task card's plan without anything already applied once. */
export function pendingTaskCorrections(plan: PrintoutCorrectionsPlan, applied: ReadonlySet<string>): PrintoutCorrectionsPlan {
  const tasks: TaskCorrectionsPlan = {
    ...plan.tasks,
    inserts: plan.tasks.inserts.filter((row) => !applied.has(correctionKey.taskAdd(row.title))),
    marks: plan.tasks.marks.filter((row) => !applied.has(correctionKey.taskDone(row.card, row.title))),
    dueFills: plan.tasks.dueFills.filter((row) => !applied.has(correctionKey.taskDue(row.title))),
    noteFills: plan.tasks.noteFills.filter((row) => !applied.has(noteKey(row))),
  };
  return {
    tasks,
    // A number David has to pick between is never applied on its own, so it stays.
    phones: plan.phones.filter((row) => row.status !== "add" || !applied.has(correctionKey.phone(row.label))),
    contacts: plan.contacts.filter((row) => !applied.has(correctionKey.contact(row.name))),
    dayJobs: plan.dayJobs.filter((row) => !applied.has(correctionKey.dayJob(row.title))),
    dayJobRewords: plan.dayJobRewords.filter((row) => !applied.has(correctionKey.dayJobReword(row.title))),
    playbookRewords: plan.playbookRewords.filter((row) => !applied.has(correctionKey.playbookReword(row.sourceKey))),
  };
}

/** The Wedding Day card's plan without moments already added or corrected once. */
export function pendingTimelineCorrections(plan: ReconciledPlan, applied: ReadonlySet<string>): ReconciledPlan {
  return {
    ...plan,
    inserts: plan.inserts.filter((row) => !applied.has(correctionKey.momentAdd(row.seedKey))),
    rewords: plan.rewords.filter((row) => !applied.has(correctionKey.momentReword(row.seedKey, row.correction))),
  };
}

export function dayLabel(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Detroit" });
}

/** Keys and plain lines for the additive part of the task card: everything Apply does without asking. */
export function taskCorrectionsApplied(plan: PrintoutCorrectionsPlan): { keys: string[]; lines: string[] } {
  const keys: string[] = [];
  const lines: string[] = [];
  for (const row of plan.tasks.inserts) {
    keys.push(correctionKey.taskAdd(row.title));
    if (row.done) keys.push(correctionKey.taskDone(null, row.title));
    lines.push(`Added “${row.title}”${row.due ? ` (${dayLabel(row.due)})` : ""}${row.done ? ", already done" : ""}`);
  }
  for (const row of plan.tasks.marks) {
    keys.push(correctionKey.taskDone(row.card, row.title));
    lines.push(`Marked done: ${row.card ? `${row.card} · ` : ""}${row.title}`);
  }
  for (const row of plan.tasks.dueFills) {
    keys.push(correctionKey.taskDue(row.title));
    lines.push(`Gave “${row.title}” a day: ${dayLabel(row.due)}`);
  }
  for (const row of plan.tasks.noteFills) {
    keys.push(noteKey(row));
    lines.push(row.before ? `Updated the note on “${row.title}”` : `Added a note to “${row.title}”: ${row.summary}`);
  }
  for (const row of plan.phones) {
    if (row.status !== "add" || !row.write) continue;
    keys.push(correctionKey.phone(row.label));
    lines.push(`Saved ${row.personName ?? row.label}’s number: ${row.phone}`);
  }
  for (const row of plan.contacts) {
    keys.push(correctionKey.contact(row.name));
    lines.push(`Added contact: ${row.name} · ${row.phone}`);
  }
  for (const row of plan.dayJobs) {
    keys.push(correctionKey.dayJob(row.title));
    lines.push(`Added Day-of job: ${row.title}`);
  }
  for (const row of plan.dayJobRewords) {
    keys.push(correctionKey.dayJobReword(row.title));
    lines.push(`Corrected Day-of job: ${row.title} (${row.correction})`);
  }
  for (const row of plan.playbookRewords) {
    keys.push(correctionKey.playbookReword(row.sourceKey));
    lines.push(`Corrected Coordinator scope: ${row.title} (${row.correction})`);
  }
  return { keys, lines };
}

/** Keys and plain lines for the additive part of the Wedding Day card: new moments and the app's own wording corrected. */
export function timelineCorrectionsApplied(plan: ReconciledPlan): { keys: string[]; lines: string[] } {
  const keys: string[] = [];
  const lines: string[] = [];
  for (const row of plan.inserts) {
    keys.push(correctionKey.momentAdd(row.seedKey));
    lines.push(`Added to the ${row.schedule === "rehearsal" ? "Thursday" : "Wedding Day"} timeline: ${row.startAt} ${parseBlockNotes(row.notes).title}`);
  }
  for (const row of plan.rewords) {
    keys.push(correctionKey.momentReword(row.seedKey, row.correction));
    lines.push(`Corrected ${row.startAt} ${parseBlockNotes(row.notes).title} (${row.correction})`);
  }
  return { keys, lines };
}
