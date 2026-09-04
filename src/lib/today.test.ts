import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildAttentionQueue,
  buildComingUpList,
  buildPulseStats,
  buildTodayContext,
  buildTodayHero,
  buildWaitingItems,
  buildWeddingWeekPreview,
  daysUntilWedding,
  greetingForHour,
  remainingOnBudgetItem,
  shouldShowWeddingWeek,
  summarizeGuestAttendance,
  todayPersonRef,
} from "./today";
import type { InboxItem, InboxSections } from "./inbox";
import type { SessionAccount } from "./types";

function emptySections(overrides: Partial<InboxSections> = {}): InboxSections {
  return {
    needsYou: [],
    waiting: [],
    open: [],
    openGroups: [],
    openBuy: [],
    orgGroups: [],
    done: [],
    ...overrides,
  };
}

function taskItem(id: string, overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    id: `task:${id}`,
    kind: "task",
    sourceId: id,
    title: overrides.title ?? "Task",
    done: overrides.done ?? false,
    ownerPersonIds: overrides.ownerPersonIds ?? ["david"],
    ownerLabel: overrides.ownerLabel ?? "David",
    sortOrder: 1,
    dueDate: overrides.dueDate,
    escalated: overrides.escalated,
    href: `/work/${id}`,
    ...overrides,
  };
}

function masterSession(overrides: Partial<SessionAccount> = {}): SessionAccount {
  return {
    id: "david",
    name: "David",
    isMaster: true,
    canSeeTasks: true,
    canSeeBudget: true,
    canSeeGuests: true,
    canSeeTimeline: true,
    canManageAccounts: true,
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

test("greetingForHour follows time of day", () => {
  assert.equal(greetingForHour(new Date("2026-08-01T08:00:00")), "Good morning");
  assert.equal(greetingForHour(new Date("2026-08-01T14:00:00")), "Good afternoon");
  assert.equal(greetingForHour(new Date("2026-08-01T20:00:00")), "Good evening");
});

test("buildTodayHero uses AppSettings fields and does not invent venue", () => {
  const hero = buildTodayHero(
    {
      weddingDate: new Date("2026-10-16T12:00:00"),
      coupleNames: "David & Haley",
      timezone: "America/Detroit",
    },
    "David",
    new Date("2026-09-03T12:00:00"),
  );
  assert.equal(hero.coupleNames, "David & Haley");
  assert.match(hero.headline, /David & Haley/);
  assert.equal(hero.daysToGo, 43);
  assert.equal(hero.phase, "future");
  assert.equal(hero.countdownLabel, "43 days");
  assert.equal(hero.countdownSupport, "until we celebrate.");
  assert.equal(hero.venue, null);
  assert.match(hero.weddingDateLabel ?? "", /October 16, 2026/);
});

test("countdown handles future, wedding day, and post-wedding", () => {
  const settings = {
    weddingDate: new Date("2026-10-16T12:00:00"),
    coupleNames: "David & Haley",
    timezone: "America/Detroit",
  };

  const future = buildTodayHero(settings, "Haley", new Date("2026-09-03T15:00:00-04:00"));
  assert.equal(future.phase, "future");
  assert.ok((future.daysToGo ?? -1) > 0);

  const dayOf = buildTodayHero(settings, "Haley", new Date("2026-10-16T09:00:00-04:00"));
  assert.equal(dayOf.phase, "wedding-day");
  assert.equal(dayOf.daysToGo, 0);
  assert.equal(dayOf.countdownLabel, "Today");

  const after = buildTodayHero(settings, "Haley", new Date("2026-10-18T12:00:00-04:00"));
  assert.equal(after.phase, "after");
  assert.equal(after.daysToGo, null);
  assert.ok(after.countdownSupport?.startsWith("Celebrated"));
  assert.ok((after.daysToGo ?? 0) >= 0);
  assert.equal(daysUntilWedding(settings.weddingDate, settings.timezone, new Date("2026-10-18T12:00:00-04:00")) < 0, true);
});

test("higher-priority attention items rank ahead of lower-priority ones", () => {
  const unreadAsk: InboxItem = {
    id: "ask:2",
    kind: "ask",
    sourceId: "2",
    title: "Unread ask",
    done: false,
    ownerPersonIds: [],
    ownerLabel: "From Haley",
    sortOrder: 1,
    unread: true,
    needsMe: true,
    askData: {
      senderAccountId: "haley",
      recipientAccountId: "david",
      senderName: "Haley",
      recipientName: "David",
      note: null,
      declineNote: null,
      readAt: null,
      senderReadAt: null,
      createdAt: "2026-08-08T12:00:00.000Z",
      messages: [],
    },
  };
  const readAsk: InboxItem = {
    id: "ask:1",
    kind: "ask",
    sourceId: "1",
    title: "Read me",
    done: false,
    ownerPersonIds: [],
    ownerLabel: "From Haley",
    sortOrder: 2,
    unread: false,
    needsMe: true,
  };
  const overdue = taskItem("overdue", {
    title: "Overdue task",
    dueDate: new Date("2026-08-01T12:00:00"),
  });

  const queue = buildAttentionQueue(
    [overdue],
    emptySections({ needsYou: [readAsk, unreadAsk] }),
    [],
    { now: new Date("2026-08-10T12:00:00") },
  );

  assert.equal(queue[0]?.title, "Unread ask");
  assert.equal(queue[1]?.reason, "Overdue");
  assert.ok((queue[0]?.rank ?? 0) > (queue[1]?.rank ?? 0));
});

test("attention list respects its maximum", () => {
  const needsYou = Array.from({ length: 5 }, (_, index) => ({
    id: `ask:${index}`,
    kind: "ask" as const,
    sourceId: String(index),
    title: `Ask ${index}`,
    done: false,
    ownerPersonIds: [],
    ownerLabel: "From Haley",
    sortOrder: index,
    unread: true,
    needsMe: true,
  }));
  const overdue = taskItem("overdue", {
    title: "Overdue task",
    dueDate: new Date("2026-08-01T12:00:00"),
  });

  const queue = buildAttentionQueue([overdue], emptySections({ needsYou }), [], {
    max: 2,
    now: new Date("2026-08-10T12:00:00"),
  });

  assert.equal(queue.length, 2);
});

test("overdue items are recognized correctly", () => {
  const overdue = taskItem("overdue", {
    title: "Overdue task",
    dueDate: new Date("2026-08-01T12:00:00"),
  });
  const queue = buildAttentionQueue([overdue], emptySections(), [], {
    now: new Date("2026-08-10T12:00:00"),
  });
  assert.equal(queue[0]?.reason, "Overdue");
  assert.equal(queue[0]?.urgency, "high");
});

test("overdue budget items use remaining balance, not installments", () => {
  const queue = buildAttentionQueue([], emptySections(), [
    {
      id: "b1",
      name: "Photographer",
      price: 3000,
      amountPaid: 750,
      payByDate: new Date("2026-08-01T12:00:00"),
      payments: [],
    },
  ], {
    now: new Date("2026-08-10T12:00:00"),
  });

  assert.equal(queue.length, 1);
  assert.equal(queue[0]?.type, "payment");
  if (queue[0]?.type === "payment") {
    assert.equal(queue[0].title, "Photographer");
    assert.equal(queue[0].amountRemaining, 2250);
    assert.equal(queue[0].name.includes("Final"), false);
  }
  assert.equal(remainingOnBudgetItem({ price: 3000, amountPaid: 750 }), 2250);
});

test("upcoming items sort chronologically", () => {
  const items = buildComingUpList({
    items: [
      taskItem("later", { title: "Later task", dueDate: new Date("2026-10-01T12:00:00") }),
    ],
    calendar: [
      {
        id: "c1",
        title: "Wedding day",
        startDate: new Date("2026-10-16T12:00:00"),
        notes: null,
      },
      {
        id: "c2",
        title: "Bachelor party",
        startDate: new Date("2026-08-21T12:00:00"),
        notes: null,
      },
    ],
    budgetItems: [
      {
        id: "b1",
        name: "Florist",
        price: 900,
        amountPaid: 0,
        payByDate: new Date("2026-09-01T12:00:00"),
        payments: [],
      },
    ],
    now: new Date("2026-08-01T12:00:00"),
    max: 5,
  });

  assert.deepEqual(
    items.map((item) => item.title),
    ["Bachelor party", "Florist", "Later task", "Wedding day"],
  );
});

test("empty datasets produce sensible composition", () => {
  const hero = buildTodayHero(null, "David", new Date("2026-09-03T12:00:00"));
  assert.equal(hero.coupleNames, null);
  assert.equal(hero.venue, null);
  assert.equal(hero.daysToGo, null);

  const attention = buildAttentionQueue([], emptySections(), [], {
    now: new Date("2026-09-03T12:00:00"),
  });
  const waiting = buildWaitingItems(emptySections());
  const comingUp = buildComingUpList({
    items: [],
    calendar: [],
    budgetItems: [],
    now: new Date("2026-09-03T12:00:00"),
  });
  const today = buildTodayContext({
    calendar: [],
    items: [],
    budgetItems: [],
    timeline: [],
    now: new Date("2026-09-03T12:00:00"),
  });

  assert.deepEqual(attention, []);
  assert.deepEqual(waiting, []);
  assert.deepEqual(comingUp, []);
  assert.deepEqual(today, []);
});

test("restricted budget data is not included for an account without access", () => {
  const session = masterSession({ canSeeBudget: false, isMaster: false });
  const stats = buildPulseStats({
    items: [],
    budget: session.canSeeBudget ? { remaining: 1200 } : null,
    rsvp: null,
    session,
  });
  assert.equal(stats.some((stat) => stat.id === "budget-remaining"), false);

  const comingUp = buildComingUpList({
    items: [],
    calendar: [],
    budgetItems: [],
    now: new Date("2026-08-01T12:00:00"),
  });
  assert.equal(comingUp.some((item) => item.kind === "payment"), false);
});

test("restricted tasks and requests are not exposed", () => {
  const session = masterSession({
    canSeeTasks: false,
    canSeeRequests: false,
    canSeeGuests: false,
    isMaster: false,
  });
  const stats = buildPulseStats({
    items: [taskItem("hidden")],
    budget: null,
    rsvp: { accepted: 10, invited: 20 },
    session,
  });
  assert.equal(stats.length, 0);
});

test("linked person references preserve canonical personId behavior", () => {
  const linked = todayPersonRef({ personId: "bri", name: "Someone Else" });
  assert.equal(linked.personId, "bri");
  assert.equal(linked.href, "/people/person:bri");

  const fromAccount = todayPersonRef({ linkedPersonId: "belle_genton", name: "Belle Genton" });
  assert.equal(fromAccount.personId, "belle_genton");
  assert.equal(fromAccount.href, "/people/person:belle_genton");

  const overdue = taskItem("owned", {
    title: "Owned task",
    dueDate: new Date("2026-08-01T12:00:00"),
    ownerPersonIds: ["wendy_rush"],
    ownerLabel: "Wendy Rush",
  });
  const queue = buildAttentionQueue([overdue], emptySections(), [], {
    now: new Date("2026-08-10T12:00:00"),
  });
  assert.equal(queue[0]?.personId, "wendy_rush");
});

test("null-personId legacy rows do not gain inferred identity", () => {
  const inferred = todayPersonRef({ name: "Wendy Rush" });
  assert.equal(inferred.personId, null);
  assert.equal(inferred.href, null);

  const waiting = buildWaitingItems(
    emptySections({
      waiting: [
        {
          id: "ask:legacy",
          kind: "ask",
          sourceId: "legacy",
          title: "Need flowers",
          done: false,
          ownerPersonIds: [],
          ownerLabel: "From Mom",
          sortOrder: 1,
          waitingOnThem: true,
          askData: {
            senderAccountId: "david",
            recipientAccountId: "mom-account",
            senderName: "David",
            recipientName: "Mom",
            note: null,
            declineNote: null,
            readAt: null,
            senderReadAt: null,
            createdAt: "2026-08-08T12:00:00.000Z",
            messages: [],
          },
        },
      ],
    }),
    { accounts: [{ id: "mom-account", name: "Mom", linkedPersonId: null }] },
  );
  assert.equal(waiting[0]?.personId, null);
  assert.match(waiting[0]?.context ?? "", /Mom/);
});

test("buildPulseStats respects module visibility", () => {
  const stats = buildPulseStats({
    items: [taskItem("t1"), taskItem("t2", { done: true })],
    budget: { remaining: 1200, committed: 4000, paid: 2800 },
    rsvp: { accepted: 42, invited: 80 },
    session: masterSession(),
  });

  assert.equal(stats.length, 4);
  assert.equal(stats[0]?.id, "rsvp");
  assert.equal(stats[0]?.value, "42 / 80");
  assert.equal(stats[2]?.href, "/money");

  const emptyMoney = buildPulseStats({
    items: [],
    budget: { remaining: 0, committed: 0, paid: 0 },
    rsvp: null,
    session: masterSession(),
  });
  assert.equal(emptyMoney.some((stat) => stat.id === "budget-remaining"), false);
});

test("shouldShowWeddingWeek is true only within seven days", () => {
  assert.equal(shouldShowWeddingWeek(7), true);
  assert.equal(shouldShowWeddingWeek(0), true);
  assert.equal(shouldShowWeddingWeek(8), false);
  assert.equal(shouldShowWeddingWeek(-1), false);
});

test("summarizeGuestAttendance only counts explicit attending rows", () => {
  const summary = summarizeGuestAttendance([
    { rsvpStatus: "attending", acceptedCount: 2 },
    { rsvpStatus: "pending", acceptedCount: 0 },
  ]);
  assert.equal(summary.attending, 2);
  assert.equal(summary.hasData, true);
});

test("buildWeddingWeekPreview marks the first visible block as next", () => {
  const preview = buildWeddingWeekPreview(
    [
      {
        id: "a",
        startAt: "9:00 AM",
        notes: "Hair and makeup\nDetails",
        startMinutes: 9 * 60,
        dayOffset: 0,
        sortOrder: 0,
      },
      {
        id: "b",
        startAt: "3:30 PM",
        notes: "Ceremony",
        startMinutes: 15 * 60 + 30,
        dayOffset: 0,
        sortOrder: 1,
      },
    ],
    { daysToGo: 0, now: new Date("2026-10-16T10:00:00"), limit: 2 },
  );

  assert.equal(preview.length, 1);
  assert.equal(preview[0]?.isNext, true);
  assert.equal(preview[0]?.title, "Ceremony");
});

test("TODAY uses explicit payment schedule when present", () => {
  const now = new Date("2026-08-10T12:00:00");
  const item = {
    id: "b1",
    name: "Photographer",
    price: 4500,
    amountPaid: 2250,
    payByDate: new Date("2026-08-01T12:00:00"),
    payments: [
      {
        id: "p1",
        label: "Deposit",
        amount: 2250,
        paidAmount: 2250,
        dueDate: new Date("2026-07-01T12:00:00"),
        paidAt: null,
        paidById: null,
        note: null,
        sortOrder: 0,
      },
      {
        id: "p2",
        label: "Final payment",
        amount: 2250,
        paidAmount: 0,
        dueDate: new Date("2026-08-01T12:00:00"),
        paidAt: null,
        paidById: null,
        note: null,
        sortOrder: 1,
      },
    ],
  };
  const queue = buildAttentionQueue([], emptySections(), [item], { now });
  assert.equal(queue.length, 1);
  assert.equal(queue[0]?.id, "payment:b1:p2");
  if (queue[0]?.type === "payment") {
    assert.equal(queue[0].amountRemaining, 2250);
    assert.equal(queue[0].context, "Final payment · $2,250");
  }
});

test("TODAY falls back to legacy payByDate when no schedule exists", () => {
  const queue = buildAttentionQueue([], emptySections(), [
    {
      id: "b1",
      name: "Photographer",
      price: 3000,
      amountPaid: 750,
      payByDate: new Date("2026-08-01T12:00:00"),
      payments: [],
    },
  ], { now: new Date("2026-08-10T12:00:00") });
  assert.equal(queue.length, 1);
  assert.equal(queue[0]?.id, "legacy:b1");
  if (queue[0]?.type === "payment") {
    assert.equal(queue[0].amountRemaining, 2250);
  }
});

test("TODAY does not duplicate money obligations", () => {
  const queue = buildAttentionQueue([], emptySections(), [
    {
      id: "b1",
      name: "Photographer",
      price: 4500,
      amountPaid: 2250,
      payByDate: new Date("2026-08-01T12:00:00"),
      payments: [
        {
          id: "p2",
          label: "Final payment",
          amount: 2250,
          paidAmount: 0,
          dueDate: new Date("2026-08-01T12:00:00"),
          paidAt: null,
          paidById: null,
          note: null,
          sortOrder: 0,
        },
      ],
    },
  ], { now: new Date("2026-08-10T12:00:00") });
  assert.equal(queue.length, 1);
  assert.equal(queue.some((item) => item.id.startsWith("legacy:")), false);
});
