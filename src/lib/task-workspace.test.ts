import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveAssigneeIds } from "./people";
import { taskHref } from "./entity-links";
import { safeReturnTo, withReturnTo } from "./return-to";

test("resolveAssigneeIds without fallback allows clearing all assignees", async () => {
  const ids = await resolveAssigneeIds([], null);
  assert.deepEqual(ids, []);
});

test("task workspace save redirect target stays on the same task with return context", () => {
  const returnTo = "/today?filter=tasks";
  const safe = safeReturnTo(returnTo);
  const href = taskHref("task-abc", { returnTo: safe });
  assert.equal(href, "/work/task-abc?returnTo=%2Ftoday%3Ffilter%3Dtasks");
  assert.equal(withReturnTo(href, safe), href);
});
