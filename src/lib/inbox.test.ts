import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildWhoChips,
  canSeeHome,
  detailFromTaskPackage,
  filterInboxSections,
  groupInboxItems,
  inboxDateLine,
  nextCoupleOwnerIds,
  nextShoppingOwnerId,
  type InboxItem,
  type InboxSections,
} from "./inbox";
import type { SessionAccount } from "./types";

function session(overrides: Partial<SessionAccount> = {}): SessionAccount {
  return {
    id: "test",
    name: "Test",
    isMaster: false,
    canSeeTasks: true,
    canSeeBudget: false,
    canSeeGuests: false,
    canSeeTimeline: false,
    canManageAccounts: false,
    canSeeShop: true,
    canSeeCalendar: true,
    canSeePeople: true,
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

function askItem(
  id: string,
  opts: Partial<InboxItem> & { senderId?: string; recipientId?: string } = {},
): InboxItem {
  const senderId = opts.senderId ?? "david";
  const recipientId = opts.recipientId ?? "test";
  return {
    id: `ask:${id}`,
    kind: "ask",
    sourceId: id,
    title: opts.title ?? "Ask",
    done: opts.done ?? false,
    declined: opts.declined ?? false,
    ownerPersonIds: [],
    ownerLabel: "From David",
    sortOrder: 1,
    needsMe: opts.needsMe,
    waitingOnThem: opts.waitingOnThem,
    unread: opts.unread,
    askData: {
      senderAccountId: senderId,
      recipientAccountId: recipientId,
      senderName: "David",
      recipientName: "Test",
      note: null,
      declineNote: null,
      readAt: null,
      senderReadAt: null,
      createdAt: new Date().toISOString(),
      messages: [],
    },
    ...opts,
  };
}

test("canSeeHome requires at least one home module flag", () => {
  assert.equal(canSeeHome(session()), true);
  assert.equal(canSeeHome(session({ canSeeTasks: false, canSeeShop: false, canSeeRequests: false })), false);
  assert.equal(canSeeHome(session({ canSeeTasks: false, canSeeShop: false, canSeeRequests: false, canSeeBudget: true })), false);
  assert.equal(canSeeHome(session({ isMaster: true, canSeeTasks: false, canSeeShop: false, canSeeRequests: false })), true);
});

test("nextCoupleOwnerIds refuses non-couple owners", () => {
  assert.equal(nextCoupleOwnerIds(["shelly"]), null);
  assert.deepEqual(nextCoupleOwnerIds([]), ["david"]);
  assert.deepEqual(nextCoupleOwnerIds(["david"]), ["haley"]);
  assert.deepEqual(nextCoupleOwnerIds(["haley"]), ["david", "haley"]);
  assert.deepEqual(nextCoupleOwnerIds(["david", "haley"]), ["david"]);
});

test("nextShoppingOwnerId cycles unset david haley", () => {
  assert.equal(nextShoppingOwnerId(null), "david");
  assert.equal(nextShoppingOwnerId("david"), "haley");
  assert.equal(nextShoppingOwnerId("haley"), null);
});

test("groupInboxItems keeps needs-you asks after read (role-based)", () => {
  const items: InboxItem[] = [
    askItem("1", { needsMe: true, unread: true }),
    askItem("2", { needsMe: true, unread: false }),
    askItem("3", { waitingOnThem: true, senderId: "test", recipientId: "david" }),
    askItem("4", { done: true }),
    askItem("5", { declined: true }),
  ];
  const grouped = groupInboxItems(items, session());
  assert.equal(grouped.needsYou.length, 2);
  assert.equal(grouped.waiting.length, 1);
  assert.equal(grouped.done.length, 2);
  assert.ok(grouped.done.some((i) => i.declined));
});

test("declined ask is not done", () => {
  const item = askItem("x", { declined: true, done: false });
  const grouped = groupInboxItems([item], session());
  assert.equal(grouped.done.length, 1);
  assert.equal(grouped.done[0]!.done, false);
  assert.equal(grouped.done[0]!.declined, true);
});

test("who=both means different things per kind", () => {
  const sections: InboxSections = {
    needsYou: [],
    waiting: [],
    open: [
      {
        id: "task:1",
        kind: "task",
        sourceId: "1",
        title: "Couple task",
        done: false,
        ownerPersonIds: ["david", "haley"],
        ownerLabel: "Both",
        sortOrder: 0,
      },
      {
        id: "task:2",
        kind: "task",
        sourceId: "2",
        title: "David task",
        done: false,
        ownerPersonIds: ["david"],
        ownerLabel: "David",
        sortOrder: 1,
      },
      {
        id: "buy:1",
        kind: "buy",
        sourceId: "b1",
        title: "Batteries",
        done: false,
        ownerPersonIds: [],
        ownerLabel: "Both",
        sortOrder: 0,
      },
    ],
    orgGroups: [],
    done: [],
  };
  const filtered = filterInboxSections(sections, {
    filter: null,
    who: "both",
    showDone: false,
    session: session(),
    accounts: [],
  });
  assert.equal(filtered.open.length, 2);
  const onlyDavid = filterInboxSections(sections, {
    filter: null,
    who: "david",
    showDone: false,
    session: session(),
    accounts: [],
  });
  assert.equal(onlyDavid.open.length, 1);
  assert.equal(onlyDavid.open[0]!.kind, "task");
});

test("buildWhoChips includes shelly after couple", () => {
  const chips = buildWhoChips([
    { id: "david", name: "David" },
    { id: "haley", name: "Haley" },
    { id: "shelly", name: "Shelly" },
  ]);
  assert.equal(chips[0]!.id, "all");
  assert.ok(chips.some((c) => c.id === "shelly"));
  assert.ok(chips.some((c) => c.id === "both"));
});

test("needs-me filter includes assigneeFilter tasks", () => {
  const sections: InboxSections = {
    needsYou: [],
    waiting: [],
    open: [
      {
        id: "task:s",
        kind: "task",
        sourceId: "s",
        title: "Shelly task",
        done: false,
        ownerPersonIds: ["shelly"],
        ownerLabel: "Shelly",
        sortOrder: 0,
      },
    ],
    orgGroups: [],
    done: [],
  };
  const filtered = filterInboxSections(sections, {
    filter: "needs-me",
    who: "all",
    showDone: false,
    session: session({ assigneeFilter: ["shelly"], canSeeRequests: false }),
    accounts: [],
  });
  assert.equal(filtered.open.length, 1);
});

test("detailFromTaskPackage lists remaining work as plain text, never a steps count", () => {
  const detail = detailFromTaskPackage({
    summary: "Decide look",
    children: [
      { title: "Book stylist", status: "todo", sortOrder: 1 },
      { title: "Done already", status: "done", sortOrder: 0 },
      { title: "Choose style", status: "todo", sortOrder: 2 },
    ],
  });
  assert.equal(detail, "Book stylist · Choose style · Decide look");
  assert.equal(detailFromTaskPackage({ children: [{ title: "X", status: "done", sortOrder: 0 }] }), null);
});

test("inboxDateLine is empty when done or missing", () => {
  assert.equal(inboxDateLine(null, false), null);
  assert.equal(inboxDateLine(new Date("2026-01-01"), true), null);
});
