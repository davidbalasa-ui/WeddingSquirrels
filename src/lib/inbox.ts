import { startOfDay } from "date-fns";
import { prisma } from "@/lib/db";
import { assigneeDisplayNames } from "@/lib/people";
import { isRequestUnread, requestVisibilityWhere } from "@/lib/requests";
import { listOrgCards, listTasks } from "@/lib/tasks";
import { dueLabel } from "@/lib/tasks";
import type { SessionAccount } from "@/lib/types";

export type InboxKind = "ask" | "task" | "org_step" | "buy";

export type InboxAskMessage = {
  id: string;
  body: string;
  authorAccountId: string;
  authorName: string;
  createdAt: string;
};

export type InboxAskData = {
  senderAccountId: string;
  recipientAccountId: string;
  senderName: string;
  recipientName: string;
  note: string | null;
  declineNote: string | null;
  readAt: string | null;
  senderReadAt: string | null;
  createdAt: string;
  messages: InboxAskMessage[];
};

export type InboxItem = {
  id: string;
  kind: InboxKind;
  sourceId: string;
  title: string;
  done: boolean;
  ownerPersonIds: string[];
  ownerLabel: string;
  dueDate?: Date | null;
  groupKey?: "week_before" | "day_before";
  groupLabel?: string;
  sortOrder: number;
  unread?: boolean;
  needsMe?: boolean;
  waitingOnThem?: boolean;
  escalated?: boolean;
  declined?: boolean;
  linkedTaskId?: string | null;
  linkedTaskTitle?: string | null;
  href?: string;
  /** Plain-text next action / note shown under the title. Never a steps counter. */
  detail?: string | null;
  askData?: InboxAskData;
  meta?: {
    messageCount?: number;
    quantity?: string | null;
    note?: string | null;
    status?: string;
  };
};

export type InboxOrgGroup = {
  groupKey: "week_before" | "day_before";
  groupLabel: string;
  parentTaskId: string;
  title: string;
  dueDate: Date | null;
  childDone: number;
  childTotal: number;
  parentDone: boolean;
  escalated: boolean;
};

export type InboxSections = {
  needsYou: InboxItem[];
  waiting: InboxItem[];
  open: InboxItem[];
  orgGroups: { group: InboxOrgGroup; steps: InboxItem[] }[];
  done: InboxItem[];
};

export type InboxFilter = "needs-me" | "waiting" | "asks" | "tasks" | "buy" | null;

export type AccountOption = { id: string; name: string; linkedPersonId: string | null };

export type PersonOption = { id: string; name: string };

export type TaskOption = { id: string; title: string };

export type CalendarMilestone = { title: string; startDate: Date; endDate: Date };

export function canSeeHome(session: SessionAccount): boolean {
  return session.isMaster || session.canSeeRequests || session.canSeeTasks || session.canSeeShop;
}

export function canManageOwners(session: SessionAccount): boolean {
  return session.isMaster || !session.assigneeFilter?.length;
}

export function nextCoupleOwnerIds(current: string[]): string[] | null {
  const set = new Set(current);
  if ([...set].some((id) => id !== "david" && id !== "haley")) return null;
  const hasD = set.has("david");
  const hasH = set.has("haley");
  if (!hasD && !hasH) return ["david"];
  if (hasD && !hasH) return ["haley"];
  if (!hasD && hasH) return ["david", "haley"];
  return ["david"];
}

export function nextShoppingOwnerId(current: string | null): string | null {
  if (!current) return "david";
  if (current === "david") return "haley";
  return null;
}

export function nextCalendarMilestone(
  events: { title: string; startDate: Date; endDate: Date }[],
  today = new Date(),
): CalendarMilestone | null {
  const start = startOfDay(today);
  const upcoming = events
    .filter((e) => e.endDate >= start)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  return upcoming[0] ?? null;
}

function ownerLabelFromPersonIds(ids: string[], names: Map<string, string>): string {
  if (ids.length === 0) return "Unassigned";
  if (ids.length === 2 && ids.includes("david") && ids.includes("haley")) return "Both";
  return ids.map((id) => names.get(id) ?? id).join(" · ");
}

function shopOwnerLabel(ownerId: string | null, names: Map<string, string>): string {
  if (!ownerId) return "Both";
  return names.get(ownerId) ?? ownerId;
}

function joinPlain(parts: Array<string | null | undefined>): string | null {
  const cleaned = parts.map((part) => part?.trim() ?? "").filter(Boolean);
  const unique: string[] = [];
  for (const part of cleaned) {
    if (!unique.includes(part)) unique.push(part);
  }
  return unique.length ? unique.join(" · ") : null;
}

export function detailFromTaskPackage(task: {
  summary?: string | null;
  planNotes?: string | null;
  helpText?: string | null;
  children?: { title: string; status: string; sortOrder: number }[];
}): string | null {
  const remaining = [...(task.children ?? [])]
    .filter((child) => child.status !== "done")
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((child) => child.title.trim())
    .filter(Boolean);
  return joinPlain([...remaining, task.summary, task.planNotes, task.helpText]);
}

export function inboxDateLine(
  dueDate: Date | string | null | undefined,
  done: boolean,
): string | null {
  if (!dueDate || done) return null;
  const parsed = dueDate instanceof Date ? dueDate : new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) return null;
  const date = parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const rel = dueLabel(parsed, "todo");
  if (rel?.startsWith("Overdue")) return `${date} · overdue`;
  if (rel === "Due today") return `${date} · today`;
  if (rel === "Due tomorrow") return `${date} · tomorrow`;
  return date;
}

function openPackageRank(item: InboxItem): number {
  if (item.kind !== "task") return 9000;
  if (item.escalated) return -1;
  if (item.done) return 9000;
  if (!item.dueDate) return 8000;
  const label = dueLabel(item.dueDate, item.done ? "done" : "todo");
  if (label?.startsWith("Overdue")) return 0;
  if (label === "Due today") return 1;
  if (label?.startsWith("Due in")) return 2;
  return 3;
}

function sortOpenItems(items: InboxItem[]): InboxItem[] {
  const packages = items.filter((i) => i.kind === "task");
  const buy = items.filter((i) => i.kind === "buy");
  packages.sort((a, b) => {
    const ra = openPackageRank(a);
    const rb = openPackageRank(b);
    if (ra !== rb) return ra - rb;
    const da = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const db = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (da !== db) return da - db;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.title.localeCompare(b.title);
  });
  buy.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.title.localeCompare(b.title);
  });
  return [...packages, ...buy];
}

function classifyAsk(
  row: {
    status: string;
    senderAccountId: string;
    recipientAccountId: string;
    readAt: Date | null;
    senderReadAt: Date | null;
  },
  session: SessionAccount,
): { needsMe: boolean; waitingOnThem: boolean } {
  const open = row.status === "open";
  const needsMe = open && row.recipientAccountId === session.id;
  const waitingOnThem = open && row.senderAccountId === session.id;
  return { needsMe, waitingOnThem };
}

export async function listInboxItems(session: SessionAccount): Promise<InboxItem[]> {
  const peopleRows = await prisma.person.findMany({ orderBy: { sortOrder: "asc" } });
  let people = peopleRows;
  if (session.assigneeFilter?.length) {
    people = people.filter((p) => session.assigneeFilter!.includes(p.id));
  }
  const personNames = new Map(peopleRows.map((p) => [p.id, p.name]));

  const [requests, packages, orgCards, shopping] = await Promise.all([
    session.canSeeRequests
      ? prisma.request.findMany({
          where: requestVisibilityWhere(session),
          include: {
            senderAccount: { select: { id: true, name: true } },
            recipientAccount: { select: { id: true, name: true } },
            task: { select: { id: true, title: true } },
            messages: {
              orderBy: { sortOrder: "asc" },
              include: { authorAccount: { select: { id: true, name: true } } },
            },
          },
          orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        })
      : Promise.resolve([]),
    session.canSeeTasks ? listTasks(session, { showDone: true }) : Promise.resolve([]),
    session.canSeeTasks ? listOrgCards(session, { showDone: true }) : Promise.resolve([]),
    session.canSeeShop
      ? prisma.shoppingItem.findMany({
          include: {
            owner: { select: { id: true, name: true } },
            task: { select: { id: true, title: true } },
          },
          orderBy: [{ purchased: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  const items: InboxItem[] = [];

  for (const row of requests) {
    const { needsMe, waitingOnThem } = classifyAsk(row, session);
    const unread = isRequestUnread(session, row);
    items.push({
      id: `ask:${row.id}`,
      kind: "ask",
      sourceId: row.id,
      title: row.title,
      done: row.status === "done",
      declined: row.status === "declined",
      ownerPersonIds: [],
      ownerLabel:
        row.senderAccountId === session.id
          ? `To ${row.recipientAccount.name}`
          : `From ${row.senderAccount.name}`,
      sortOrder: row.updatedAt.getTime(),
      unread,
      needsMe,
      waitingOnThem,
      linkedTaskId: row.taskId,
      linkedTaskTitle: row.task?.title ?? null,
      meta: {
        messageCount: row.messages.length,
        status: row.status,
        note: row.note,
      },
      detail: joinPlain([
        row.note,
        row.messages.length ? row.messages[row.messages.length - 1]?.body : null,
        row.task?.title ? `Related: ${row.task.title}` : null,
      ]),
      askData: {
        senderAccountId: row.senderAccountId,
        recipientAccountId: row.recipientAccountId,
        senderName: row.senderAccount.name,
        recipientName: row.recipientAccount.name,
        note: row.note,
        declineNote: row.declineNote,
        readAt: row.readAt?.toISOString() ?? null,
        senderReadAt: row.senderReadAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        messages: row.messages.map((m) => ({
          id: m.id,
          body: m.body,
          authorAccountId: m.authorAccountId,
          authorName: m.authorAccount.name,
          createdAt: m.createdAt.toISOString(),
        })),
      },
    });
  }

  if (session.isMaster && session.canSeeRequests) {
    const placed = new Set<string>();
    for (const item of items) {
      if (item.kind !== "ask") continue;
      if (item.needsMe || item.waitingOnThem) placed.add(item.sourceId);
    }
    for (const item of items) {
      if (item.kind !== "ask") continue;
      if (item.done || item.declined) continue;
      if (placed.has(item.sourceId)) continue;
      item.needsMe = true;
      item.waitingOnThem = false;
    }
  }

  for (const task of packages) {
    const ownerIds = task.assignees.map((a) => a.personId);
    items.push({
      id: `task:${task.id}`,
      kind: "task",
      sourceId: task.id,
      title: task.title,
      done: task.status === "done",
      ownerPersonIds: ownerIds,
      ownerLabel: assigneeDisplayNames(task.assignees) || ownerLabelFromPersonIds(ownerIds, personNames),
      dueDate: task.dueDate,
      sortOrder: task.sortOrder,
      escalated: Boolean(task.escalatedAt),
      href: `/work/${task.id}`,
      detail: detailFromTaskPackage(task),
    });
  }

  if (orgCards.length > 0) {
    const childSteps = await prisma.task.findMany({
      where: { parentId: { in: orgCards.map((c) => c.id) } },
      include: { assignees: { include: { person: true } } },
      orderBy: { sortOrder: "asc" },
    });
    const parentOrgKey = new Map(orgCards.map((c) => [c.id, c.orgKey as "week_before" | "day_before"]));
    for (const step of childSteps) {
      const orgKey = parentOrgKey.get(step.parentId!);
      if (!orgKey) continue;
      const groupLabel = orgKey === "week_before" ? "Week before" : "Day before";
      const ownerIds = step.assignees.map((a) => a.personId);
      items.push({
        id: `org_step:${step.id}`,
        kind: "org_step",
        sourceId: step.id,
        title: step.title,
        done: step.status === "done",
        ownerPersonIds: ownerIds,
        ownerLabel: assigneeDisplayNames(step.assignees) || ownerLabelFromPersonIds(ownerIds, personNames),
        groupKey: orgKey,
        groupLabel,
        sortOrder: step.sortOrder,
        detail: joinPlain([step.summary, step.helpText, step.planNotes]),
        meta: { status: step.status },
      });
    }
  }

  for (const item of shopping) {
    items.push({
      id: `buy:${item.id}`,
      kind: "buy",
      sourceId: item.id,
      title: item.name,
      done: item.purchased,
      ownerPersonIds: item.ownerId ? [item.ownerId] : [],
      ownerLabel: shopOwnerLabel(item.ownerId, personNames),
      sortOrder: item.sortOrder,
      linkedTaskId: item.taskId,
      linkedTaskTitle: item.task?.title ?? null,
      detail: joinPlain([
        item.quantity,
        item.note,
        item.task?.title ? `For ${item.task.title}` : null,
      ]),
      meta: {
        quantity: item.quantity,
        note: item.note,
      },
    });
  }

  return items;
}

export function groupInboxItems(items: InboxItem[], session: SessionAccount): InboxSections {
  const needsYou: InboxItem[] = [];
  const waiting: InboxItem[] = [];
  const open: InboxItem[] = [];
  const done: InboxItem[] = [];
  const orgStepsByKey = new Map<"week_before" | "day_before", InboxItem[]>();

  for (const item of items) {
    if (item.kind === "ask") {
      if (item.done || item.declined) {
        done.push(item);
      } else if (item.needsMe) {
        needsYou.push(item);
      } else if (item.waitingOnThem) {
        waiting.push(item);
      } else {
        done.push(item);
      }
      continue;
    }

    if (item.kind === "org_step") {
      const key = item.groupKey!;
      const list = orgStepsByKey.get(key) ?? [];
      list.push(item);
      orgStepsByKey.set(key, list);
      if (item.done) done.push(item);
      continue;
    }

    if (item.done) {
      done.push(item);
      continue;
    }

    open.push(item);
  }

  const orgGroups: InboxSections["orgGroups"] = [];
  for (const groupKey of ["week_before", "day_before"] as const) {
    const steps = (orgStepsByKey.get(groupKey) ?? []).filter((s) => !s.done);
    if (steps.length === 0) continue;
    const childDone = (orgStepsByKey.get(groupKey) ?? []).filter((s) => s.done).length;
    const childTotal = (orgStepsByKey.get(groupKey) ?? []).length;
    orgGroups.push({
      group: {
        groupKey,
        groupLabel: groupKey === "week_before" ? "Week before" : "Day before",
        parentTaskId: "",
        title: groupKey === "week_before" ? "Week before" : "Day before",
        dueDate: null,
        childDone,
        childTotal,
        parentDone: false,
        escalated: false,
      },
      steps: steps.sort((a, b) => a.sortOrder - b.sortOrder),
    });
  }

  needsYou.sort((a, b) => (b.unread ? 1 : 0) - (a.unread ? 1 : 0) || b.sortOrder - a.sortOrder);
  waiting.sort((a, b) => b.sortOrder - a.sortOrder);

  return {
    needsYou,
    waiting,
    open: sortOpenItems(open),
    orgGroups,
    done,
  };
}

function taskMatchesWho(item: InboxItem, who: string): boolean {
  const ids = item.ownerPersonIds;
  if (who === "both") return ids.includes("david") && ids.includes("haley");
  if (who === "david") return ids.includes("david") && !ids.includes("haley");
  if (who === "haley") return ids.includes("haley") && !ids.includes("david");
  return ids.includes(who);
}

function buyMatchesWho(item: InboxItem, who: string): boolean {
  if (who === "both") return item.ownerPersonIds.length === 0;
  if (who === "david") return item.ownerPersonIds[0] === "david";
  if (who === "haley") return item.ownerPersonIds[0] === "haley";
  return false;
}

function askMatchesWho(
  item: InboxItem,
  who: string,
  accounts: AccountOption[],
): boolean {
  if (!item.askData) return true;
  const accountIds = accounts.filter((a) => a.linkedPersonId === who).map((a) => a.id);
  if (accountIds.length === 0) return true;
  return (
    accountIds.includes(item.askData.senderAccountId) ||
    accountIds.includes(item.askData.recipientAccountId)
  );
}

function matchesNeedsMeFilter(item: InboxItem, session: SessionAccount): boolean {
  if (item.needsMe) return true;
  const personIds = session.assigneeFilter?.length
    ? session.assigneeFilter
    : session.linkedPersonId
      ? [session.linkedPersonId]
      : null;
  if (!personIds?.length) return false;
  if (item.kind === "task" || item.kind === "org_step") {
    return item.ownerPersonIds.some((id) => personIds.includes(id));
  }
  if (item.kind === "buy") {
    return item.ownerPersonIds.some((id) => personIds.includes(id));
  }
  return false;
}

function itemPassesFilter(
  item: InboxItem,
  filter: InboxFilter,
  who: string,
  session: SessionAccount,
  accounts: AccountOption[],
): boolean {
  if (filter === "needs-me" && !matchesNeedsMeFilter(item, session)) return false;
  if (filter === "waiting" && !item.waitingOnThem) return false;
  if (filter === "asks" && item.kind !== "ask") return false;
  if (filter === "tasks" && item.kind !== "task" && item.kind !== "org_step") return false;
  if (filter === "buy" && item.kind !== "buy") return false;

  if (who !== "all") {
    if (item.kind === "ask" && who === "both") {
      // no-op
    } else if (item.kind === "ask" && !askMatchesWho(item, who, accounts)) {
      return false;
    } else if (item.kind === "task" || item.kind === "org_step") {
      if (!taskMatchesWho(item, who)) return false;
    } else if (item.kind === "buy" && !buyMatchesWho(item, who)) {
      return false;
    }
  }

  return true;
}

export function filterInboxSections(
  sections: InboxSections,
  opts: {
    filter: InboxFilter;
    who: string;
    showDone: boolean;
    session: SessionAccount;
    accounts: AccountOption[];
  },
): InboxSections {
  const { filter, who, showDone, session, accounts } = opts;
  const pass = (item: InboxItem) => itemPassesFilter(item, filter, who, session, accounts);

  return {
    needsYou: sections.needsYou.filter(pass),
    waiting: sections.waiting.filter(pass),
    open: sections.open.filter(pass),
    orgGroups: sections.orgGroups
      .map((og) => ({
        ...og,
        steps: og.steps.filter(pass),
      }))
      .filter((og) => og.steps.length > 0),
    done: showDone ? sections.done.filter(pass) : [],
  };
}

export function buildWhoChips(people: PersonOption[]): { id: string; label: string }[] {
  const chips: { id: string; label: string }[] = [{ id: "all", label: "All" }];
  const hasDavid = people.some((p) => p.id === "david");
  const hasHaley = people.some((p) => p.id === "haley");
  const preferred = ["david", "haley"];
  for (const id of preferred) {
    const person = people.find((p) => p.id === id);
    if (person) {
      chips.push({
        id: person.id,
        label: person.id === "david" ? "David" : "Haley",
      });
    }
  }
  if (hasDavid && hasHaley) chips.push({ id: "both", label: "Both" });
  for (const person of people) {
    if (preferred.includes(person.id)) continue;
    chips.push({ id: person.id, label: person.name });
  }
  return chips;
}

export async function loadInboxPageData(session: SessionAccount) {
  const peopleRows = await prisma.person.findMany({ orderBy: { sortOrder: "asc" } });
  let people = peopleRows;
  if (session.assigneeFilter?.length) {
    people = people.filter((p) => session.assigneeFilter!.includes(p.id));
  }

  const [items, accounts, tasks, events] = await Promise.all([
    listInboxItems(session),
    prisma.pinAccount.findMany({
      orderBy: [{ isMaster: "desc" }, { name: "asc" }],
      select: { id: true, name: true, linkedPersonId: true },
    }),
    session.canSeeTasks
      ? prisma.task.findMany({
          where: { parentId: null, orgKey: null },
          orderBy: { title: "asc" },
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
    session.canSeeCalendar
      ? prisma.calendarEvent.findMany({ orderBy: { startDate: "asc" } })
      : Promise.resolve([]),
  ]);

  const orgCards = session.canSeeTasks
    ? await listOrgCards(session, { showDone: true })
    : [];
  const orgParentByKey = new Map(orgCards.map((c) => [c.orgKey, c]));

  const grouped = groupInboxItems(items, session);
  for (const og of grouped.orgGroups) {
    const parent = orgParentByKey.get(og.group.groupKey);
    if (parent) {
      og.group.parentTaskId = parent.id;
      og.group.title = parent.title;
      og.group.dueDate = parent.dueDate;
      og.group.parentDone = parent.status === "done";
      og.group.escalated = Boolean(parent.escalatedAt);
      const allSteps = items.filter((i) => i.kind === "org_step" && i.groupKey === og.group.groupKey);
      og.group.childDone = allSteps.filter((s) => s.done).length;
      og.group.childTotal = allSteps.length;
    }
  }

  const milestone = nextCalendarMilestone(
    events.map((e) => ({ title: e.title, startDate: e.startDate, endDate: e.endDate })),
  );

  return {
    items,
    sections: grouped,
    people: people.map((p) => ({ id: p.id, name: p.name })),
    accounts,
    tasks,
    milestone,
    whoChips: buildWhoChips(people.map((p) => ({ id: p.id, name: p.name }))),
  };
}
