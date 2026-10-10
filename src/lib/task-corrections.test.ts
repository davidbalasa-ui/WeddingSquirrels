import assert from "node:assert/strict";
import { test } from "node:test";
import { DONE_JOBS, DONE_MARKS, DUE_DATE_FILLS, NEW_TASKS, NOTE_FILLS, dueDateFor, planTaskCorrections, taskCorrectionsPlanIsEmpty } from "./task-corrections";

const cards = [
  { id: "wk", title: "Week before", status: "todo", parentId: null },
  { id: "rd", title: "Rehearsal Dinner Menu", status: "todo", parentId: null },
  { id: "dr", title: "Wedding Drinks & Serving Supplies", status: "todo", parentId: null },
];

test("task corrections add each dated job once and tick only the marked steps", () => {
  const tasks = [
    ...cards,
    { id: "s1", title: "Confirm week-of plans with each other", status: "todo", parentId: "wk" },
    { id: "s2", title: "Confirm final payments / tip envelopes ready", status: "todo", parentId: "wk" },
    { id: "s3", title: "Get the final food/menu options from Hawkshead", status: "todo", parentId: "rd" },
    { id: "s4", title: "Buy the wedding booze after the drink plan is finalized", status: "done", parentId: "dr" },
    // Already added by hand: never added twice, never re-dated.
    { id: "t1", title: "Total Wine: Pick up the alcohol order", status: "todo", parentId: null },
  ];
  const plan = planTaskCorrections(tasks);
  // Total Wine is already there; "Get envelopes…" reads like the tip-envelopes step; three of the
  // 14:45 jobs name jobs this same tap adds (rehearsal outfit, Precious Peony, the cocoa heater).
  assert.equal(plan.inserts.length, NEW_TASKS.length - 5);
  assert.equal(plan.inserts.some((row) => row.title.startsWith("Total Wine")), false);
  assert.equal(plan.inserts.filter((row) => /rehearsal outfit/i.test(row.title)).length, 1);
  assert.equal(plan.inserts.filter((row) => /urn\/heater|heat\/serve/i.test(row.title)).length, 1);
  assert.deepEqual(plan.alreadyListed, [
    { title: "Get envelopes and finalize remaining payments, gifts, and tips", existing: "Confirm final payments / tip envelopes ready" },
  ]);
  assert.deepEqual(
    plan.marks.map((row) => row.id),
    ["s1", "s3", "rd"],
  );
  // A step with the same words on another card is not touched.
  const elsewhere = planTaskCorrections([
    { id: "x", title: "Other card", status: "todo", parentId: null },
    { id: "y", title: "Confirm week-of plans with each other", status: "todo", parentId: "x" },
  ]);
  assert.equal(elsewhere.marks.length, 0);
});

test("task corrections are empty once applied", () => {
  const applied = [
    ...cards.map((card) => (card.id === "rd" ? { ...card, status: "done" } : card)),
    ...NEW_TASKS.map((def, i) => ({
      id: `n${i}`,
      title: def.title,
      status: DONE_JOBS.includes(def.title) ? "done" : "todo",
      parentId: null,
      summary: NOTE_FILLS.find((fill) => fill.title === def.title)?.summary ?? def.summary ?? null,
      dueDate: def.due || DUE_DATE_FILLS.some((fill) => fill.title === def.title) ? dueDateFor("2026-10-13") : null,
    })),
    ...DONE_MARKS.filter((def) => def.card === "Week before").map((def, i) => ({
      id: `d${i}`,
      title: def.step,
      status: "done",
      parentId: "wk",
    })),
  ];
  assert.equal(taskCorrectionsPlanIsEmpty(planTaskCorrections(applied)), true);
});

test("jobs are due on David's days, at the same noon the Due date box saves", () => {
  assert.deepEqual([...new Set(NEW_TASKS.map((def) => def.due).filter(Boolean))], ["2026-10-12", "2026-10-13", "2026-10-10"]);
  // The marriage license day is the one David wasn't sure of; it gets no date.
  assert.equal(NEW_TASKS.find((def) => /marriage license/.test(def.title))?.due, undefined);
  assert.equal(NEW_TASKS.filter((def) => def.due === "2026-10-12").length, 1);
  assert.equal(dueDateFor("2026-10-13").getDate(), 13);
  assert.equal(dueDateFor("2026-10-13").getHours(), 12);
});

test("a job already on the list in other words is not added twice", () => {
  const plan = planTaskCorrections([
    { id: "a", title: "Mail Precious Peony the final check", status: "todo", parentId: null },
    { id: "b", title: "Get the marriage license", status: "todo", parentId: null },
  ]);
  assert.deepEqual(plan.alreadyListed, [
    { title: "Send the check to Precious Peony", existing: "Mail Precious Peony the final check" },
    { title: "Pick up the marriage license from the courthouse", existing: "Get the marriage license" },
    { title: "Check with Precious Peony", existing: "Mail Precious Peony the final check" },
  ]);
  assert.equal(plan.inserts.some((row) => /check to Precious Peony|Check with Precious Peony|marriage license/.test(row.title)), false);
  // Added fresh, the outfit takes the day David gave at 14:45.
  assert.equal(plan.inserts.some((row) => row.title === "Find my rehearsal outfit" && row.due === "2026-10-10"), true);
});

test("a job an earlier card added with no day gets the day David gave, never over his own date", () => {
  const plan = planTaskCorrections([
    { id: "l", title: "Pick up the marriage license from the courthouse", status: "todo", parentId: null, dueDate: null },
    { id: "o", title: "Find my rehearsal outfit", status: "todo", parentId: null, dueDate: dueDateFor("2026-10-11") },
  ]);
  assert.deepEqual(plan.dueFills, [{ id: "l", title: "Pick up the marriage license from the courthouse", due: "2026-10-13" }]);
  // Reworded by David: no longer the card's words, so it is left alone.
  assert.deepEqual(
    planTaskCorrections([{ id: "l", title: "Get the license Tuesday", status: "todo", parentId: null, dueDate: null }]).dueFills,
    [],
  );
});

test("the 14:45 notes keep David's open questions as questions", () => {
  const byTitle = (title: string) => NEW_TASKS.find((def) => def.title === title)!;
  assert.match(byTitle("Set aside the $800 payment discussed").summary!, /recipient’s name was unclear/);
  assert.match(byTitle("Confirm/pay the dinnerware amount").summary!, /clarify what the \$150 covers/);
  assert.match(byTitle("Harmony and Melody’s schedule: discuss with Avalon").summary!, /No revised arrival time was decided/);
});

test("names in the 14:45 notes are spelled as David confirmed: Skila and Andi", () => {
  const text = NEW_TASKS.map((def) => `${def.title} ${def.summary ?? ""}`).join("\n");
  assert.doesNotMatch(text, /Skylar|\bAndy\b/);
  assert.match(text, /when Skila will do their hair/);
  assert.match(text, /Braxton, Andi, and Marie/);
});

test("the Precious Peony check is ticked done with the tracking number from his receipt, only as the card wrote it", () => {
  const check = { id: "pp", title: "Send the check to Precious Peony", status: "todo", parentId: null, dueDate: dueDateFor("2026-10-10"), summary: null };
  const plan = planTaskCorrections([check]);
  assert.deepEqual(plan.marks, [{ id: "pp", card: null, title: "Send the check to Precious Peony" }]);
  assert.deepEqual(plan.noteFills, [{ id: "pp", title: "Send the check to Precious Peony", summary: "Tracking number: 9505 5136 9476 6283 7277 06" }]);
  // A note David wrote himself stays, and a job he already ticked is left alone.
  const own = planTaskCorrections([{ ...check, status: "done", summary: "Mailed it" }]);
  assert.equal(own.marks.length, 0);
  assert.equal(own.noteFills.length, 0);
  // His own task in other words is not touched: no tick, no note.
  const reworded = planTaskCorrections([{ ...check, title: "Mail Precious Peony the check" }]);
  assert.equal(reworded.marks.some((row) => row.id === "pp"), false);
  assert.equal(reworded.noteFills.length, 0);
  // Not on the list yet: this tap adds it already done, with the note.
  const fresh = planTaskCorrections([]).inserts.find((row) => row.title === check.title);
  assert.deepEqual(fresh, { title: check.title, summary: NOTE_FILLS[0]!.summary, due: "2026-10-10", done: true });
  assert.ok(DONE_JOBS.includes(check.title));
});

test("the bank and post office job is ticked done, only while it reads as card 3 added it", () => {
  const job = { id: "bp", title: "Bank and post office before the post office closes at noon", status: "todo", parentId: null, dueDate: dueDateFor("2026-10-10") };
  assert.deepEqual(planTaskCorrections([job]).marks, [{ id: "bp", card: null, title: job.title }]);
  assert.equal(planTaskCorrections([{ ...job, title: "Bank + post office" }]).marks.some((row) => row.id === "bp"), false);
  assert.equal(planTaskCorrections([{ ...job, status: "done" }]).marks.length, 0);
  assert.equal(planTaskCorrections([]).inserts.find((row) => row.title === job.title)?.done, true);
});

test("David's 16:33 'Keep kids at 115 for now' joins card 3's Harmony and Melody note, only while it reads as the card wrote it", () => {
  const item = NEW_TASKS.find((def) => def.title === "Harmony and Melody’s schedule: discuss with Avalon")!;
  assert.match(item.summary!, /Kids stay at 1:15 for now \(David, Oct 10\)\.$/);
  const was = item.summary!.replace(" Kids stay at 1:15 for now (David, Oct 10).", "");
  const row = { id: "hm", title: item.title, status: "todo", parentId: null, summary: was };
  assert.deepEqual(planTaskCorrections([row]).noteFills, [{ id: "hm", title: item.title, summary: item.summary, before: was }]);
  // Changed by David, or already up to date: left alone.
  assert.equal(planTaskCorrections([{ ...row, summary: `${was} Ask Avalon Monday.` }]).noteFills.length, 0);
  assert.equal(planTaskCorrections([{ ...row, summary: item.summary }]).noteFills.length, 0);
});

test("the Airbnb sleeping assignments card and its bed step are ticked done (David, 16:36)", () => {
  const plan = planTaskCorrections([
    { id: "ab", title: "Finish Airbnb Sleeping Assignments", status: "todo", parentId: null },
    { id: "ab1", title: "Assign the remaining required Airbnb beds", status: "todo", parentId: "ab" },
  ]);
  const ids = plan.marks.map((row) => row.id);
  assert.ok(ids.includes("ab"));
  assert.ok(ids.includes("ab1"));
});
