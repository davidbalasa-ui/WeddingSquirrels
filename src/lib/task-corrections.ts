/**
 * David's task corrections from his printed binder (2026-10-10), applied only when he
 * taps Apply on Plan → Tasks. Apply adds the new jobs and ticks the steps he marked
 * done. It never rewords, re-dates or deletes a task, and never unticks anything.
 */
import { titlesMatch } from "./curated-open-work";

/** `due` is a day ("2026-10-12"); left out when David gave no day. */
export type NewTaskDef = {
  title: string;
  summary?: string;
  due?: string;
  /** A task already on his list in other words counts as this job; it is not added again. */
  like?: RegExp;
};
export type DoneMarkDef = { card: string; step: string };

/** Monday and Tuesday jobs, word for word from David's own list. */
export const NEW_TASKS: NewTaskDef[] = [
  { title: "Total Wine: Pick up the alcohol order", due: "2026-10-12" },
  { title: "Robinette’s: Get 5–7 gallons of cider for serving hot", due: "2026-10-13" },
  { title: "World Market: Look at hot cocoa options and decide whether to serve it", due: "2026-10-13" },
  {
    title: "If you choose cocoa: Rent or buy something to heat/serve the milk or water",
    summary: "Maybe carafes for the milk.",
    due: "2026-10-13",
  },
  { title: "A Perfect Fit Alterations: Pick up Haley’s dress with the bustle completed", due: "2026-10-13" },
  { title: "Alpine Events: Pick up the rentals", due: "2026-10-13" },
  // David, 2026-10-10 10:08, in his words.
  { title: "Send the check to Precious Peony", due: "2026-10-10", like: /precious peony.*\b(check|pay)|\b(check|pay).*precious peony/i },
  {
    title: "Pick up the marriage license from the courthouse",
    like: /marriage licen[cs]e/i,
    summary: "Not sure if Monday or Tuesday.",
  },
  { title: "Get someone to deliver my vehicle to Victoria Resort", like: /\b(vehicle|car|truck)\b.*victoria|victoria.*\b(vehicle|car|truck)\b/i },
  { title: "Finish building the table decor and pack it up", like: /table d[eé]cor/i },
  {
    title: "Print the instruction sheets for the head table, the favors and the gift table",
    like: /instruction sheet/i,
    summary: "All of this has to be packed up together.",
  },
  {
    title: "Pack up the tables together: entryway table, gift box table, favors table",
    like: /entryway table|gift box table|favou?rs? table/i,
    summary: "I think I’m missing a table.",
  },
  { title: "Pack for the mini moon", like: /\bpack\b.*mini ?moon/i },
  { title: "Pack for the wedding", like: /^pack (for )?(the )?wedding$/i },
  { title: "Find my rehearsal outfit", like: /rehearsal (outfit|clothes)/i },
];

/** Steps David ticked on the printout, and the rehearsal dinner menu he is not running through the app. */
export const DONE_MARKS: DoneMarkDef[] = [
  { card: "Week before", step: "Confirm week-of plans with each other" },
  { card: "Day before", step: "Rehearsal time + dinner locked" },
  { card: "Finalize & Send Black Sheep Details", step: "Send Black Sheep the existing day-of event insurance policy" },
  {
    card: "Wedding Drinks & Serving Supplies",
    step: "Figure out hot-cider service: source, quantity, heating/holding method, and serving plan",
  },
  { card: "Wedding Drinks & Serving Supplies", step: "Determine and order enough hot-drink cups" },
  { card: "Wedding Drinks & Serving Supplies", step: "Buy the wedding booze after the drink plan is finalized" },
  { card: "Wedding Drinks & Serving Supplies", step: "Order the remaining s'mores ingredients" },
  { card: "Ceremony Flower Sword", step: "Receive the ordered sword" },
  { card: "Ceremony Flower Sword", step: "Decorate the sword with faux flowers" },
  { card: "Rehearsal Dinner Menu", step: "Get the final food/menu options from Hawkshead" },
  { card: "Rehearsal Dinner Menu", step: "Enter the rehearsal-dinner courses/dishes into WeddingSquirrels" },
  { card: "Rehearsal Dinner Menu", step: "Publish meal choices to the rehearsal-dinner guests" },
  { card: "Rehearsal Dinner Menu", step: "Collect selections from the 17 rehearsal-dinner guests" },
  { card: "Rehearsal Dinner Menu", step: "Follow up with guests who have not selected before the eventual cutoff" },
];

/** Cards whose every step is in DONE_MARKS: the card itself is finished too. */
export const DONE_CARDS = ["Ceremony Flower Sword", "Rehearsal Dinner Menu"];

export type TaskRow = { id: string; title: string; status: string; parentId: string | null };

export type TaskCorrectionsPlan = {
  inserts: Array<{ title: string; summary: string | null; due: string | null }>;
  /** Jobs left out because a task already on his list reads like them. */
  alreadyListed: Array<{ title: string; existing: string }>;
  marks: Array<{ id: string; card: string | null; title: string }>;
};

/** Same noon-of-the-day time the Due date box saves. */
export function dueDateFor(day: string): Date {
  return new Date(`${day}T12:00:00`);
}

export function planTaskCorrections(tasks: TaskRow[]): TaskCorrectionsPlan {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const cardTitle = (task: TaskRow) => (task.parentId ? byId.get(task.parentId)?.title ?? null : null);

  // A job whose title is already on any task (open or done) is never added twice.
  const inserts: TaskCorrectionsPlan["inserts"] = [];
  const alreadyListed: TaskCorrectionsPlan["alreadyListed"] = [];
  for (const def of NEW_TASKS) {
    if (tasks.some((task) => titlesMatch(task.title, def.title))) continue;
    const near = def.like ? tasks.find((task) => def.like!.test(task.title)) : undefined;
    if (near) {
      alreadyListed.push({ title: def.title, existing: near.title });
      continue;
    }
    inserts.push({ title: def.title, summary: def.summary ?? null, due: def.due ?? null });
  }

  const marks: TaskCorrectionsPlan["marks"] = [];
  const seen = new Set<string>();
  const mark = (task: TaskRow | undefined) => {
    if (!task || task.status === "done" || seen.has(task.id)) return;
    seen.add(task.id);
    marks.push({ id: task.id, card: cardTitle(task), title: task.title });
  };
  for (const def of DONE_MARKS) {
    mark(
      tasks.find((task) => {
        const parent = task.parentId ? byId.get(task.parentId) : undefined;
        return Boolean(parent) && titlesMatch(parent!.title, def.card) && titlesMatch(task.title, def.step);
      }),
    );
  }
  for (const title of DONE_CARDS) {
    mark(tasks.find((task) => !task.parentId && titlesMatch(task.title, title)));
  }
  return { inserts, alreadyListed, marks };
}

export function taskCorrectionsPlanIsEmpty(plan: TaskCorrectionsPlan): boolean {
  return plan.inserts.length === 0 && plan.marks.length === 0;
}
