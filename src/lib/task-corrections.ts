/**
 * David's task corrections from his printed binder (2026-10-10), applied only when he
 * taps Apply on Plan → Tasks. Apply adds the new jobs and ticks the steps he marked
 * done. It never rewords, re-dates or deletes a task, and never unticks anything.
 */
import { BUNKS_NOTE } from "./reconciled-timeline";
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

/** Card 3's note on the Harmony and Melody item, as it first wrote it. */
const HARMONY_MELODY_NOTE_14_45 =
  "Current schedule discussed (all PM): 12:15–12:30 Wedding party arrives; 1:15 Harmony and Melody arrive; Haley’s first look with her dad; 1:30 Haley’s portraits; 1:45 David’s portraits; 2:00 Wedding party dressed; your first look together; 2:15 Couple portraits; 2:45 Bridal-party photos. No revised arrival time was decided for the girls. Confirm when Skila will do their hair, allow dressing time before photos, and choose when to give them their gifts.";
/** 16:33, David: "Keep kids at 115 for now." */
const HARMONY_MELODY_NOTE = `${HARMONY_MELODY_NOTE_14_45} Kids stay at 1:15 for now (David, Oct 10).`;

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
  // David, 2026-10-10 14:45, his planning-session notes, in his words.
  { title: "Bank and post office before the post office closes at noon", due: "2026-10-10", like: /post office/i },
  { title: "Check with Precious Peony", due: "2026-10-10", like: /precious peony/i },
  { title: "Choose David’s rehearsal outfit", due: "2026-10-10", like: /rehearsal (outfit|clothes)/i },
  { title: "Arrange an urn/heater for cocoa water or milk", due: "2026-10-13", like: /\b(urn|heater)\b|heat\/serve the milk/i },
  { title: "Meet with Avalon", due: "2026-10-13", like: /^meet with avalon/i },
  {
    title: "Send Black Sheep the completed selection list and the vendor information packet",
    like: /send black sheep.*(packet|selection)/i,
  },
  {
    title: "Confirm Black Sheep has all insurance and vendor documents",
    summary: "Vendor paperwork is believed to be submitted; confirm nothing is missing.",
    like: /confirm black sheep (has|received)/i,
  },
  {
    title: "Confirm/pay the dinnerware amount",
    summary: "Four sets and $150 were mentioned; clarify what the $150 covers. Black Sheep is paid except for the refundable dinnerware payment.",
  },
  { title: "Confirm Precious Peony’s payment status" },
  {
    title: "Set aside the $800 payment discussed",
    summary: "The recipient’s name was unclear in the transcript.",
  },
  { title: "Get envelopes and finalize remaining payments, gifts, and tips", like: /envelopes/i },
  { title: "Update the run of show and give Kurt the final copy", like: /give kurt.*(run.of.show|final)/i },
  { title: "Finish packing; lay everything out beforehand", summary: "Packing list started." },
  { title: "Decide whether to bring the shark tooth and other display pieces" },
  {
    title: "Download offline maps on David’s phone and playlists on both personal phones",
    summary: "Spotify playlists are finalized and downloaded to the music phone. Offline maps are downloaded on one phone.",
    like: /offline maps/i,
  },
  {
    title: "Assign cleanup helpers and transport responsibilities",
    summary:
      "Black Sheep handles recycling and compost. Ask who can stay to help with trash, table teardown, and food packing. Mom will direct cleanup. Confirm what Denise and Lisa can take home.",
  },
  {
    title: "Ring security: review Harmony’s duties the night before and again that morning",
    summary: "Wendy was mentioned as the helper; confirm.",
  },
  {
    title: "License: bring the knight pen and a regular backup pen",
    summary:
      "Keep everything in the changing room and sign immediately after the ceremony. Braxton will help make that happen; Braxton, Andi, and Marie were named for signing. Choose between the milking tables and changing room.",
  },
  {
    title: "Finish the cocoa selection",
    summary:
      "Eight-foot drink table with water, lemonade, hot cider, and a cocoa station. Look for an urn/heater for hot water or milk; hot water is acceptable.",
  },
  { title: "Finish the clouds", summary: "Clouds nearly finished." },
  { title: "Pack and label supplies by table" },
  {
    title: "Harmony and Melody’s schedule: discuss with Avalon",
    summary: HARMONY_MELODY_NOTE,
  },
];

/**
 * A job an earlier card added with no day, which David has since given a day (14:45).
 * Filled only while the job still has no due date, so a date he set himself stays.
 */
export const DUE_DATE_FILLS: Array<{ title: string; due: string }> = [
  { title: "Pick up the marriage license from the courthouse", due: "2026-10-13" },
  { title: "Find my rehearsal outfit", due: "2026-10-10" },
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
  // 14:45: "Black Sheep’s tables, chairs, décor, and rental selections are completed and highlighted. Still need to send them."
  { card: "Finalize & Send Black Sheep Details", step: "Finalize table and chair quantities for Black Sheep" },
  { card: "Finalize & Send Black Sheep Details", step: "Finalize remaining decor/rental selections for Black Sheep" },
  // 16:36: "I had given updates about not continuing with sleeping arrangements."
  { card: "Finish Airbnb Sleeping Assignments", step: "Assign the remaining required Airbnb beds" },
];

/**
 * Jobs David has since done, ticked only while the job still reads exactly as an earlier
 * card wrote it. 15:47: the post office receipt for the Precious Peony check.
 * 16:22: "I just took care of the bank" (the post office half was the 11:45 receipt).
 */
export const DONE_JOBS = ["Send the check to Precious Peony", "Bank and post office before the post office closes at noon"];

/**
 * A note for a job an earlier card added, written only while the job has no note yet,
 * so a note David wrote himself stays. The tracking number is copied from his receipt.
 */
export const NOTE_FILLS: Array<{ title: string; summary: string }> = [
  { title: "Send the check to Precious Peony", summary: "Tracking number: 9505 5136 9476 6283 7277 06" },
];

/**
 * A note an earlier card wrote that David has since added to; rewritten only while the
 * job's note still reads exactly as the card first wrote it.
 */
export const NOTE_REWORDS: Array<{ title: string; before: string; summary: string }> = [
  { title: "Harmony and Melody’s schedule: discuss with Avalon", before: HARMONY_MELODY_NOTE_14_45, summary: HARMONY_MELODY_NOTE },
];

/** Cards whose every step is in DONE_MARKS: the card itself is finished too. */
export const DONE_CARDS = ["Ceremony Flower Sword", "Rehearsal Dinner Menu", "Finish Airbnb Sleeping Assignments"];

export type TaskRow = {
  id: string;
  title: string;
  status: string;
  parentId: string | null;
  dueDate?: Date | null;
  summary?: string | null;
};

export type TaskCorrectionsPlan = {
  /** `done`: a job David has already finished by the time this tap adds it. */
  inserts: Array<{ title: string; summary: string | null; due: string | null; done?: boolean }>;
  /** Jobs left out because a task already on his list reads like them. */
  alreadyListed: Array<{ title: string; existing: string }>;
  marks: Array<{ id: string; card: string | null; title: string }>;
  /** Jobs an earlier card added with no day that now get the day David gave. */
  dueFills: Array<{ id: string; title: string; due: string }>;
  /** Jobs an earlier card added with no note that now get the note David sent. */
  /** `before`: the card's own earlier note this replaces; without it the job had no note. */
  noteFills: Array<{ id: string; title: string; summary: string; before?: string }>;
};

/** Same noon-of-the-day time the Due date box saves. */
export function dueDateFor(day: string): Date {
  return new Date(`${day}T12:00:00`);
}

/**
 * Where the bunks note goes when Thursday's check-in moment cannot carry it (David reworded
 * that moment himself): on the ticked sleeping job, while its note still reads as the app wrote it.
 */
export const BUNKS_NOTE_ON_JOB = {
  title: "Finish Airbnb Sleeping Assignments",
  before: "Assign the remaining required Airbnb beds. Overflow can stay empty.",
  summary: `Assign the remaining required Airbnb beds. Overflow can stay empty. ${BUNKS_NOTE}`,
};

export function planTaskCorrections(tasks: TaskRow[], options: { bunksOnJob?: boolean } = {}): TaskCorrectionsPlan {
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
    // A later list naming a job this tap already adds ("Choose David’s rehearsal outfit" beside "Find my rehearsal outfit").
    if (def.like && inserts.some((row) => def.like!.test(row.title))) continue;
    // A job with no day of its own takes the day David gave later (DUE_DATE_FILLS).
    const due = def.due ?? DUE_DATE_FILLS.find((fill) => fill.title === def.title)?.due ?? null;
    const note = NOTE_FILLS.find((fill) => fill.title === def.title)?.summary;
    const done = DONE_JOBS.includes(def.title);
    inserts.push({ title: def.title, summary: def.summary ?? note ?? null, due, ...(done ? { done } : {}) });
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
  for (const title of DONE_JOBS) {
    mark(tasks.find((task) => !task.parentId && task.title === title));
  }
  for (const title of DONE_CARDS) {
    mark(tasks.find((task) => !task.parentId && titlesMatch(task.title, title)));
  }
  const dueFills: TaskCorrectionsPlan["dueFills"] = [];
  for (const def of DUE_DATE_FILLS) {
    const task = tasks.find((row) => row.title === def.title && !row.dueDate && row.status !== "done");
    if (task) dueFills.push({ id: task.id, title: task.title, due: def.due });
  }
  const noteFills: TaskCorrectionsPlan["noteFills"] = [];
  for (const def of NOTE_FILLS) {
    const task = tasks.find((row) => !row.parentId && row.title === def.title && !row.summary);
    if (task) noteFills.push({ id: task.id, title: task.title, summary: def.summary });
  }
  for (const def of options.bunksOnJob ? [...NOTE_REWORDS, BUNKS_NOTE_ON_JOB] : NOTE_REWORDS) {
    const task = tasks.find((row) => !row.parentId && row.title === def.title && row.summary === def.before);
    if (task) noteFills.push({ id: task.id, title: task.title, summary: def.summary, before: def.before });
  }
  return { inserts, alreadyListed, marks, dueFills, noteFills };
}

export function taskCorrectionsPlanIsEmpty(plan: TaskCorrectionsPlan): boolean {
  return plan.inserts.length === 0 && plan.marks.length === 0 && (plan.dueFills ?? []).length === 0 && (plan.noteFills ?? []).length === 0;
}
