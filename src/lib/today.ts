import { differenceInCalendarDays, startOfDay } from "date-fns";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { moneyContractHref } from "@/lib/connections";
import { loadVisibleBudgetContracts } from "@/lib/money-page";
import { parseDayOfTime, sortTimelineBlocks } from "@/lib/day-of-time";
import {
  groupInboxItems,
  listInboxItems,
  loadInboxPageData,
  type AccountOption,
  type InboxItem,
  type InboxSections,
} from "@/lib/inbox";
import {
  effectiveAcceptedCount,
  effectiveInvitedCount,
  summarizeGuestRsvp,
} from "@/lib/guest-gifts";
import { profileIdForPerson } from "@/lib/people-directory";
import { dueLabel } from "@/lib/tasks";
import type { SessionAccount } from "@/lib/types";

export type TodayHeroPhase = "future" | "wedding-day" | "after";

export type TodayHeroData = {
  greeting: string;
  coupleNames: string | null;
  headline: string;
  weddingDate: Date | null;
  timezone: string;
  daysToGo: number | null;
  phase: TodayHeroPhase | null;
  countdownLabel: string | null;
  countdownSupport: string | null;
  weddingDateLabel: string | null;
  venue: string | null;
};

export type TodayAttentionInbox = {
  type: "inbox";
  id: string;
  item: InboxItem;
  title: string;
  reason: string;
  whenLabel: string | null;
  context: string | null;
  href: string;
  urgency: "high" | "normal";
  rank: number;
  personId: string | null;
};

export type TodayAttentionPayment = {
  type: "payment";
  id: string;
  budgetItemId: string;
  name: string;
  title: string;
  amountRemaining: number;
  dueDate: Date;
  reason: string;
  whenLabel: string | null;
  context: string | null;
  href: string;
  urgency: "high" | "normal";
  rank: number;
  personId: string | null;
};

export type TodayAttentionItem = TodayAttentionInbox | TodayAttentionPayment;

export type TodayWaitingItem = {
  id: string;
  title: string;
  context: string;
  whenLabel: string | null;
  href?: string;
  personId: string | null;
  item: InboxItem;
};

export type TodayContextItem = {
  id: string;
  timeLabel: string | null;
  title: string;
  context?: string;
  href?: string;
};

export type TodayPulseStat = {
  id: string;
  label: string;
  value: string;
  detail?: string;
  href: string;
};

export type TodayComingUpItem = {
  id: string;
  kind: "calendar" | "task" | "payment";
  title: string;
  date: Date;
  href?: string;
  subtitle?: string;
  personId: string | null;
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

const ATTENTION_MAX = 7;
const COMING_UP_MAX = 5;
const DUE_SOON_DAYS = 3;

const RANK = {
  unreadAsk: 100,
  overduePayment: 90,
  overdueTask: 80,
  escalated: 70,
  dueTodayPayment: 60,
  dueTodayTask: 55,
  needsYou: 50,
  dueSoonPayment: 45,
  dueSoonTask: 40,
} as const;

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

export function zonedCalendarDate(date: Date, timeZone: string): string {
  return date.toLocaleDateString("en-CA", { timeZone });
}

export function daysUntilWedding(weddingDate: Date, timezone: string, now = new Date()): number {
  const today = Date.parse(`${zonedCalendarDate(now, timezone)}T00:00:00Z`);
  const wedding = Date.parse(`${zonedCalendarDate(weddingDate, timezone)}T00:00:00Z`);
  return Math.round((wedding - today) / 86_400_000);
}

export function todayPersonRef(input: {
  personId?: string | null;
  linkedPersonId?: string | null;
  name?: string | null;
}): { personId: string | null; href: string | null } {
  const personId = input.personId?.trim() || input.linkedPersonId?.trim() || null;
  if (!personId) return { personId: null, href: null };
  return { personId, href: `/people/${profileIdForPerson(personId)}` };
}

export function remainingOnBudgetItem(item: Pick<BudgetItemSnapshot, "price" | "amountPaid">): number {
  return Math.max(0, item.price - item.amountPaid);
}

function isOverdue(date: Date, today: Date): boolean {
  return startOfDay(date) < today;
}

function isDueToday(date: Date, today: Date): boolean {
  return startOfDay(date).getTime() === today.getTime();
}

function daysFromToday(date: Date, today: Date): number {
  return differenceInCalendarDays(startOfDay(date), today);
}

export function formatRelativeWhen(date: Date, now = new Date()): string {
  const today = startOfDay(now);
  const days = daysFromToday(date, today);
  const stamp = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  if (days < 0) return days === -1 ? "Yesterday" : stamp;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 7) return stamp;
  return stamp;
}

function sentWhenLabel(iso: string | undefined, now: Date): string | null {
  if (!iso) return null;
  const created = new Date(iso);
  if (Number.isNaN(created.getTime())) return null;
  const days = differenceInCalendarDays(startOfDay(now), startOfDay(created));
  if (days <= 0) return "Sent today";
  if (days === 1) return "Sent yesterday";
  return `Sent ${days} days ago`;
}

function accountLinkedPersonId(accounts: AccountOption[] | undefined, accountId: string | undefined): string | null {
  if (!accounts || !accountId) return null;
  return accounts.find((account) => account.id === accountId)?.linkedPersonId ?? null;
}

export function buildTodayHero(
  settings: { weddingDate: Date; coupleNames: string; timezone: string; venue?: string | null } | null,
  sessionName: string,
  now = new Date(),
): TodayHeroData {
  const timezone = settings?.timezone ?? "America/Detroit";
  const weddingDate = settings?.weddingDate ?? null;
  const coupleNames = settings?.coupleNames?.trim() || null;
  const greeting = greetingForHour(now);
  const who = coupleNames ?? sessionName.split(" ")[0] ?? null;
  const rawDays = weddingDate ? daysUntilWedding(weddingDate, timezone, now) : null;
  const phase: TodayHeroPhase | null =
    rawDays === null ? null : rawDays > 0 ? "future" : rawDays === 0 ? "wedding-day" : "after";
  const daysToGo = rawDays !== null && rawDays >= 0 ? rawDays : null;
  const weddingDateLabel = weddingDate ? formatWeddingDateLabel(weddingDate, timezone) : null;

  let countdownLabel: string | null = null;
  let countdownSupport: string | null = null;
  if (phase === "future" && daysToGo !== null) {
    countdownLabel = daysToGo === 1 ? "1 day" : `${daysToGo} days`;
    countdownSupport = "until we celebrate.";
  } else if (phase === "wedding-day") {
    countdownLabel = "Today";
    countdownSupport = "we celebrate.";
  } else if (phase === "after" && weddingDateLabel) {
    countdownLabel = null;
    countdownSupport = `Celebrated ${weddingDateLabel}.`;
  }

  return {
    greeting,
    coupleNames,
    headline: who ? `${greeting}, ${who}` : greeting,
    weddingDate,
    timezone,
    daysToGo,
    phase,
    countdownLabel,
    countdownSupport,
    weddingDateLabel,
    venue: settings?.venue?.trim() || null,
  };
}

function personIdFromOwners(item: InboxItem): string | null {
  return item.ownerPersonIds[0] ?? null;
}

export function buildAttentionQueue(
  items: InboxItem[],
  sections: InboxSections,
  budgetItems: BudgetItemSnapshot[],
  opts: {
    max?: number;
    now?: Date;
    accounts?: AccountOption[];
  } = {},
): TodayAttentionItem[] {
  const max = opts.max ?? ATTENTION_MAX;
  const now = opts.now ?? new Date();
  const today = startOfDay(now);
  const candidates: TodayAttentionItem[] = [];
  const seen = new Set<string>();

  const add = (entry: TodayAttentionItem) => {
    if (seen.has(entry.id)) return;
    seen.add(entry.id);
    candidates.push(entry);
  };

  for (const item of sections.needsYou) {
    const unread = Boolean(item.unread);
    add({
      type: "inbox",
      id: item.id,
      item,
      title: item.title,
      reason: unread ? "Needs an answer" : "Needs you",
      whenLabel: sentWhenLabel(item.askData?.createdAt, now),
      context: item.ownerLabel || item.askData?.senderName || null,
      href: item.href ?? "/today?filter=asks",
      urgency: unread ? "high" : "normal",
      rank: unread ? RANK.unreadAsk : RANK.needsYou,
      personId: todayPersonRef({
        linkedPersonId: accountLinkedPersonId(opts.accounts, item.askData?.senderAccountId),
      }).personId,
    });
  }

  for (const item of items) {
    if (item.done || item.kind !== "task" || !item.escalated) continue;
    add({
      type: "inbox",
      id: item.id,
      item,
      title: item.title,
      reason: "Pinned priority",
      whenLabel: item.dueDate ? formatRelativeWhen(item.dueDate, now) : null,
      context: item.ownerLabel || null,
      href: item.href ?? `/work/${item.sourceId}`,
      urgency: "high",
      rank: RANK.escalated,
      personId: todayPersonRef({ personId: personIdFromOwners(item) }).personId,
    });
  }

  for (const item of items) {
    if (item.done) continue;
    if (item.kind !== "task" && item.kind !== "task_step" && item.kind !== "org_step") continue;
    if (!item.dueDate) continue;
    const overdue = isOverdue(item.dueDate, today);
    const dueToday = isDueToday(item.dueDate, today);
    const dueSoon = !overdue && !dueToday && daysFromToday(item.dueDate, today) <= DUE_SOON_DAYS;
    if (!overdue && !dueToday && !dueSoon) continue;
    add({
      type: "inbox",
      id: item.id,
      item,
      title: item.parentTitle ? `${item.parentTitle} · ${item.title}` : item.title,
      reason: overdue ? "Overdue" : dueToday ? "Due today" : "Due soon",
      whenLabel: formatRelativeWhen(item.dueDate, now),
      context: item.ownerLabel || null,
      href: item.href ?? `/work/${item.sourceId}`,
      urgency: overdue ? "high" : "normal",
      rank: overdue ? RANK.overdueTask : dueToday ? RANK.dueTodayTask : RANK.dueSoonTask,
      personId: todayPersonRef({ personId: personIdFromOwners(item) }).personId,
    });
  }

  for (const item of budgetItems) {
    if (!item.payByDate || remainingOnBudgetItem(item) <= 0) continue;
    const overdue = isOverdue(item.payByDate, today);
    const dueToday = isDueToday(item.payByDate, today);
    const dueSoon = !overdue && !dueToday && daysFromToday(item.payByDate, today) <= DUE_SOON_DAYS;
    if (!overdue && !dueToday && !dueSoon) continue;
    const remaining = remainingOnBudgetItem(item);
    add({
      type: "payment",
      id: `payment:${item.id}`,
      budgetItemId: item.id,
      name: item.name,
      title: item.name,
      amountRemaining: remaining,
      dueDate: item.payByDate,
      reason: overdue ? "Payment overdue" : dueToday ? "Payment due today" : "Payment due soon",
      whenLabel: formatRelativeWhen(item.payByDate, now),
      context: `${formatMoney(remaining)} remaining`,
      href: moneyContractHref(item.id),
      urgency: overdue ? "high" : "normal",
      rank: overdue ? RANK.overduePayment : dueToday ? RANK.dueTodayPayment : RANK.dueSoonPayment,
      personId: null,
    });
  }

  candidates.sort(
    (a, b) =>
      b.rank - a.rank ||
      (a.whenLabel ?? "").localeCompare(b.whenLabel ?? "") ||
      a.title.localeCompare(b.title),
  );
  return candidates.slice(0, max);
}

export function buildWaitingItems(
  sections: InboxSections,
  opts: { accounts?: AccountOption[]; now?: Date } = {},
): TodayWaitingItem[] {
  const now = opts.now ?? new Date();
  return [...sections.waiting]
    .sort((a, b) => b.sortOrder - a.sortOrder)
    .map((item) => {
      const waitingOn = item.askData?.recipientName || item.ownerLabel || "someone";
      const linked = todayPersonRef({
        linkedPersonId: accountLinkedPersonId(opts.accounts, item.askData?.recipientAccountId),
        personId: personIdFromOwners(item),
      });
      return {
        id: item.id,
        title: item.title,
        context: `Waiting on ${waitingOn}`,
        whenLabel: sentWhenLabel(item.askData?.createdAt, now),
        href: item.href ?? "/today?filter=waiting",
        personId: linked.personId,
        item,
      };
    });
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
  budget: { remaining: number; committed?: number; paid?: number } | null;
  rsvp: { accepted: number; invited: number } | null;
  session: SessionAccount;
}): TodayPulseStat[] {
  const stats: TodayPulseStat[] = [];

  if (input.rsvp && input.rsvp.invited > 0 && input.session.canSeeGuests) {
    stats.push({
      id: "rsvp",
      label: "RSVP",
      value: `${input.rsvp.accepted} / ${input.rsvp.invited}`,
      detail: "confirmed / invited",
      href: "/people?tab=guests",
    });
  }

  if (input.session.canSeeTasks) {
    stats.push({
      id: "open-tasks",
      label: "Tasks",
      value: String(countOpenTasks(input.items)),
      detail: "open",
      href: "/today?filter=tasks",
    });
  }

  if (
    input.budget &&
    input.session.canSeeBudget &&
    ((input.budget.committed ?? 0) > 0 || (input.budget.paid ?? 0) > 0)
  ) {
    stats.push({
      id: "budget-remaining",
      label: "Money",
      value: formatMoney(input.budget.remaining),
      detail: "remaining",
      href: "/money",
    });
  }

  if (input.session.canSeeRequests) {
    stats.push({
      id: "open-asks",
      label: "Asks",
      value: String(countOpenAsks(input.items)),
      detail: "open",
      href: "/today?filter=asks",
    });
  }

  return stats.slice(0, 4);
}

export function buildComingUpList(input: {
  items: InboxItem[];
  calendar: Array<{ id: string; title: string; startDate: Date; notes: string | null }>;
  budgetItems: BudgetItemSnapshot[];
  now?: Date;
  max?: number;
}): TodayComingUpItem[] {
  const today = startOfDay(input.now ?? new Date());
  const max = input.max ?? COMING_UP_MAX;
  const upcoming: TodayComingUpItem[] = [];

  for (const event of input.calendar) {
    if (startOfDay(event.startDate) < today) continue;
    upcoming.push({
      id: `calendar:${event.id}`,
      kind: "calendar",
      title: event.title,
      date: event.startDate,
      href: "/today",
      subtitle: event.notes?.trim() || undefined,
      personId: null,
    });
  }

  for (const item of input.items) {
    if (item.done || !item.dueDate) continue;
    if (item.kind !== "task" && item.kind !== "task_step" && item.kind !== "org_step") continue;
    if (startOfDay(item.dueDate) < today) continue;
    upcoming.push({
      id: `task:${item.sourceId}`,
      kind: "task",
      title: item.parentTitle ? `${item.parentTitle} · ${item.title}` : item.title,
      date: item.dueDate,
      href: item.href,
      subtitle: item.ownerLabel || dueLabel(item.dueDate, "todo") || undefined,
      personId: todayPersonRef({ personId: personIdFromOwners(item) }).personId,
    });
  }

  for (const budgetItem of input.budgetItems) {
    if (!budgetItem.payByDate || startOfDay(budgetItem.payByDate) < today) continue;
    const remaining = remainingOnBudgetItem(budgetItem);
    if (remaining <= 0) continue;
    upcoming.push({
      id: `payment:${budgetItem.id}`,
      kind: "payment",
      title: budgetItem.name,
      date: budgetItem.payByDate,
      href: moneyContractHref(budgetItem.id),
      subtitle: `${formatMoney(remaining)} remaining`,
      personId: null,
    });
  }

  upcoming.sort((a, b) => a.date.getTime() - b.date.getTime() || a.title.localeCompare(b.title));
  const seen = new Set<string>();
  const unique: TodayComingUpItem[] = [];
  for (const item of upcoming) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
    if (unique.length >= max) break;
  }
  return unique;
}

export function buildTodayContext(input: {
  calendar: Array<{ id: string; title: string; startDate: Date; notes: string | null }>;
  items: InboxItem[];
  budgetItems: BudgetItemSnapshot[];
  timeline: Array<{ id: string; startAt: string; notes: string; startMinutes: number | null; sortOrder: number }>;
  now?: Date;
}): TodayContextItem[] {
  const now = input.now ?? new Date();
  const today = startOfDay(now);
  const rows: TodayContextItem[] = [];

  for (const event of input.calendar) {
    if (!isDueToday(event.startDate, today)) continue;
    rows.push({
      id: `calendar:${event.id}`,
      timeLabel: null,
      title: event.title,
      context: event.notes?.trim() || undefined,
      href: "/today",
    });
  }

  for (const item of input.items) {
    if (item.done || !item.dueDate) continue;
    if (item.kind !== "task" && item.kind !== "task_step") continue;
    if (!isDueToday(item.dueDate, today)) continue;
    rows.push({
      id: `task:${item.sourceId}`,
      timeLabel: null,
      title: item.title,
      context: item.ownerLabel || undefined,
      href: item.href,
    });
  }

  for (const item of input.budgetItems) {
    if (!item.payByDate || remainingOnBudgetItem(item) <= 0) continue;
    if (!isDueToday(item.payByDate, today)) continue;
    rows.push({
      id: `payment:${item.id}`,
      timeLabel: null,
      title: item.name,
      context: `${formatMoney(remainingOnBudgetItem(item))} remaining`,
      href: moneyContractHref(item.id),
    });
  }

  const timeline = sortTimelineBlocks(
    input.timeline.map((block) => ({
      ...block,
      dayOffset: 0,
    })),
  );
  for (const block of timeline) {
    rows.push({
      id: `timeline:${block.id}`,
      timeLabel: block.startAt || null,
      title: block.notes.split("\n")[0]?.trim() || "Timeline moment",
      href: "/day",
    });
  }

  return rows;
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

async function loadVisibleBudgetItems(session: SessionAccount): Promise<BudgetItemSnapshot[]> {
  if (!session.canSeeBudget) return [];
  const contracts = await loadVisibleBudgetContracts(session);
  return contracts.map((item) => ({
    id: item.id,
    name: item.name,
    price: item.price,
    amountPaid: item.amountPaid,
    payByDate: item.payByDate,
  }));
}

async function safeRead<T>(fallback: T, reader: () => Promise<T>): Promise<T> {
  try {
    return await reader();
  } catch {
    return fallback;
  }
}

export async function loadTodayPageData(session: SessionAccount) {
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  const hero = buildTodayHero(settings, session.name);
  const onWeddingDay = hero.phase === "wedding-day";

  const [inbox, budgetItems, guestRows, timelineBlocks, calendarEvents] = await Promise.all([
    loadInboxPageData(session),
    loadVisibleBudgetItems(session),
    session.canSeeGuests
      ? safeRead([], () =>
          prisma.guest.findMany({
            select: {
              rsvpStatus: true,
              invitedCount: true,
              acceptedCount: true,
              nameLine1: true,
              nameLine2: true,
              people: { select: { name: true } },
            },
          }),
        )
      : Promise.resolve([]),
    session.canSeeTimeline && onWeddingDay
      ? safeRead([], () =>
          prisma.timelineBlock.findMany({
            where: { schedule: "wedding" },
            select: {
              id: true,
              startAt: true,
              notes: true,
              startMinutes: true,
              sortOrder: true,
            },
          }),
        )
      : Promise.resolve([]),
    session.canSeeCalendar
      ? safeRead([], () =>
          prisma.calendarEvent.findMany({
            orderBy: { startDate: "asc" },
            select: { id: true, title: true, startDate: true, notes: true },
          }),
        )
      : Promise.resolve([]),
  ]);

  const attention = buildAttentionQueue(inbox.items, inbox.sections, budgetItems, {
    accounts: inbox.accounts,
  });
  const waiting = buildWaitingItems(inbox.sections, { accounts: inbox.accounts });

  const committed = budgetItems.reduce((sum, item) => sum + item.price, 0);
  const paid = budgetItems.reduce((sum, item) => sum + item.amountPaid, 0);
  const rsvpReport = session.canSeeGuests
    ? summarizeGuestRsvp(
        guestRows.map((guest) => ({
          nameLine2: guest.nameLine2,
          rsvpStatus: guest.rsvpStatus,
          invitedCount: guest.invitedCount,
          acceptedCount: guest.acceptedCount,
          people: guest.people,
        })),
      )
    : null;

  const pulse = buildPulseStats({
    items: inbox.items,
    budget: session.canSeeBudget ? { remaining: committed - paid, committed, paid } : null,
    rsvp: rsvpReport && rsvpReport.invited > 0
      ? { accepted: rsvpReport.accepted, invited: rsvpReport.invited }
      : null,
    session,
  });

  const comingUp = buildComingUpList({
    items: inbox.items,
    calendar: calendarEvents,
    budgetItems,
  });

  const todayContext = buildTodayContext({
    calendar: calendarEvents,
    items: inbox.items,
    budgetItems,
    timeline: timelineBlocks,
  });

  return {
    hero,
    attention,
    waiting,
    pulse,
    comingUp,
    todayContext,
    inbox,
  };
}

export { effectiveAcceptedCount, effectiveInvitedCount, parseDayOfTime, listInboxItems, groupInboxItems };
