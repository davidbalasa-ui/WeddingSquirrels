import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPlanDomainSummaries, type PlanCounts } from "./plan";
import type { SessionAccount } from "./types";

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

const counts: PlanCounts = {
  tasks: { open: 12, overdue: 2 },
  timeline: { moments: 18 },
  rehearsal: {
    moments: 7,
    mealGuests: 15,
    mealChoices: 11,
    published: true,
  },
  stay: { assigned: 4, total: 10 },
  shopping: { remaining: 6, purchased: 9 },
};

test("buildPlanDomainSummaries returns the five action-oriented Plan domains", () => {
  const rows = buildPlanDomainSummaries(session(), counts);
  assert.deepEqual(
    rows.map((row) => row.key),
    ["tasks", "timeline", "rehearsal", "stay", "shopping"],
  );
  assert.equal(rows[0]?.detail, "12 open · 2 overdue");
  assert.equal(rows[4]?.href, "/plan/shopping");
});

test("buildPlanDomainSummaries respects PIN permissions", () => {
  const rows = buildPlanDomainSummaries(
    session({
      canSeeTimeline: false,
      canSeeDinner: false,
      canSeeStay: false,
      canSeeShop: false,
      canSeeCalendar: false,
    }),
    counts,
  );
  assert.deepEqual(rows.map((row) => row.key), ["tasks"]);
});

test("Plan task details use calm empty-state language", () => {
  const rows = buildPlanDomainSummaries(session(), {
    ...counts,
    tasks: { open: 0, overdue: 0 },
  });
  assert.equal(rows.find((row) => row.key === "tasks")?.detail, "0 open · nothing overdue");
});
