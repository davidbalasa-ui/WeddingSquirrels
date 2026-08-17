import assert from "node:assert/strict";
import { test } from "node:test";
import type { SessionAccount } from "@/lib/types";
import { canSeeRoute, firstAllowedRoute } from "./routes";

function session(overrides: Partial<SessionAccount> = {}): SessionAccount {
  return {
    id: "test",
    name: "Test",
    isMaster: false,
    canSeeTasks: false,
    canSeeBudget: false,
    canSeeGuests: false,
    canSeeTimeline: false,
    canManageAccounts: false,
    canSeeShop: false,
    canSeeCalendar: false,
    canSeePeople: false,
    canSeeRequests: false,
    canSeeStay: false,
    canSeeDinner: false,
    canEditBudget: false,
    canEditTimeline: false,
    canEditDinner: false,
    linkedPersonId: null,
    assigneeFilter: null,
    ...overrides,
  };
}

test("firstAllowedRoute lands on the first visible tab", () => {
  assert.equal(firstAllowedRoute(session({ canSeeGuests: true })), "/guests");
  assert.equal(
    firstAllowedRoute(session({ canSeeTasks: true, canSeeGuests: true })),
    "/today",
  );
  assert.equal(firstAllowedRoute(session()), null);
});

test("canSeeRoute honors dinner and accounts rules", () => {
  assert.equal(
    canSeeRoute(session({ canManageAccounts: true }), { href: "/accounts", need: "canManageAccounts" }),
    true,
  );
  assert.equal(
    canSeeRoute(session({ canSeeDinner: true }), { href: "/rehearsal", need: "canSeeDinner" }),
    true,
  );
});
