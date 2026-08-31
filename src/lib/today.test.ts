import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildAttentionQueue,
  buildComingUpList,
  buildPulseStats,
  buildTodayHero,
  buildWeddingWeekPreview,
  greetingForHour,
  shouldShowWeddingWeek,
  summarizeGuestAttendance,
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
    ownerPersonIds: ["david"],
    ownerLabel: "David",
    sortOrder: 1,
    dueDate: overrides.dueDate,
    escalated: overrides.escalated,
    href: `/work/${id}`,
    ...overrides,
  };
}

test("greetingForHour follows time of day", () => {
  assert.equal(greetingForHour(new Date("2026-08-01T08:00:00")), "Good morning");
  assert.equal(greetingForHour(new Date("2026-08-01T14:00:00")), "Good afternoon");
  assert.equal(greetingForHour(new Date("2026-08-01T20:00:00")), "Good evening");
});

test("buildTodayHero uses AppSettings fields", () => {
  const hero = buildTodayHero(
    {
      weddingDate: new Date("2026-10-16T12:00:00"),
      coupleNames: "David & Haley",
      timezone: "America/Detroit",
    },
    "David",
    new Date("2026-10-01T12:00:00"),
  );
  assert.equal(hero.coupleNames, "David & Haley");
  assert.equal(hero.daysToGo, 15);
  assert.match(hero.greeting, /^Good /);
  assert.match(hero.weddingDateLabel ?? "", /October 16, 2026/);
});

test("buildAttentionQueue prioritizes unread asks and caps at max", () => {
  const needsYou: InboxItem[] = [
    {
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
    },
    {
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
    },
  ];

  const overdue = taskItem("overdue", {
    title: "Overdue task",
    dueDate: new Date("2026-08-01T12:00:00"),
  });

  const queue = buildAttentionQueue([overdue], emptySections({ needsYou }), [], {
    max: 2,
    now: new Date("2026-08-10T12:00:00"),
  });

  assert.equal(queue.length, 2);
  assert.equal(queue[0]?.type, "inbox");
  if (queue[0]?.type === "inbox") assert.equal(queue[0].item.id, "ask:2");
});

test("buildAttentionQueue includes overdue payments", () => {
  const queue = buildAttentionQueue(
    [],
    emptySections(),
    [
      {
        id: "b1",
        name: "Photographer",
        price: 1000,
        amountPaid: 200,
        payByDate: new Date("2026-08-01T12:00:00"),
      },
    ],
    { now: new Date("2026-08-10T12:00:00") },
  );

  assert.equal(queue.length, 1);
  assert.equal(queue[0]?.type, "payment");
});

test("buildPulseStats respects module visibility", () => {
  const session: SessionAccount = {
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
  };

  const stats = buildPulseStats({
    items: [taskItem("t1"), taskItem("t2", { done: true })],
    budget: { remaining: 1200 },
    guestSummary: { attending: 42, hasData: true },
    session,
  });

  assert.equal(stats.length, 4);
  assert.equal(stats[0]?.value, "1");
  assert.equal(stats[2]?.href, "/money");
});

test("buildComingUpList sorts upcoming items by date", () => {
  const items = buildComingUpList({
    items: [],
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
    budgetItems: [],
    orgParents: [],
    now: new Date("2026-08-01T12:00:00"),
    max: 5,
  });

  assert.equal(items[0]?.title, "Bachelor party");
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
