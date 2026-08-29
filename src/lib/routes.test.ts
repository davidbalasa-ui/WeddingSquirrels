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
    canEditRehearsal: false,
    linkedPersonId: null,
    assigneeFilter: null,
    ...overrides,
  };
}

test("firstAllowedRoute lands on Home when the PIN can see Home", () => {
  assert.equal(firstAllowedRoute(session({ isMaster: true })), "/home");
  assert.equal(firstAllowedRoute(session({ canSeeRequests: true })), "/home");
  assert.equal(firstAllowedRoute(session({ canSeeTasks: true, canSeeGuests: true })), "/home");
});

test("firstAllowedRoute keeps shared-money and guests-only landings", () => {
  assert.equal(firstAllowedRoute(session({ canSeeBudget: true })), "/money");
  assert.equal(firstAllowedRoute(session({ canSeeGuests: true })), "/guests");
  assert.equal(firstAllowedRoute(session()), null);
});

test("canSeeRoute honors dinner, accounts, and Home", () => {
  assert.equal(
    canSeeRoute(session({ canManageAccounts: true }), { href: "/accounts", need: "canManageAccounts" }),
    true,
  );
  assert.equal(
    canSeeRoute(session({ canSeeDinner: true }), { href: "/rehearsal", need: "canSeeDinner" }),
    true,
  );
  assert.equal(
    canSeeRoute(session({ canSeeRequests: true }), { href: "/home", need: "canSeeHome" }),
    true,
  );
  assert.equal(
    canSeeRoute(session({ canSeeBudget: true }), { href: "/home", need: "canSeeHome" }),
    false,
  );
});
