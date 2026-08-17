import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isRequestUnread,
  readMarkersForParticipant,
  unreadMarkersForAuthor,
  unreadRequestsWhere,
} from "./requests";
import type { SessionAccount } from "./types";

function session(overrides: Partial<SessionAccount> = {}): SessionAccount {
  return {
    id: "pam",
    name: "Pam",
    isMaster: false,
    canSeeTasks: false,
    canSeeBudget: false,
    canSeeGuests: true,
    canSeeTimeline: false,
    canManageAccounts: false,
    canSeeShop: false,
    canSeeCalendar: false,
    canSeePeople: false,
    canSeeRequests: true,
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

test("recipient sees unread asks until read", () => {
  const row = {
    id: "1",
    status: "open",
    senderAccountId: "david",
    recipientAccountId: "pam",
    readAt: null,
    senderReadAt: new Date(),
  };
  assert.equal(isRequestUnread(session(), row), true);
});

test("sender sees unread when recipient replies", () => {
  const row = {
    id: "1",
    status: "open",
    senderAccountId: "pam",
    recipientAccountId: "david",
    readAt: new Date(),
    senderReadAt: null,
  };
  assert.equal(isRequestUnread(session(), row), true);
});

test("reply markers notify the other participant", () => {
  const pamReply = unreadMarkersForAuthor("pam", {
    senderAccountId: "pam",
    recipientAccountId: "david",
  });
  assert.equal(pamReply.readAt, null);
  assert.ok(pamReply.senderReadAt instanceof Date);

  const davidReply = unreadMarkersForAuthor("david", {
    senderAccountId: "pam",
    recipientAccountId: "david",
  });
  assert.ok(davidReply.readAt instanceof Date);
  assert.equal(davidReply.senderReadAt, null);
});

test("unreadRequestsWhere includes both sides of a thread", () => {
  const where = unreadRequestsWhere(session());
  assert.ok(Array.isArray(where.OR));
  assert.equal(where.OR?.length, 2);
});

test("readMarkersForParticipant updates the current side", () => {
  const markers = readMarkersForParticipant(session(), {
    senderAccountId: "other",
    recipientAccountId: "pam",
  });
  assert.ok(markers.readAt instanceof Date);
  assert.equal(markers.senderReadAt, undefined);
});
