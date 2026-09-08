import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseWorkReturn,
  resolveWorkReturn,
  workBackLabel,
  workHrefWithFrom,
  WORK_RETURN_FALLBACK,
} from "./work-return";

test("source-aware workspace Back behavior works", () => {
  assert.deepEqual(resolveWorkReturn("/today"), { href: "/today", label: "Today" });
  assert.deepEqual(resolveWorkReturn("/today?filter=tasks"), {
    href: "/today?filter=tasks",
    label: "Today",
  });
  assert.deepEqual(resolveWorkReturn("/plan/tasks"), {
    href: "/plan/tasks",
    label: "Plan Tasks",
  });
  assert.deepEqual(resolveWorkReturn("/plan/tasks?view=soon"), {
    href: "/plan/tasks?view=soon",
    label: "Plan Tasks",
  });
  assert.deepEqual(resolveWorkReturn("/people"), { href: "/people", label: "People" });
  assert.deepEqual(resolveWorkReturn("/people/person%3Adavid"), {
    href: "/people/person%3Adavid",
    label: "People",
  });
  assert.deepEqual(resolveWorkReturn("/money/budget_booze"), {
    href: "/money/budget_booze",
    label: "Money",
  });
  assert.deepEqual(resolveWorkReturn("/plan/timeline"), {
    href: "/plan/timeline",
    label: "Wedding Day",
  });
  assert.deepEqual(resolveWorkReturn("/plan/shopping"), {
    href: "/plan/shopping",
    label: "Shopping",
  });
  assert.equal(workBackLabel(resolveWorkReturn("/today")), "← Back to Today");
  assert.equal(workBackLabel(resolveWorkReturn("/plan/tasks")), "← Back to Plan Tasks");
});

test("direct /work/{id} fallback goes to /plan/tasks", () => {
  assert.deepEqual(resolveWorkReturn(null), WORK_RETURN_FALLBACK);
  assert.deepEqual(resolveWorkReturn(undefined), WORK_RETURN_FALLBACK);
  assert.deepEqual(resolveWorkReturn(""), WORK_RETURN_FALLBACK);
  assert.deepEqual(parseWorkReturn(null), null);
  assert.equal(workBackLabel(resolveWorkReturn(null)), "← Back to Plan Tasks");
});

test("unsafe/external return destinations are rejected", () => {
  const rejected = [
    "https://evil.example",
    "http://evil.example/today",
    "//evil.example",
    "/\\evil.example",
    "/today/../../../etc/passwd",
    "javascript:alert(1)",
    "/plan/not-a-chapter",
    "/login",
    "/work/other",
    "/api/secret",
    "today",
  ];
  for (const from of rejected) {
    assert.equal(parseWorkReturn(from), null, from);
    assert.deepEqual(resolveWorkReturn(from), WORK_RETURN_FALLBACK, from);
  }
});

test("workHrefWithFrom only appends a safe from query to /work links", () => {
  assert.equal(workHrefWithFrom("/work/abc", "/today"), "/work/abc?from=%2Ftoday");
  assert.equal(
    workHrefWithFrom("/work/abc", "/plan/tasks?view=mine"),
    "/work/abc?from=%2Fplan%2Ftasks%3Fview%3Dmine",
  );
  assert.equal(workHrefWithFrom("/work/abc", "https://evil.example"), "/work/abc");
  assert.equal(workHrefWithFrom("/people/person%3Adavid", "/today"), "/people/person%3Adavid");
  assert.equal(workHrefWithFrom("/work/abc?from=/today", "/plan/tasks"), "/work/abc?from=/today");
});
