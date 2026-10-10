import assert from "node:assert/strict";
import { test } from "node:test";
import { DONE_MARKS, NEW_TASKS, dueDateFor, planTaskCorrections, taskCorrectionsPlanIsEmpty } from "./task-corrections";

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
  assert.equal(plan.inserts.length, NEW_TASKS.length - 1);
  assert.equal(plan.inserts.some((row) => row.title.startsWith("Total Wine")), false);
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
    ...NEW_TASKS.map((def, i) => ({ id: `n${i}`, title: def.title, status: "todo", parentId: null })),
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
  assert.deepEqual([...new Set(NEW_TASKS.map((def) => def.due))], ["2026-10-12", "2026-10-13"]);
  assert.equal(NEW_TASKS.filter((def) => def.due === "2026-10-12").length, 1);
  assert.equal(dueDateFor("2026-10-13").getDate(), 13);
  assert.equal(dueDateFor("2026-10-13").getHours(), 12);
});
