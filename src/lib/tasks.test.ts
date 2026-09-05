import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assignedToPersonWhere,
  dueDateInputValue,
  dueLabel,
  taskMatchesAssigneeFilter,
} from "./tasks";

test("assignedToPersonWhere is a plain TaskAssignee match, not a couple who-filter", () => {
  assert.deepEqual(assignedToPersonWhere("david"), {
    assignees: { some: { personId: "david" } },
  });
  assert.deepEqual(assignedToPersonWhere("haley"), {
    assignees: { some: { personId: "haley" } },
  });
});

test("taskMatchesAssigneeFilter lets a Shelly-only PIN edit Shelly-owned tasks", () => {
  const filter = ["shelly"];
  assert.equal(
    taskMatchesAssigneeFilter({ assignees: [{ personId: "shelly" }] }, filter),
    true,
  );
  assert.equal(
    taskMatchesAssigneeFilter({ assignees: [{ personId: "david" }, { personId: "haley" }] }, filter),
    false,
  );
  assert.equal(
    taskMatchesAssigneeFilter(
      {
        assignees: [{ personId: "david" }],
        children: [{ assignees: [{ personId: "shelly" }] }],
      },
      filter,
    ),
    true,
  );
});

test("dueDateInputValue accepts Date and ISO strings", () => {
  assert.equal(dueDateInputValue(new Date("2026-09-01T12:00:00")), "2026-09-01");
  assert.equal(dueDateInputValue("2026-09-01T12:00:00.000Z").length, 10);
  assert.equal(dueDateInputValue(null), "");
});

test("dueLabel does not throw when the due date is a string", () => {
  const label = dueLabel("2026-09-01T12:00:00.000Z", "todo");
  assert.ok(label);
});
