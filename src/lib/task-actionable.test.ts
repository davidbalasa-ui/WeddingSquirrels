import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CURATED_PACKAGES,
  DAY_BEFORE_STEPS,
  WEEK_BEFORE_STEPS,
} from "./curated-open-work";
import {
  countActionableOpenInboxTasks,
  countActionableOpenTasks,
  countOpenWorkspaceCards,
  listActionableOpenTasks,
} from "./task-actionable";

type Row = {
  id: string;
  title?: string;
  status?: string;
  parentId?: string | null;
  dueDate?: Date | null;
  children?: Row[];
};

function task(partial: Partial<Row> & Pick<Row, "id">): Row {
  return {
    status: "todo",
    parentId: null,
    ...partial,
  };
}

function orgTree(): Row[] {
  const week = task({ id: "week", title: "Week before" });
  const day = task({ id: "day", title: "Day before" });
  const weekKids = WEEK_BEFORE_STEPS.map((title, index) =>
    task({ id: `w${index}`, title, parentId: "week" }),
  );
  const dayKids = DAY_BEFORE_STEPS.map((title, index) =>
    task({ id: `d${index}`, title, parentId: "day" }),
  );
  return [week, day, ...weekKids, ...dayKids];
}

function productionShapedTree(): Row[] {
  const tasks = orgTree();
  tasks.push(task({ id: "crossbow", title: "Call crossbow" }));
  for (const pkg of CURATED_PACKAGES) {
    tasks.push(task({ id: pkg.key, title: pkg.title }));
    for (const step of pkg.steps) {
      tasks.push(task({ id: `${pkg.key}:${step.key}`, title: step.title, parentId: pkg.key }));
    }
  }
  return tasks;
}

test("parent with open children contributes 0 itself", () => {
  const tasks = [
    task({ id: "p", title: "Workspace" }),
    task({ id: "c1", title: "Step", parentId: "p" }),
  ];
  const leaves = listActionableOpenTasks(tasks);
  assert.equal(leaves.some((row) => row.id === "p"), false);
  assert.equal(countActionableOpenTasks(tasks), 1);
});

test("each open child contributes 1", () => {
  const tasks = [
    task({ id: "p", title: "Workspace" }),
    task({ id: "c1", parentId: "p" }),
    task({ id: "c2", parentId: "p" }),
    task({ id: "c3", parentId: "p" }),
  ];
  assert.equal(countActionableOpenTasks(tasks), 3);
});

test("standalone open top-level contributes 1", () => {
  assert.equal(countActionableOpenTasks([task({ id: "crossbow", title: "Call crossbow" })]), 1);
});

test("done child contributes 0", () => {
  const tasks = [
    task({ id: "p" }),
    task({ id: "open", parentId: "p" }),
    task({ id: "done", parentId: "p", status: "done" }),
  ];
  assert.equal(countActionableOpenTasks(tasks), 1);
  assert.deepEqual(
    listActionableOpenTasks(tasks).map((row) => row.id),
    ["open"],
  );
});

test("org-card children count and org-card parents do not", () => {
  const tasks = orgTree();
  assert.equal(countOpenWorkspaceCards(tasks), 2);
  assert.equal(countActionableOpenTasks(tasks), 13);
  assert.equal(
    listActionableOpenTasks(tasks).some((row) => row.id === "week" || row.id === "day"),
    false,
  );
});

test("curated workspace children count and parents do not", () => {
  const pkg = CURATED_PACKAGES[0];
  const tasks = [
    task({ id: pkg.key, title: pkg.title }),
    ...pkg.steps.map((step) => task({ id: step.key, title: step.title, parentId: pkg.key })),
  ];
  assert.equal(countOpenWorkspaceCards(tasks), 1);
  assert.equal(countActionableOpenTasks(tasks), pkg.steps.length);
});

test("current production-shaped tree produces 49 actionable and 11 workspaces", () => {
  const tasks = productionShapedTree();
  assert.equal(tasks.length, 59);
  assert.equal(countActionableOpenTasks(tasks), 49);
  assert.equal(countOpenWorkspaceCards(tasks), 11);
});

test("/plan, /plan/tasks, and /today inbox pulse share the same actionable total", () => {
  const tasks = productionShapedTree();
  const nested = tasks
    .filter((row) => !row.parentId)
    .map((row) => ({
      ...row,
      children: tasks.filter((child) => child.parentId === row.id),
    }));

  const inbox = [
    ...tasks
      .filter((row) => !row.parentId && !["week", "day"].includes(row.id))
      .map((row) => ({
        kind: "task" as const,
        done: false,
        sourceId: row.id,
      })),
    ...tasks
      .filter((row) => row.parentId && !["week", "day"].includes(row.parentId))
      .map((row) => ({
        kind: "task_step" as const,
        done: false,
        sourceId: row.id,
        parentId: row.parentId,
      })),
    ...tasks
      .filter((row) => row.parentId === "week" || row.parentId === "day")
      .map((row) => ({
        kind: "org_step" as const,
        done: false,
        sourceId: row.id,
      })),
  ];

  const plan = countActionableOpenTasks(nested);
  const planTasks = countActionableOpenTasks(nested);
  const today = countActionableOpenInboxTasks(inbox);
  assert.equal(plan, 49);
  assert.equal(planTasks, 49);
  assert.equal(today, 49);
});

test("nested children on a parent list are not double-counted with a flat sibling list", () => {
  const parent = task({
    id: "p",
    children: [task({ id: "c", parentId: "p" })],
  });
  const flatChild = task({ id: "c", parentId: "p" });
  assert.equal(countActionableOpenTasks([parent, flatChild]), 1);
});
