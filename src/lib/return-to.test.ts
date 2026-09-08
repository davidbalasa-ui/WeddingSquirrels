import assert from "node:assert/strict";
import { test } from "node:test";
import {
  planTasksPath,
  safeReturnTo,
  TASKS_HOME,
  taskWorkspaceBackLabel,
  withReturnTo,
} from "./return-to";

test("safeReturnTo allows internal app routes and rejects open redirects", () => {
  assert.equal(safeReturnTo("/plan/tasks"), "/plan/tasks");
  assert.equal(safeReturnTo("/today?filter=tasks"), "/today?filter=tasks");
  assert.equal(safeReturnTo("/people/person%3Adavid"), "/people/person:david");
  assert.equal(safeReturnTo("/money/abc"), "/money/abc");
  assert.equal(safeReturnTo("/plan/timeline"), "/plan/timeline");
  assert.equal(safeReturnTo("/plan/shopping"), "/plan/shopping");
  assert.equal(safeReturnTo(null), TASKS_HOME);
  assert.equal(safeReturnTo(""), TASKS_HOME);
  assert.equal(safeReturnTo("https://evil.example/phish"), TASKS_HOME);
  assert.equal(safeReturnTo("//evil.example"), TASKS_HOME);
  assert.equal(safeReturnTo("/\\evil.example"), TASKS_HOME);
  assert.equal(safeReturnTo("https://example.com"), TASKS_HOME);
  assert.equal(safeReturnTo("/login"), TASKS_HOME);
});

test("withReturnTo appends a sanitized returnTo query", () => {
  assert.equal(withReturnTo("/work/t1", "/plan/tasks"), "/work/t1?returnTo=%2Fplan%2Ftasks");
  assert.equal(
    withReturnTo("/work/t1", "/today?filter=tasks"),
    "/work/t1?returnTo=%2Ftoday%3Ffilter%3Dtasks",
  );
  assert.equal(withReturnTo("/work/t1", "https://evil.example"), "/work/t1?returnTo=%2Fplan%2Ftasks");
});

test("back label stays generic except for Task home", () => {
  assert.equal(taskWorkspaceBackLabel("/plan/tasks"), "← Back to Tasks");
  assert.equal(taskWorkspaceBackLabel("/today?filter=tasks"), "← Back");
  assert.equal(taskWorkspaceBackLabel("/people/person:david"), "← Back");
  assert.equal(planTasksPath("open"), "/plan/tasks");
  assert.equal(planTasksPath("soon"), "/plan/tasks?view=soon");
});
