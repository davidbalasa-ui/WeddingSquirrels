import assert from "node:assert/strict";
import { test } from "node:test";
import { sortThreadSummaries, summarizeThread, threadCounterpartName, viewThread, type ThreadRow } from "./messages";
import type { SessionAccount } from "./types";

function session(overrides: Partial<SessionAccount> = {}): SessionAccount {
  return {
    id: "haley",
    name: "Haley",
    isMaster: false,
    canSeeTasks: true,
    canSeeBudget: false,
    canSeeGuests: false,
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

const david = { id: "david", name: "David" };
const haley = { id: "haley", name: "Haley" };

function thread(overrides: Partial<ThreadRow> = {}): ThreadRow {
  return {
    id: "r1",
    title: "Pick up the cake stand",
    note: "It's at Shelly's",
    status: "open",
    declineNote: null,
    senderAccountId: "david",
    recipientAccountId: "haley",
    senderAccount: david,
    recipientAccount: haley,
    readAt: new Date("2026-10-05T10:00:00Z"),
    senderReadAt: new Date("2026-10-05T10:00:00Z"),
    createdAt: new Date("2026-10-05T09:00:00Z"),
    updatedAt: new Date("2026-10-05T09:30:00Z"),
    taskId: null,
    task: null,
    messages: [
      { id: "m1", body: "It's at Shelly's", authorAccountId: "david", authorAccount: david, createdAt: new Date("2026-10-05T09:00:00Z") },
      { id: "m2", body: "On it", authorAccountId: "haley", authorAccount: haley, createdAt: new Date("2026-10-05T09:30:00Z") },
      { id: "m3", body: "Thanks! Grab the ribbon too", authorAccountId: "david", authorAccount: david, createdAt: new Date("2026-10-05T10:30:00Z") },
    ],
    ...overrides,
  };
}

test("counterpart is the other participant, or both names for an outsider", () => {
  assert.equal(threadCounterpartName({ id: "haley" }, thread()), "David");
  assert.equal(threadCounterpartName({ id: "david" }, thread()), "Haley");
  assert.equal(threadCounterpartName({ id: "shelly" }, thread()), "David → Haley");
});

test("summary uses the last message and the recipient's unread flag", () => {
  const summary = summarizeThread(session(), thread({ readAt: null }));
  assert.equal(summary.withName, "David");
  assert.equal(summary.lastBody, "Thanks! Grab the ribbon too");
  assert.equal(summary.lastFromMe, false);
  assert.equal(summary.lastAt, "2026-10-05T10:30:00.000Z");
  assert.equal(summary.unread, true);
  assert.equal(summary.messageCount, 3);
});

test("summary falls back to the note when there are no messages", () => {
  const summary = summarizeThread(session(), thread({ messages: [] }));
  assert.equal(summary.lastBody, "It's at Shelly's");
  assert.equal(summary.lastAuthorName, "David");
  assert.equal(summary.lastAt, "2026-10-05T09:30:00.000Z");
});

test("threads sort by newest activity", () => {
  const older = summarizeThread(session(), thread({ id: "old", messages: [] }));
  const newer = summarizeThread(session(), thread({ id: "new" }));
  assert.deepEqual(sortThreadSummaries([older, newer]).map((row) => row.id), ["new", "old"]);
});

test("view marks only the other side's messages after my read marker as new", () => {
  const view = viewThread(session(), thread());
  assert.deepEqual(view.messages.map((m) => [m.id, m.mine, m.isNew]), [
    ["m1", false, false],
    ["m2", true, false],
    ["m3", false, true],
  ]);
  assert.equal(view.canReply, true);
  assert.equal(view.isParticipant, true);
});

test("view for a done thread still allows replies and never flags a master outsider", () => {
  const done = viewThread(session(), thread({ status: "done" }));
  assert.equal(done.canReply, true);
  const outsider = viewThread(session({ id: "shelly", isMaster: true }), thread({ readAt: null, senderReadAt: null }));
  assert.equal(outsider.isParticipant, false);
  assert.equal(outsider.unread, false);
  assert.equal(outsider.messages.some((m) => m.isNew), false);
});
