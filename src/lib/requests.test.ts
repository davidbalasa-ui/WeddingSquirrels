import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canReplyToRequest,
  isMessageNew,
  isRequestUnread,
  readMarkerFor,
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
    canEditRehearsal: false,
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

test("unread survives the ask being marked done", () => {
  const row = {
    id: "1",
    status: "done",
    senderAccountId: "david",
    recipientAccountId: "pam",
    readAt: null,
    senderReadAt: new Date(),
  };
  assert.equal(isRequestUnread(session(), row), true);
});

test("a master is never unread on someone else's thread", () => {
  const row = {
    id: "1",
    status: "open",
    senderAccountId: "david",
    recipientAccountId: "haley",
    readAt: null,
    senderReadAt: null,
  };
  assert.equal(isRequestUnread(session({ isMaster: true }), row), false);
  assert.equal(readMarkerFor(session({ isMaster: true }), row), null);
});

test("a master reading a third-party thread marks nothing", () => {
  const markers = readMarkersForParticipant(session({ isMaster: true }), {
    senderAccountId: "david",
    recipientAccountId: "haley",
  });
  assert.equal(markers.readAt, undefined);
  assert.equal(markers.senderReadAt, undefined);
});

test("an outsider's reply notifies both participants", () => {
  const markers = unreadMarkersForAuthor("master", {
    senderAccountId: "david",
    recipientAccountId: "haley",
  });
  assert.equal(markers.readAt, null);
  assert.equal(markers.senderReadAt, null);
});

test("replies are allowed on done and declined threads", () => {
  for (const status of ["open", "done", "declined"]) {
    assert.equal(
      canReplyToRequest(session(), {
        id: "1",
        status,
        senderAccountId: "pam",
        recipientAccountId: "david",
        readAt: null,
      }),
      true,
      status,
    );
  }
});

test("isMessageNew flags only other people's messages after the read marker", () => {
  const marker = new Date("2026-10-05T10:00:00Z");
  const me = { id: "pam" };
  assert.equal(
    isMessageNew(me, marker, { authorAccountId: "david", createdAt: new Date("2026-10-05T10:05:00Z") }),
    true,
  );
  assert.equal(
    isMessageNew(me, marker, { authorAccountId: "david", createdAt: new Date("2026-10-05T09:55:00Z") }),
    false,
  );
  assert.equal(
    isMessageNew(me, marker, { authorAccountId: "pam", createdAt: new Date("2026-10-05T10:05:00Z") }),
    false,
  );
  assert.equal(
    isMessageNew(me, null, { authorAccountId: "david", createdAt: new Date("2026-10-05T09:00:00Z") }),
    true,
  );
});
