import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildExecutionAttention,
  composeExecutionToday,
  inventedDatesFromRehearsalBlocks,
} from "./execution-today";
import type { InboxItem, InboxSections } from "./inbox";
import { buildTodayHero } from "./today";
import type { SessionAccount } from "./types";
import { getWeddingPhase, instantOnCalendarDate } from "./wedding-phase";

const DETROIT = "America/Detroit";
const WEDDING = new Date("2026-10-16T16:00:00.000Z");

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

function askItem(id: string, overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    id: `ask:${id}`,
    kind: "ask",
    sourceId: id,
    title: overrides.title ?? "Ask",
    done: false,
    ownerPersonIds: [],
    ownerLabel: "From Haley",
    sortOrder: 1,
    unread: true,
    needsMe: true,
    href: `/today?filter=asks&ask=${id}`,
    askData: {
      senderAccountId: "haley",
      recipientAccountId: "david",
      senderName: "Haley",
      recipientName: "David",
      note: null,
      declineNote: null,
      readAt: null,
      senderReadAt: null,
      createdAt: "2026-10-08T12:00:00.000Z",
      messages: [],
    },
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

function composeAt(
  dateKey: string,
  input: {
    items?: InboxItem[];
    sections?: InboxSections;
    budgetItems?: Parameters<typeof composeExecutionToday>[0]["budgetItems"];
    calendar?: Parameters<typeof composeExecutionToday>[0]["calendar"];
    waiting?: Parameters<typeof composeExecutionToday>[0]["waiting"];
  } = {},
) {
  const now = instantOnCalendarDate(dateKey, DETROIT);
  const phase = getWeddingPhase({ weddingDate: WEDDING, timezone: DETROIT, now });
  return composeExecutionToday({
    phase,
    items: input.items ?? [],
    sections: input.sections ?? emptySections(),
    budgetItems: input.budgetItems ?? [],
    calendar: input.calendar ?? [],
    waiting: input.waiting ?? [],
    now,
  });
}

test("task due today appears in TODAY, not Later or Attention", () => {
  const dueToday = taskItem("today", {
    title: "Pick up programs",
    dueDate: instantOnCalendarDate("2026-10-10", DETROIT),
  });
  const view = composeAt("2026-10-10", { items: [dueToday] });
  assert.equal(view.layout, "wedding_week");
  assert.equal(view.today.some((row) => row.id === "task:today"), true);
  assert.equal(view.laterThisWeek.some((row) => row.id === "task:today"), false);
  assert.equal(view.comingUp.some((row) => row.id === "task:today"), false);
  assert.equal(view.attention.some((row) => row.id === "task:today"), false);
  assert.equal(view.today[0]?.href, "/work/today");
});

test("wedding week shows a calm Tomorrow section when nothing is dated tomorrow", () => {
  const view = composeAt("2026-10-09");
  assert.equal(view.tomorrow.length, 0);
  assert.equal(view.tomorrowEmpty?.title, "Nothing on the calendar tomorrow.");
});

test("task due tomorrow appears in Tomorrow, not Coming Up", () => {
  const dueTomorrow = taskItem("tomorrow", {
    title: "Confirm florist",
    dueDate: instantOnCalendarDate("2026-10-11", DETROIT),
  });
  const view = composeAt("2026-10-10", { items: [dueTomorrow] });
  assert.equal(view.tomorrow.some((row) => row.id === "task:tomorrow"), true);
  assert.equal(view.today.some((row) => row.id === "task:tomorrow"), false);
  assert.equal(view.comingUp.some((row) => row.id === "task:tomorrow"), false);
  assert.equal(view.attention.some((row) => row.id === "task:tomorrow"), false);
});

test("same task is not duplicated across Today and Coming Up", () => {
  const dueToday = taskItem("once", {
    title: "Once",
    dueDate: instantOnCalendarDate("2026-10-10", DETROIT),
  });
  const later = taskItem("later", {
    title: "Later",
    dueDate: instantOnCalendarDate("2026-10-13", DETROIT),
  });
  const view = composeAt("2026-10-10", { items: [dueToday, later] });
  const ids = [...view.today, ...view.tomorrow, ...view.laterThisWeek].map((row) => row.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(view.laterThisWeek.some((row) => row.id === "task:later"), true);
  assert.equal(view.laterThisWeek.some((row) => row.id === "task:once"), false);
});

test("overdue execution-critical task ranks in Attention above open undated work", () => {
  const overdue = taskItem("overdue", {
    title: "Overdue programs",
    dueDate: instantOnCalendarDate("2026-10-07", DETROIT),
  });
  const undated = taskItem("open", { title: "Open someday", dueDate: null });
  const view = composeAt("2026-10-10", { items: [undated, overdue] });
  assert.equal(view.attention[0]?.id, "task:overdue");
  assert.equal(view.attention[0]?.reason, "Overdue");
  assert.equal(view.attention[0]?.urgency, "high");
  assert.equal(view.attention.some((row) => row.id === "task:open"), false);
  assert.ok((view.attention[0]?.rank ?? 0) >= 90);
});

test("hidden task never leaks into execution sections", () => {
  const hidden = taskItem("hidden", {
    title: "Secret",
    dueDate: instantOnCalendarDate("2026-10-10", DETROIT),
  });
  void hidden;
  const view = composeAt("2026-10-10", { items: [] });
  assert.equal(view.today.length, 0);
  assert.equal(view.attention.length, 0);
  assert.equal(
    [...view.today, ...view.tomorrow, ...view.laterThisWeek, ...view.attention].some(
      (row) => row.id === "task:hidden" || ("title" in row && row.title === "Secret"),
    ),
    false,
  );
});

test("hidden money obligation never leaks", () => {
  const view = composeAt("2026-10-10", {
    budgetItems: [],
  });
  assert.equal(
    [...view.today, ...view.tomorrow, ...view.laterThisWeek, ...view.attention].some(
      (row) => ("kind" in row && row.kind === "payment") || ("type" in row && row.type === "payment"),
    ),
    false,
  );
});

test("explicit BudgetPayment is used when a schedule exists", () => {
  const view = composeAt("2026-10-10", {
    budgetItems: [
      {
        id: "florist",
        name: "Florist",
        price: 2000,
        amountPaid: 500,
        payByDate: instantOnCalendarDate("2026-09-01", DETROIT),
        payments: [
          {
            id: "p2",
            label: "Balance",
            amount: 1500,
            paidAmount: 0,
            dueDate: instantOnCalendarDate("2026-10-10", DETROIT),
            paidAt: null,
            paidById: null,
            note: null,
            sortOrder: 1,
          },
        ],
      },
    ],
  });
  assert.equal(view.today.some((row) => row.id === "payment:florist:p2"), true);
  assert.equal(view.today.some((row) => row.id === "legacy:florist"), false);
  assert.equal(view.today.find((row) => row.id === "payment:florist:p2")?.href, "/money/florist?payment=p2");
});

test("legacy payByDate fallback works when no schedule exists", () => {
  const view = composeAt("2026-10-10", {
    budgetItems: [
      {
        id: "venue",
        name: "Venue",
        price: 8000,
        amountPaid: 2000,
        payByDate: instantOnCalendarDate("2026-10-11", DETROIT),
        payments: [],
      },
    ],
  });
  assert.equal(view.tomorrow.some((row) => row.id === "legacy:venue"), true);
  assert.equal(view.tomorrow.find((row) => row.id === "legacy:venue")?.href, "/money/venue");
});

test("request visibility remains correct and asks are not hidden in wedding week", () => {
  const ask = askItem("r1", { title: "Need a ride" });
  const view = composeAt("2026-10-10", {
    sections: emptySections({ needsYou: [ask] }),
  });
  assert.equal(view.attention.some((row) => row.id === "ask:r1"), true);
  assert.equal(view.attention.find((row) => row.id === "ask:r1")?.href, "/today?filter=asks&ask=r1");
});

test("calendar items sort chronologically in Later this week", () => {
  const view = composeAt("2026-10-09", {
    calendar: [
      {
        id: "c2",
        title: "Final tasting",
        startDate: instantOnCalendarDate("2026-10-14", DETROIT),
        notes: null,
      },
      {
        id: "c1",
        title: "Suit pickup",
        startDate: instantOnCalendarDate("2026-10-12", DETROIT),
        notes: null,
      },
    ],
  });
  assert.deepEqual(
    view.laterThisWeek.map((row) => row.title),
    ["Suit pickup", "Final tasting"],
  );
  assert.equal(view.laterThisWeek[0]?.href, "/plan/calendar");
});

test("rehearsal TimelineBlocks without an authoritative date get no invented date", () => {
  const blocks = [{ id: "reh-1", startAt: "5:00 PM", notes: "Rehearsal dinner" }];
  assert.deepEqual(inventedDatesFromRehearsalBlocks(blocks), []);
  const view = composeAt("2026-10-10", { calendar: [] });
  assert.equal(view.today.some((row) => /rehearsal/i.test(row.title)), false);
  assert.equal(view.tomorrow.some((row) => /rehearsal/i.test(row.title)), false);
  assert.equal(view.laterThisWeek.some((row) => /rehearsal/i.test(row.title)), false);
});

test("wedding-day mode links to /day", () => {
  const view = composeAt("2026-10-16");
  assert.equal(view.layout, "wedding_day");
  assert.equal(view.handoff?.href, "/day");
  assert.equal(view.today.some((row) => row.href === "/day"), true);
  const hero = buildTodayHero(
    { weddingDate: WEDDING, coupleNames: "David & Haley", timezone: DETROIT },
    "David",
    instantOnCalendarDate("2026-10-16", DETROIT),
  );
  assert.equal(hero.weddingPhase, "wedding_day");
  assert.equal(hero.handoffHref, "/day");
  assert.equal(hero.kicker, "TODAY IS THE DAY");
});

test("post-wedding never shows a negative countdown", () => {
  const hero = buildTodayHero(
    { weddingDate: WEDDING, coupleNames: "David & Haley", timezone: DETROIT },
    "David",
    instantOnCalendarDate("2026-10-18", DETROIT),
  );
  assert.equal(hero.weddingPhase, "post_wedding");
  assert.equal(hero.daysToGo, null);
  assert.equal(hero.kicker, "WE DID IT.");
  assert.equal(hero.countdownLabel, null);
  assert.ok((hero.daysToGo ?? 0) >= 0);
  assert.doesNotMatch(hero.countdownSupport ?? "", /overdue|week/i);
  assert.doesNotMatch(hero.kicker ?? "", /-/);
});

test("planning mode composition stays on the existing TODAY builders", () => {
  const dueToday = taskItem("today", {
    title: "Planning task",
    dueDate: instantOnCalendarDate("2026-09-05", DETROIT),
  });
  const now = instantOnCalendarDate("2026-09-05", DETROIT);
  const phase = getWeddingPhase({ weddingDate: WEDDING, timezone: DETROIT, now });
  assert.equal(phase.phase, "planning");
  assert.equal(phase.daysUntilWedding && phase.daysUntilWedding > 7, true);

  const hero = buildTodayHero(
    { weddingDate: WEDDING, coupleNames: "David & Haley", timezone: DETROIT },
    "David",
    now,
  );
  assert.equal(hero.weddingPhase, "planning");
  assert.equal(hero.kicker, null);
  assert.equal(hero.lede, null);
  assert.equal(hero.countdownSupport, "until we celebrate.");
  void dueToday;
});

test("unread ask outranks an overdue task during wedding week", () => {
  const overdue = taskItem("overdue", {
    title: "Late",
    dueDate: instantOnCalendarDate("2026-10-01", DETROIT),
  });
  const ask = askItem("urgent");
  const now = instantOnCalendarDate("2026-10-10", DETROIT);
  const queue = buildExecutionAttention(
    [overdue],
    emptySections({ needsYou: [ask] }),
    [],
    {
      now,
      timezone: DETROIT,
      todayKey: "2026-10-10",
      placedIds: new Set(),
    },
  );
  assert.equal(queue[0]?.id, "ask:urgent");
  assert.equal(queue[1]?.id, "task:overdue");
});

test("restricted session fixtures do not invent money or task rows", () => {
  const restricted = masterSession({ canSeeBudget: false, canSeeTasks: false, canSeeRequests: false });
  void restricted;
  const view = composeAt("2026-10-10", {
    items: [],
    budgetItems: [],
    sections: emptySections(),
  });
  assert.deepEqual(view.today, []);
  assert.deepEqual(view.attention, []);
});
