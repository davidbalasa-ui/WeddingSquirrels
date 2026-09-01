import { differenceInCalendarDays, startOfDay } from "date-fns";
import { prisma } from "@/lib/db";
import { buildMoneyDueItems } from "@/lib/money";
import { loadVisibleBudgetContracts } from "@/lib/money-page";
import { parseDayOfTime, sortTimelineBlocks } from "@/lib/day-of-time";
import {
  groupInboxItems,
  listInboxItems,
  loadInboxPageData,
  type InboxItem,
  type InboxSections,
} from "@/lib/inbox";
import { dueLabel } from "@/lib/tasks";
import type { SessionAccount } from "@/lib/types";

export type TodayHeroData = {
  greeting: string;
  coupleNames: string | null;
  weddingDate: Date | null;
  timezone: string;
  daysToGo: number | null;
  weddingDateLabel: string | null;
};

export type TodayAttentionInbox = {
  type: "inbox";
  id: string;
  item: InboxItem;
  urgency: "high" | "normal";
  reason: string;
};

export type TodayAttentionPayment = {
  type: "payment";
  id: string;
  budgetItemId: string;
  name: string;
  amountRemaining: number;
  dueDate: Date;
  urgency: "high" | "normal";
  reason: string;
};

export type TodayAttentionItem = TodayAttentionInbox | TodayAttentionPayment;

export type TodayPulseStat = {
  id: string;
  label: string;
  value: string;
  href: string;
};

export type TodayComingUpItem = {
  id: string;
  kind: "calendar" | "task" | "payment" | "org";
  title: string;
  date: Date;
  href?: string;
  subtitle?: string;
};

export type TodayTimelinePreview = {
  id: string;
  startAt: string;
  title: string;
  isNext: boolean;
};

export type BudgetItemSnapshot = {
  id: string;
  name: string;
  price: number;
  amountPaid: number;
  payByDate: Date | null;
};

export type TodayPageData = Awaited<ReturnType<typeof loadTodayPageData>>;

export function greetingForHour(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function formatWeddingDateLabel(date: Date, timezone: string): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: timezone,
  });
}

export function buildTodayHero(
  settings: { weddingDate: Date; coupleNames: string; timezone: string } | null,
  sessionName: string,
  now = new Date(),
): TodayHeroData {
  const timezone = settings?.timezone ?? "America/Detroit";
  const weddingDate = settings?.weddingDate ?? null;
  const daysToGo = weddingDate ? differenceInCalendarDays(weddingDate, startOfDay(now)) : null;

  return {
    greeting: `${greetingForHour(now)}, ${sessionName.split(" ")[0]}`,
    coupleNames: settings?.coupleNames ?? null,
    weddingDate,
    timezone,
    daysToGo,
    weddingDateLabel: weddingDate ? formatWeddingDateLabel(weddingDate, timezone) : null,
  };
}

function isOverdue(date: Date, today = startOfDay(new Date())): boolean {
  return startOfDay(date) < today;
}

function isDueToday(date: Date, today = startOfDay(new Date())): boolean {
  return startOfDay(date).getTime() === today.getTime();
}

export function buildAttentionQueue(
  items: InboxItem[],
  sections: InboxSections,
  budgetItems: BudgetItemSnapshot[],
  opts: {
    max?: number;
    now?: Date;
    paymentDueItems?: ReturnType<typeof buildMoneyDueItems>;
  } = {},
): TodayAttentionItem[] {
  const max = opts.max ?? 7;
  const today = startOfDay(opts.now ?? new Date());
  const paymentDueItems = opts.paymentDueItems ?? [];
  const result: TodayAttentionItem[] = [];
  const seen = new Set<string>();

  const add = (entry: TodayAttentionItem) => {
    if (result.length >= max || seen.has(entry.id)) return;
    seen.add(entry.id);
    result.push(entry);
  };

  const sortedNeedsYou = [...sections.needsYou].sort(
    (a, b) => Number(Boolean(b.unread)) - Number(Boolean(a.unread)) || b.sortOrder - a.sortOrder,
  );
  for (const item of sortedNeedsYou) {
    add({
      type: "inbox",
      id: item.id,
      item,
      urgency: item.unread ? "high" : "normal",
      reason: item.unread ? "Unread ask" : "Needs you",
    });
  }

  for (const item of items) {
    if (item.done || item.kind !== "task" || !item.escalated) continue;
    add({
      type: "inbox",
      id: item.id,
      item,
      urgency: "high",
      reason: "Pinned priority",
    });
  }

  for (const item of items) {
    if (item.done) continue;
    if (item.kind !== "task" && item.kind !== "task_step" && item.kind !== "org_step") continue;
    if (!item.dueDate || !isOverdue(item.dueDate, today)) continue;
    add({
      type: "inbox",
      id: item.id,
      item,
      urgency: "high",
      reason: "Overdue",
    });
  }

  for (const payment of paymentDueItems) {
    if (payment.overdue) {
      add({
        type: "payment",
        id: `payment:${payment.id}`,
        budgetItemId: payment.contractId,
        name: `${payment.contractName} · ${payment.label}`,
        amountRemaining: payment.amount,
        dueDate: payment.dueDate,
        urgency: "high",
        reason: "Payment overdue",
      });
    }
  }

  for (const item of items) {
    if (item.done) continue;
    if (item.kind !== "task" && item.kind !== "task_step" && item.kind !== "org_step") continue;
    if (!item.dueDate || !isDueToday(item.dueDate, today)) continue;
    add({
      type: "inbox",
      id: item.id,
      item,
      urgency: "normal",
      reason: "Due today",
    });
  }

  for (const payment of paymentDueItems) {
    if (!payment.overdue && payment.dueDate.getTime() !== today.getTime()) continue;
    if (!payment.overdue && !isDueToday(payment.dueDate, today)) continue;
    add({
      type: "payment",
      id: `payment:${payment.id}`,
      budgetItemId: payment.contractId,
      name: `${payment.contractName} · ${payment.label}`,
      amountRemaining: payment.amount,
      dueDate: payment.dueDate,
      urgency: payment.overdue ? "high" : "normal",
      reason: payment.overdue ? "Payment overdue" : "Payment due today",
    });
  }

  for (const item of budgetItems) {
    if (!item.payByDate || item.amountPaid >= item.price) continue;
    if (!isDueToday(item.payByDate, today)) continue;
    const alreadyCovered = paymentDueItems.some(
      (payment) => payment.contractId === item.id && isDueToday(payment.dueDate, today),
    );
    if (alreadyCovered) continue;
    add({
      type: "payment",
      id: `payment:${item.id}`,
      budgetItemId: item.id,
      name: item.name,
      amountRemaining: item.price - item.amountPaid,
      dueDate: item.payByDate,
      urgency: "normal",
      reason: "Payment due today",
    });
  }

  return result;
}

export function buildWaitingItems(sections: InboxSections): InboxItem[] {
  return [...sections.waiting].sort((a, b) => b.sortOrder - a.sortOrder);
}

export function countOpenTasks(items: InboxItem[]): number {
  return items.filter((item) => item.kind === "task" && !item.done).length;
}

export function countOpenAsks(items: InboxItem[]): number {
  return items.filter((item) => item.kind === "ask" && !item.done && !item.declined).length;
}

export function summarizeGuestAttendance(
  guests: Array<{ rsvpStatus: string; acceptedCount: number }>,
): { attending: number; hasData: boolean } {
  let attending = 0;
  let responded = 0;
  for (const guest of guests) {
    if (guest.rsvpStatus === "attending") {
      attending += Math.max(0, guest.acceptedCount);
      responded += 1;
    } else if (guest.rsvpStatus === "not_attending") {
      responded += 1;
    }
  }
  return { attending, hasData: responded > 0 || attending > 0 };
}

export function buildPulseStats(input: {
  items: InboxItem[];
  budget: { remaining: number } | null;
  guestSummary: { attending: number; hasData: boolean } | null;
  session: SessionAccount;
}): TodayPulseStat[] {
  const stats: TodayPulseStat[] = [];

  if (input.session.canSeeTasks) {
    stats.push({
      id: "open-tasks",
      label: "Open tasks",
      value: String(countOpenTasks(input.items)),
      href: "/today?filter=tasks",
    });
  }

  if (input.session.canSeeRequests) {
    stats.push({
      id: "open-asks",
      label: "Open asks",
      value: String(countOpenAsks(input.items)),
      href: "/today?filter=asks",
    });
  }

  if (input.budget && input.session.canSeeBudget) {
    stats.push({
      id: "budget-remaining",
      label: "Remaining",
      value: formatMoney(input.budget.remaining),
      href: "/money",
    });
  }

  if (input.guestSummary?.hasData && input.session.canSeeGuests) {
    stats.push({
      id: "rsvp-attending",
      label: "Attending",
      value: String(input.guestSummary.attending),
      href: "/guests",
    });
  }

  return stats.slice(0, 4);
}

export function buildComingUpList(
  input: {
    items: InboxItem[];
    calendar: Array<{ id: string; title: string; startDate: Date; notes: string | null }>;
    budgetItems: BudgetItemSnapshot[];
    orgParents: Array<{ id: string; title: string; dueDate: Date | null; orgKey: string | null }>;
    now?: Date;
    max?: number;
  },
): TodayComingUpItem[] {
  const today = startOfDay(input.now ?? new Date());
  const max = input.max ?? 5;
  const upcoming: TodayComingUpItem[] = [];

  for (const event of input.calendar) {
    if (event.startDate < today) continue;
    upcoming.push({
      id: `calendar:${event.id}`,
      kind: "calendar",
      title: event.title,
      date: event.startDate,
      href: "/calendar",
      subtitle: event.notes ?? undefined,
    });
  }

  for (const item of input.items) {
    if (item.done || !item.dueDate) continue;
    if (item.kind !== "task" && item.kind !== "task_step" && item.kind !== "org_step") continue;
    if (item.dueDate < today) continue;
    upcoming.push({
      id: `task:${item.sourceId}`,
      kind: item.kind === "org_step" ? "org" : "task",
      title: item.parentTitle ? `${item.parentTitle} · ${item.title}` : item.title,
      date: item.dueDate,
      href: item.href,
      subtitle: dueLabel(item.dueDate, "todo") ?? undefined,
    });
  }

  for (const parent of input.orgParents) {
    if (!parent.dueDate || parent.dueDate < today) continue;
    upcoming.push({
      id: `org:${parent.id}`,
      kind: "org",
      title: parent.title,
      date: parent.dueDate,
      href: "/today?filter=tasks",
      subtitle: parent.orgKey === "week_before" ? "Week before" : "Day before",
    });
  }

  for (const budgetItem of input.budgetItems) {
    if (!budgetItem.payByDate || budgetItem.payByDate < today) continue;
    if (budgetItem.amountPaid >= budgetItem.price) continue;
    upcoming.push({
      id: `payment:${budgetItem.id}`,
      kind: "payment",
      title: budgetItem.name,
      date: budgetItem.payByDate,
      href: "/money",
      subtitle: `${formatMoney(budgetItem.price - budgetItem.amountPaid)} due`,
    });
  }

  upcoming.sort((a, b) => a.date.getTime() - b.date.getTime() || a.title.localeCompare(b.title));
  return upcoming.slice(0, max);
}

export function shouldShowWeddingWeek(daysToGo: number | null): boolean {
  return daysToGo !== null && daysToGo >= 0 && daysToGo <= 7;
}

export function buildWeddingWeekPreview(
  blocks: Array<{
    id: string;
    startAt: string;
    notes: string;
    startMinutes: number | null;
    dayOffset: number;
    sortOrder: number;
  }>,
  opts: { daysToGo: number | null; now?: Date; limit?: number },
): TodayTimelinePreview[] {
  if (!shouldShowWeddingWeek(opts.daysToGo)) return [];

  const sorted = sortTimelineBlocks(blocks);
  const limit = opts.limit ?? 3;
  const now = opts.now ?? new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const onWeddingDay = opts.daysToGo === 0;

  let nextIndex = 0;
  if (onWeddingDay) {
    const timedIndex = sorted.findIndex((block) => {
      if (block.startMinutes == null) return false;
      const blockMinutes = block.dayOffset * 1440 + block.startMinutes;
      return blockMinutes >= nowMinutes;
    });
    nextIndex = timedIndex >= 0 ? timedIndex : sorted.length;
  }

  return sorted.slice(nextIndex, nextIndex + limit).map((block, index) => ({
    id: block.id,
    startAt: block.startAt,
    title: block.notes.split("\n")[0]?.trim() || "Timeline moment",
    isNext: index === 0,
  }));
}

function formatMoney(amount: number): string {
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

async function loadVisibleBudgetItems(session: SessionAccount): Promise<BudgetItemSnapshot[]> {
  const contracts = await loadVisibleBudgetContracts(session);
  return contracts.map((item) => ({
    id: item.id,
    name: item.name,
    price: item.price,
    amountPaid: item.amountPaid,
    payByDate: item.payByDate,
  }));
}

export async function loadTodayPageData(session: SessionAccount) {
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  const daysToGo = settings?.weddingDate
    ? differenceInCalendarDays(settings.weddingDate, startOfDay(new Date()))
    : null;
  const showWeddingWeek = shouldShowWeddingWeek(daysToGo);

  const [inbox, budgetItems, guestRows, timelineBlocks, calendarEvents, orgParents] = await Promise.all([
    loadInboxPageData(session),
    loadVisibleBudgetItems(session),
    session.canSeeGuests
      ? prisma.guest.findMany({ select: { rsvpStatus: true, acceptedCount: true } })
      : Promise.resolve([]),
    session.canSeeTimeline && showWeddingWeek
      ? prisma.timelineBlock.findMany({
          where: { schedule: "wedding" },
          select: {
            id: true,
            startAt: true,
            notes: true,
            startMinutes: true,
            dayOffset: true,
            sortOrder: true,
          },
        })
      : Promise.resolve([]),
    prisma.calendarEvent.findMany({
      orderBy: { startDate: "asc" },
      select: { id: true, title: true, startDate: true, notes: true },
    }),
    prisma.task.findMany({
      where: { orgKey: { in: ["week_before", "day_before"] } },
      select: { id: true, title: true, dueDate: true, orgKey: true },
    }),
  ]);

  const hero = buildTodayHero(settings, session.name);
  const contracts = await loadVisibleBudgetContracts(session);
  const paymentDueItems = buildMoneyDueItems(contracts);
  const attention = buildAttentionQueue(inbox.items, inbox.sections, budgetItems, {
    paymentDueItems,
  });
  const waiting = buildWaitingItems(inbox.sections);

  const committed = budgetItems.reduce((sum, item) => sum + item.price, 0);
  const paid = budgetItems.reduce((sum, item) => sum + item.amountPaid, 0);
  const guestSummary = session.canSeeGuests ? summarizeGuestAttendance(guestRows) : null;

  const pulse = buildPulseStats({
    items: inbox.items,
    budget: session.canSeeBudget ? { remaining: committed - paid } : null,
    guestSummary,
    session,
  });

  const comingUp = buildComingUpList({
    items: inbox.items,
    calendar: calendarEvents,
    budgetItems,
    orgParents,
  });

  const weddingWeek = buildWeddingWeekPreview(timelineBlocks, { daysToGo: hero.daysToGo });

  return {
    hero,
    attention,
    waiting,
    pulse,
    comingUp,
    weddingWeek,
    inbox,
  };
}

/** Exported for tests — timeline sort helper uses parseDayOfTime internally via sortTimelineBlocks. */
export { parseDayOfTime, listInboxItems, groupInboxItems };
