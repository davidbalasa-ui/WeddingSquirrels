import assert from "node:assert/strict";
import { test } from "node:test";
import { canManageDayOfContacts, canSeeContactRecords, timelineEditable } from "./access";
import type { SessionAccount } from "./types";

function session(overrides: Partial<SessionAccount> = {}): SessionAccount {
  return {
    id: "pin-1",
    name: "Reader",
    isMaster: false,
    canSeeTasks: true,
    canSeeBudget: false,
    canSeeGuests: true,
    canSeeTimeline: true,
    canManageAccounts: false,
    canSeeShop: false,
    canSeeCalendar: true,
    canSeePeople: true,
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

test("Day-of Contact management stays limited to people editors with timeline edit", () => {
  assert.equal(canManageDayOfContacts(session()), false);
  assert.equal(canManageDayOfContacts(session({ canSeePeople: true, canEditTimeline: false })), false);
  assert.equal(canManageDayOfContacts(session({ canSeePeople: false, canEditTimeline: true })), false);
  assert.equal(canManageDayOfContacts(session({ canSeePeople: false, isMaster: true })), false);
  assert.equal(canManageDayOfContacts(session({ canSeePeople: true, canEditTimeline: true })), true);
  assert.equal(canManageDayOfContacts(session({ canSeePeople: true, isMaster: true })), true);
  assert.equal(timelineEditable(session({ isMaster: true })), true);
});

test("contact records follow the same gate as the People hub", () => {
  assert.equal(canSeeContactRecords(session({ canSeeTimeline: false, canSeeGuests: false })), false);
  assert.equal(canSeeContactRecords(session({ canSeeTimeline: true, canSeeGuests: false })), true);
  assert.equal(canSeeContactRecords(session({ canSeeTimeline: false, canSeeGuests: true })), true);
});
