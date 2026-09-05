/**
 * Wedding Week / execution composition for TODAY.
 *
 * DATE/PHASE  →  src/lib/wedding-phase.ts
 * DATA        →  this module (pure; inject now + already-filtered records)
 * PRESENTATION →  Today* components
 *
 * Precedence — each record appears in its highest-value section:
 *
 *   1. TODAY            dated today (task dueDate, CalendarEvent, money obligation)
 *   2. ATTENTION        overdue execution-critical work, unanswered asks, pinned
 *   3. TOMORROW         dated tomorrow
 *   4. LATER THIS WEEK  dated after tomorrow through the wedding date
 *   5. WAITING          open requests (always listed; ranked by linked timing)
 *
 * A task due today is TODAY, not Attention and not Later.
 * An overdue task stays in Attention — that is the more useful semantic.
 *
 * Sources must already be permission-filtered. This module never loads data.
 * TimelineBlocks have no authoritative calendar date and are never dated here.
 * Rehearsal is surfaced only when a CalendarEvent (or other dated record) exists.
 */

import { calendarHref, moneyHref, requestHref, taskHref } from "@/lib/entity-links";
import type { AccountOption, InboxItem, InboxSections } from "@/lib/inbox";
import {
  formatMoney,
  obligationsForContract,
  type BudgetContractSnapshot,
} from "@/lib/money";
import { dueLabel } from "@/lib/tasks";
import {
  addCalendarDays,
  calendarDateKey,
  calendarDaysBetweenKeys,
  type WeddingPhase,
  type WeddingPhaseInfo,
} from "@/lib/wedding-phase";
import type {
  BudgetItemSnapshot,
  TodayAttentionItem,
  TodayComingUpItem,
  TodayContextItem,
  TodayWaitingItem,
} from "@/lib/today";

export type ExecutionRowKind = "task" | "calendar" | "payment" | "handoff";

export type ExecutionRow = {
  id: string;
  kind: ExecutionRowKind;
  title: string;
  subtitle?: string;
  date: Date | null;
  dateKey: string | null;
  href: string;
  personId: string | null;
  timeLabel?: string | null;
};

export type TodayHandoff = {
  href: string;
  label: string;
  title: string;
  support: string;
};

export type ExecutionTodayModel = {
  layout: WeddingPhase;
  today: ExecutionRow[];
  tomorrow: ExecutionRow[];
  tonight: ExecutionRow[];
  laterThisWeek: ExecutionRow[];
  attention: TodayAttentionItem[];
  waiting: TodayWaitingItem[];
  todayContext: TodayContextItem[];
  comingUp: TodayComingUpItem[];
  todayEmpty: { title: string; support: string } | null;
  tomorrowEmpty: { title: string; support: string } | null;
  handoff: TodayHandoff | null;
  pulseCompact: boolean;
};

const EXEC_ATTENTION_MAX = 7;
const LATER_MAX = 6;

const EXEC_RANK = {
  unreadAsk: 100,
  overduePayment: 95,
  overdueTask: 90,
  escalated: 70,
  needsYou: 50,
} as const;

type DatedCandidate = ExecutionRow & { date: Date; dateKey: string };

function asMoneyContract(item: BudgetItemSnapshot): BudgetContractSnapshot {
  return {
    id: item.id,
    name: item.name,
    price: item.price,
    amountPaid: item.amountPaid,
    ownerId: null,
    paidById: null,
    payByDate: item.payByDate,
    note: null,
    sortOrder: 0,
    payments: item.payments ?? [],
  };
}

function obligationHref(
  itemId: string,
  obligation: { id: string; kind: "payment" | "legacy" | string },
): string {
  if (obligation.kind !== "payment") return moneyHref(itemId);
  const prefix = `payment:${itemId}:`;
  const paymentId = obligation.id.startsWith(prefix) ? obligation.id.slice(prefix.length) : "";
  return paymentId ? moneyHref(itemId, { paymentId }) : moneyHref(itemId);
}

function personIdFromOwners(item: InboxItem): string | null {
  return item.ownerPersonIds[0] ?? null;
}

function isDatedWork(item: InboxItem): boolean {
  return item.kind === "task" || item.kind === "task_step" || item.kind === "org_step";
}

function accountLinkedPersonId(
  accounts: AccountOption[] | undefined,
  accountId: string | undefined,
): string | null {
  if (!accounts || !accountId) return null;
  return accounts.find((account) => account.id === accountId)?.linkedPersonId ?? null;
}

function formatWhen(date: Date, todayKey: string, timeZone: string): string {
  const key = calendarDateKey(date, timeZone);
  const days = calendarDaysBetweenKeys(todayKey, key);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone,
  });
}

function sentWhenLabel(iso: string | undefined, todayKey: string, timeZone: string): string | null {
  if (!iso) return null;
  const created = new Date(iso);
  if (Number.isNaN(created.getTime())) return null;
  const age = calendarDaysBetweenKeys(calendarDateKey(created, timeZone), todayKey);
  if (age <= 0) return "Sent today";
  if (age === 1) return "Sent yesterday";
  return `Sent ${age} days ago`;
}

function collectDatedItems(input: {
  items: InboxItem[];
  calendar: Array<{ id: string; title: string; startDate: Date; notes: string | null }>;
  budgetItems: BudgetItemSnapshot[];
  timezone: string;
  todayKey: string;
}): DatedCandidate[] {
  const rows: DatedCandidate[] = [];

  for (const event of input.calendar) {
    const dateKey = calendarDateKey(event.startDate, input.timezone);
    rows.push({
      id: `calendar:${event.id}`,
      kind: "calendar",
      title: event.title,
      subtitle: event.notes?.trim() || undefined,
      date: event.startDate,
      dateKey,
      href: calendarHref(),
      personId: null,
    });
  }

  for (const item of input.items) {
    if (item.done || !item.dueDate || !isDatedWork(item)) continue;
    const dateKey = calendarDateKey(item.dueDate, input.timezone);
    rows.push({
      id: item.id,
      kind: "task",
      title: item.parentTitle ? `${item.parentTitle} · ${item.title}` : item.title,
      subtitle: item.ownerLabel || dueLabel(item.dueDate, "todo") || undefined,
      date: item.dueDate,
      dateKey,
      href: item.href ?? taskHref(item.sourceId),
      personId: personIdFromOwners(item),
    });
  }

  const todayForObligations = new Date(`${input.todayKey}T12:00:00.000Z`);
  for (const budgetItem of input.budgetItems) {
    const obligations = obligationsForContract(asMoneyContract(budgetItem), todayForObligations);
    for (const obligation of obligations) {
      const dateKey = calendarDateKey(obligation.dueDate, input.timezone);
      rows.push({
        id: obligation.id,
        kind: "payment",
        title: budgetItem.name,
        subtitle:
          obligation.kind === "payment"
            ? `${obligation.label} · ${formatMoney(obligation.amount)}`
            : `${formatMoney(obligation.amount)} remaining`,
        date: obligation.dueDate,
        dateKey,
        href: obligationHref(budgetItem.id, obligation),
        personId: null,
      });
    }
  }

  rows.sort((a, b) => a.date.getTime() - b.date.getTime() || a.title.localeCompare(b.title));
  return dedupeRows(rows);
}

function dedupeRows<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    unique.push(row);
  }
  return unique;
}

function weddingDayHandoff(): ExecutionRow {
  return {
    id: "handoff:day",
    kind: "handoff",
    title: "Today's schedule",
    subtitle: "Open the day-of view",
    date: null,
    dateKey: null,
    href: "/day",
    personId: null,
  };
}

function dayBeforeHandoff(): ExecutionRow {
  return {
    id: "handoff:day",
    kind: "handoff",
    title: "Tomorrow we get married",
    subtitle: "Open the day-of view when you're ready",
    date: null,
    dateKey: null,
    href: "/day",
    personId: null,
  };
}

export function buildExecutionAttention(
  items: InboxItem[],
  sections: InboxSections,
  budgetItems: BudgetItemSnapshot[],
  opts: {
    now: Date;
    timezone: string;
    todayKey: string;
    placedIds: Set<string>;
    accounts?: AccountOption[];
    max?: number;
  },
): TodayAttentionItem[] {
  const candidates: TodayAttentionItem[] = [];
  const seen = new Set<string>();

  const add = (entry: TodayAttentionItem) => {
    if (seen.has(entry.id) || opts.placedIds.has(entry.id)) return;
    seen.add(entry.id);
    candidates.push(entry);
  };

  for (const item of sections.needsYou) {
    if (opts.placedIds.has(item.id)) continue;
    const unread = Boolean(item.unread);
    add({
      type: "inbox",
      id: item.id,
      item,
      title: item.title,
      reason: unread ? "Needs an answer" : "Needs you",
      whenLabel: sentWhenLabel(item.askData?.createdAt, opts.todayKey, opts.timezone),
      context: item.ownerLabel || item.askData?.senderName || null,
      href: item.href ?? requestHref(item.sourceId),
      urgency: unread ? "high" : "normal",
      rank: unread ? EXEC_RANK.unreadAsk : EXEC_RANK.needsYou,
      personId: accountLinkedPersonId(opts.accounts, item.askData?.senderAccountId),
    });
  }

  for (const item of items) {
    if (item.done || item.kind !== "task") continue;
    if (opts.placedIds.has(item.id)) continue;

    if (item.escalated && !item.dueDate) {
      add({
        type: "inbox",
        id: item.id,
        item,
        title: item.title,
        reason: "Pinned priority",
        whenLabel: null,
        context: item.ownerLabel || null,
        href: item.href ?? taskHref(item.sourceId),
        urgency: "high",
        rank: EXEC_RANK.escalated,
        personId: personIdFromOwners(item),
      });
      continue;
    }

    if (!item.dueDate) continue;
    const dueKey = calendarDateKey(item.dueDate, opts.timezone);
    if (dueKey >= opts.todayKey) continue;

    add({
      type: "inbox",
      id: item.id,
      item,
      title: item.parentTitle ? `${item.parentTitle} · ${item.title}` : item.title,
      reason: "Overdue",
      whenLabel: formatWhen(item.dueDate, opts.todayKey, opts.timezone),
      context: item.ownerLabel || null,
      href: item.href ?? taskHref(item.sourceId),
      urgency: "high",
      rank: item.escalated ? EXEC_RANK.escalated : EXEC_RANK.overdueTask,
      personId: personIdFromOwners(item),
    });
  }

  const todayForObligations = new Date(`${opts.todayKey}T12:00:00.000Z`);
  for (const budgetItem of budgetItems) {
    const obligations = obligationsForContract(asMoneyContract(budgetItem), todayForObligations);
    for (const obligation of obligations) {
      const dueKey = calendarDateKey(obligation.dueDate, opts.timezone);
      if (dueKey >= opts.todayKey) continue;
      if (opts.placedIds.has(obligation.id)) continue;
      add({
        type: "payment",
        id: obligation.id,
        budgetItemId: budgetItem.id,
        name: budgetItem.name,
        title: budgetItem.name,
        amountRemaining: obligation.amount,
        dueDate: obligation.dueDate,
        reason: "Payment overdue",
        whenLabel: formatWhen(obligation.dueDate, opts.todayKey, opts.timezone),
        context:
          obligation.kind === "payment"
            ? `${obligation.label} · ${formatMoney(obligation.amount)}`
            : `${formatMoney(obligation.amount)} remaining`,
        href: obligationHref(budgetItem.id, obligation),
        urgency: "high",
        rank: EXEC_RANK.overduePayment,
        personId: null,
      });
    }
  }

  candidates.sort(
    (a, b) =>
      b.rank - a.rank ||
      (a.whenLabel ?? "").localeCompare(b.whenLabel ?? "") ||
      a.title.localeCompare(b.title),
  );
  return candidates.slice(0, opts.max ?? EXEC_ATTENTION_MAX);
}

export function rankWaitingForExecution(
  waiting: TodayWaitingItem[],
  items: InboxItem[],
  opts: { timezone: string; todayKey: string },
): TodayWaitingItem[] {
  const taskById = new Map<string, InboxItem>();
  for (const item of items) {
    if (item.kind === "task") taskById.set(item.sourceId, item);
  }

  const scored = waiting.map((entry) => {
    let score = 0;
    const linked = entry.item.linkedTaskId ? taskById.get(entry.item.linkedTaskId) : null;
    if (linked?.dueDate) {
      const dueKey = calendarDateKey(linked.dueDate, opts.timezone);
      const until = calendarDaysBetweenKeys(opts.todayKey, dueKey);
      if (until < 0) score = 100;
      else if (until === 0) score = 90;
      else if (until === 1) score = 80;
      else if (until <= 3) score = 60;
    } else if (entry.item.askData?.createdAt) {
      const createdKey = calendarDateKey(new Date(entry.item.askData.createdAt), opts.timezone);
      const age = calendarDaysBetweenKeys(createdKey, opts.todayKey);
      if (age <= 0) score = 40;
      else if (age === 1) score = 30;
    }
    return { entry, score, sortOrder: entry.item.sortOrder };
  });

  scored.sort((a, b) => b.score - a.score || b.sortOrder - a.sortOrder);
  return scored.map((row) => row.entry);
}

function toComingUp(row: ExecutionRow): TodayComingUpItem | null {
  if (!row.date || row.kind === "handoff") return null;
  if (row.kind !== "calendar" && row.kind !== "task" && row.kind !== "payment") return null;
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    date: row.date,
    href: row.href,
    subtitle: row.subtitle,
    personId: row.personId,
  };
}

function toTodayContext(row: ExecutionRow): TodayContextItem {
  return {
    id: row.id,
    timeLabel: row.timeLabel ?? null,
    title: row.title,
    context: row.subtitle,
    href: row.href,
  };
}

export function composeExecutionToday(input: {
  phase: WeddingPhaseInfo;
  items: InboxItem[];
  sections: InboxSections;
  budgetItems: BudgetItemSnapshot[];
  calendar: Array<{ id: string; title: string; startDate: Date; notes: string | null }>;
  waiting: TodayWaitingItem[];
  accounts?: AccountOption[];
  now: Date;
}): ExecutionTodayModel {
  const { phase } = input.phase;
  const todayKey = input.phase.todayKey;
  const tomorrowKey = addCalendarDays(todayKey, 1);
  const weekEndKey = input.phase.weddingKey ?? addCalendarDays(todayKey, 7);

  const dated = collectDatedItems({
    items: input.items,
    calendar: input.calendar,
    budgetItems: input.budgetItems,
    timezone: input.phase.timezone,
    todayKey,
  });

  const today = dated.filter((row) => row.dateKey === todayKey);
  const tomorrowDated = dated.filter((row) => row.dateKey === tomorrowKey);
  const laterThisWeek = dated
    .filter((row) => row.dateKey > tomorrowKey && row.dateKey <= weekEndKey)
    .slice(0, LATER_MAX);

  const placedIds = new Set<string>([
    ...today.map((row) => row.id),
    ...tomorrowDated.map((row) => row.id),
  ]);

  const attention = buildExecutionAttention(input.items, input.sections, input.budgetItems, {
    now: input.now,
    timezone: input.phase.timezone,
    todayKey,
    placedIds,
    accounts: input.accounts,
  });

  const waiting = rankWaitingForExecution(input.waiting, input.items, {
    timezone: input.phase.timezone,
    todayKey,
  });

  let tomorrow: ExecutionRow[] = [...tomorrowDated];
  let handoff: TodayHandoff | null = null;

  if (phase === "wedding_day") {
    handoff = {
      href: "/day",
      label: "Open today's schedule",
      title: "You're getting married.",
      support: "The day-of view has the schedule.",
    };
  } else if (phase === "day_before") {
    tomorrow = [dayBeforeHandoff(), ...tomorrowDated];
    handoff = {
      href: "/day",
      label: "Open today's schedule",
      title: "Tomorrow we get married.",
      support: "The day-of view is ready when you are.",
    };
  }

  const todayRows = phase === "wedding_day" ? [weddingDayHandoff(), ...today] : today;

  return {
    layout: phase,
    today: todayRows,
    tomorrow,
    tonight: [],
    laterThisWeek,
    attention,
    waiting,
    todayContext: todayRows.map(toTodayContext),
    comingUp: laterThisWeek
      .map(toComingUp)
      .filter((row): row is TodayComingUpItem => row !== null),
    todayEmpty:
      today.length === 0 && phase !== "wedding_day"
        ? { title: "Nothing scheduled.", support: "You have room to breathe." }
        : null,
    tomorrowEmpty:
      phase !== "wedding_day" && tomorrowDated.length === 0 && phase !== "day_before"
        ? { title: "Nothing on the calendar tomorrow.", support: "Only dated work will show here." }
        : null,
    handoff,
    pulseCompact: true,
  };
}

/**
 * Rehearsal TimelineBlocks never receive an invented calendar date.
 * They have times, not days. Do not turn them into execution rows.
 */
export function inventedDatesFromRehearsalBlocks(
  rehearsalBlocks: Array<{ id: string; startAt: string; notes: string }> | undefined,
): ExecutionRow[] {
  void rehearsalBlocks;
  return [];
}
