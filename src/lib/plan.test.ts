import assert from "node:assert/strict";
import { test } from "node:test";
import type { SessionAccount } from "./types";
import {
  buildPlanDomainSummaries,
  parsePlanTaskView,
  summarizeCalendarEvents,
  summarizeRehearsal,
  summarizeShoppingItems,
  summarizeStayOccupancy,
  summarizeVisibleTasks,
  summarizeWeddingTimeline,
  taskIsDueSoon,
  taskIsOverdue,
  taskMatchesMine,
  upcomingCalendarEvents,
  type PlanCounts,
} from "./plan";

function session(overrides: Partial<SessionAccount> = {}): SessionAccount {
  return {
    id: "david",
    name: "David",
    isMaster: false,
    canSeeTasks: true,
    canSeeBudget: true,
    canSeeGuests: true,
    canSeeTimeline: true,
    canManageAccounts: false,
    canSeeShop: true,
    canSeeCalendar: true,
    canSeePeople: true,
    canSeeRequests: true,
    canSeeStay: true,
    canSeeDinner: true,
    canEditBudget: true,
    canEditTimeline: true,
    canEditDinner: true,
    canEditRehearsal: true,
    linkedPersonId: "david",
    assigneeFilter: null,
    ...overrides,
  };
}

const now = new Date("2026-09-04T15:00:00");

const populated: PlanCounts = {
  tasks: { open: 18, overdue: 0, dueSoon: 4 },
  timeline: { moments: 42, nextLabel: "Getting ready", nextTime: "10:00 AM" },
  rehearsal: { moments: 7, mealGuests: 17, mealChoices: 11, published: true },
  stay: { assigned: 14, total: 18, open: 4 },
  shopping: { remaining: 7, purchased: 3 },
  calendar: { upcoming: 3, nextTitle: "Bachelor party", nextWhen: "Saturday" },
};

test("calendar hub copy uses weekday language without saying next tomorrow", () => {
  const saturday = buildPlanDomainSummaries(session(), populated).find(
    (row) => row.key === "calendar",
  );
  assert.equal(saturday?.detail, "3 upcoming · next Saturday");

  const tomorrow = buildPlanDomainSummaries(session(), {
    calendar: { upcoming: 2, nextTitle: "Bachelor party", nextWhen: "tomorrow" },
  }).find((row) => row.key === "calendar");
  assert.equal(tomorrow?.detail, "2 upcoming · tomorrow");
});

test("buildPlanDomainSummaries returns the six planning chapters with PLAN hrefs", () => {
  const rows = buildPlanDomainSummaries(session(), populated);
  assert.deepEqual(
    rows.map((row) => row.key),
    ["tasks", "timeline", "rehearsal", "stay", "shopping", "calendar"],
  );
  assert.deepEqual(
    rows.map((row) => row.href),
    [
      "/plan/tasks",
      "/plan/timeline",
      "/plan/rehearsal",
      "/plan/stay",
      "/plan/shopping",
      "/plan/calendar",
    ],
  );
  assert.equal(rows[0]?.detail, "18 open · 4 due this week");
  assert.equal(rows[4]?.detail, "7 things left");
});

test("inaccessible domains do not leak summary data even when counts are present", () => {
  const rows = buildPlanDomainSummaries(
    session({
      canSeeTasks: false,
      canSeeTimeline: false,
      canSeeDinner: false,
      canEditDinner: false,
      canEditRehearsal: false,
      canSeeStay: false,
      canSeeShop: false,
      canSeeCalendar: false,
    }),
    populated,
  );
  assert.deepEqual(rows.map((row) => row.key), []);
  assert.equal(rows.some((row) => /\d/.test(row.detail)), false);
});

test("task summary counts only the visible tasks it is given", () => {
  const visible = [
    { dueDate: new Date("2026-09-10T12:00:00") },
    { dueDate: new Date("2026-08-01T12:00:00") },
  ];
  const hidden = [{ dueDate: new Date("2026-01-01T12:00:00") }];
  const counts = summarizeVisibleTasks(visible, now);
  assert.equal(counts.open, 2);
  assert.equal(counts.overdue, 1);
  assert.equal(counts.dueSoon, 1);
  assert.notEqual(counts.open, visible.length + hidden.length);
});

test("overdue and due-soon summaries are deterministic for a fixed now", () => {
  assert.equal(taskIsOverdue(new Date("2026-09-03T18:00:00"), now), true);
  assert.equal(taskIsDueSoon(new Date("2026-09-03T18:00:00"), now), false);
  assert.equal(taskIsDueSoon(new Date("2026-09-04T09:00:00"), now), true);
  assert.equal(taskIsDueSoon(new Date("2026-09-10T12:00:00"), now), true);
  assert.equal(taskIsDueSoon(new Date("2026-09-11T12:00:00"), now), false);
  assert.equal(taskIsOverdue(null, now), false);
  assert.equal(taskIsDueSoon(undefined, now), false);

  const counts = summarizeVisibleTasks(
    [
      { dueDate: new Date("2026-09-01T12:00:00") },
      { dueDate: new Date("2026-09-06T12:00:00") },
      { dueDate: new Date("2026-10-01T12:00:00") },
      { dueDate: null },
    ],
    now,
  );
  assert.deepEqual(counts, { open: 4, overdue: 1, dueSoon: 1 });
});

test("wedding timeline summary uses wedding TimelineBlocks only", () => {
  const summary = summarizeWeddingTimeline([
    { id: "w2", startAt: "6:00 PM", notes: "Ceremony", sortOrder: 2, schedule: "wedding" },
    { id: "r1", startAt: "1:00 PM", notes: "Airbnb check-in", sortOrder: 1, schedule: "rehearsal" },
    { id: "w1", startAt: "10:00 AM", notes: "Getting ready", sortOrder: 1, schedule: "wedding" },
  ]);
  assert.equal(summary.moments, 2);
  assert.equal(summary.nextTime, "10:00 AM");
  assert.equal(summary.nextLabel, "Getting ready");
});

test("rehearsal summary does not count wedding timeline blocks", () => {
  const summary = summarizeRehearsal({
    blocks: [
      { schedule: "wedding" },
      { schedule: "wedding" },
      { schedule: "rehearsal" },
    ],
    courses: [{ id: "dinner", label: "Dinner", options: [{ id: "steak", label: "Steak" }] }],
    guests: [
      { choices: { dinner: "steak" } },
      { choices: { dinner: null } },
    ],
    published: false,
  });
  assert.equal(summary.moments, 1);
  assert.equal(summary.mealGuests, 2);
  assert.equal(summary.mealChoices, 1);

  const row = buildPlanDomainSummaries(session(), {
    rehearsal: summary,
  }).find((item) => item.key === "rehearsal");
  assert.ok(row);
  assert.equal(/friday|saturday|october|2026/i.test(row.detail), false);
});

test("stay assigned and open counts use actual StaySlot occupancy", () => {
  const summary = summarizeStayOccupancy([
    { occupant: "Sarah Smith", optional: false },
    { occupant: "  ", optional: false },
    { occupant: "", optional: false },
    { occupant: "Haley", optional: false },
    { occupant: "", optional: true },
    { occupant: "Extra", optional: true },
  ]);
  assert.equal(summary.total, 4);
  assert.equal(summary.assigned, 2);
  assert.equal(summary.open, 2);
  assert.equal(
    buildPlanDomainSummaries(session(), { stay: summary }).find((row) => row.key === "stay")?.detail,
    "2 of 4 beds assigned",
  );
});

test("shopping remaining count excludes purchased items", () => {
  const summary = summarizeShoppingItems([
    { purchased: false },
    { purchased: true },
    { purchased: false },
    { purchased: true },
    { purchased: true },
  ]);
  assert.deepEqual(summary, { remaining: 2, purchased: 3 });
  assert.equal(
    buildPlanDomainSummaries(session(), { shopping: summary }).find((row) => row.key === "shopping")
      ?.detail,
    "2 things left",
  );
});

test("calendar upcoming items are chronological and ignore past events", () => {
  const events = [
    {
      id: "c",
      title: "Wedding day",
      startDate: new Date("2026-10-16T12:00:00"),
      endDate: new Date("2026-10-16T12:00:00"),
    },
    {
      id: "a",
      title: "Bachelorette party",
      startDate: new Date("2026-08-07T12:00:00"),
      endDate: new Date("2026-08-09T12:00:00"),
    },
    {
      id: "b",
      title: "Bachelor party",
      startDate: new Date("2026-09-05T12:00:00"),
      endDate: new Date("2026-09-07T12:00:00"),
    },
  ];
  const upcoming = upcomingCalendarEvents(events, now);
  assert.deepEqual(
    upcoming.map((event) => event.id),
    ["b", "c"],
  );
  const summary = summarizeCalendarEvents(events, now);
  assert.equal(summary.upcoming, 2);
  assert.equal(summary.nextTitle, "Bachelor party");
  assert.equal(summary.nextWhen, "tomorrow");
});

test("empty domains produce intentional low-data summaries without fake dates or counts", () => {
  const rows = buildPlanDomainSummaries(session(), {
    tasks: { open: 0, overdue: 0, dueSoon: 0 },
    timeline: { moments: 0, nextLabel: null, nextTime: null },
    rehearsal: { moments: 0, mealGuests: 0, mealChoices: 0, published: false },
    stay: { assigned: 0, total: 0, open: 0 },
    shopping: { remaining: 0, purchased: 0 },
    calendar: { upcoming: 0, nextTitle: null, nextWhen: null },
  });

  assert.equal(rows.find((row) => row.key === "tasks")?.detail, "Nothing open right now");
  assert.equal(rows.find((row) => row.key === "timeline")?.detail, "No moments mapped yet");
  assert.equal(
    rows.find((row) => row.key === "rehearsal")?.detail,
    "No walkthrough yet · Dinner not started",
  );
  assert.equal(rows.find((row) => row.key === "stay")?.detail, "Beds are not laid out yet");
  assert.equal(rows.find((row) => row.key === "shopping")?.detail, "List is empty");
  assert.equal(rows.find((row) => row.key === "calendar")?.detail, "Nothing upcoming");

  for (const row of rows) {
    assert.equal(/\b0 (open|moments|beds|upcoming|things)\b/i.test(row.detail), false);
    assert.equal(/\d{1,2}:\d{2}|friday|saturday|october \d+/i.test(row.detail), false);
  }

  assert.deepEqual(summarizeCalendarEvents([], now), {
    upcoming: 0,
    nextTitle: null,
    nextWhen: null,
  });
});

test("task mine matching uses linked personId only", () => {
  assert.equal(
    taskMatchesMine({ assignees: [{ personId: "david" }] }, session()),
    true,
  );
  assert.equal(
    taskMatchesMine({ assignees: [{ personId: "haley" }] }, session()),
    false,
  );
  assert.equal(
    taskMatchesMine(
      { assignees: [{ personId: "shelly" }] },
      session({ linkedPersonId: null, assigneeFilter: ["shelly"] }),
    ),
    true,
  );
});

test("parsePlanTaskView stays in the known task views", () => {
  assert.equal(parsePlanTaskView("soon"), "soon");
  assert.equal(parsePlanTaskView("done"), "done");
  assert.equal(parsePlanTaskView("nope"), "open");
  assert.equal(parsePlanTaskView(undefined), "open");
});
