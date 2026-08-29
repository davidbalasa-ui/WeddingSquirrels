"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createRequestFromItem, markRequestRead, reorderInboxItems } from "@/app/actions";
import { InboxAddBar } from "@/components/InboxAddBar";
import { InboxGroupHeader } from "@/components/InboxGroup";
import { InboxRow } from "@/components/InboxRow";
import {
  filterInboxSections,
  type AccountOption,
  type InboxFilter,
  type InboxItem,
  type InboxSections,
  type PersonOption,
  type TaskOption,
} from "@/lib/inbox";
import type { SessionAccount } from "@/lib/types";

const FILTER_CHIPS: { key: InboxFilter | "all"; label: string; param?: string }[] = [
  { key: "all", label: "All" },
  { key: "needs-me", label: "Needs me", param: "needs-me" },
  { key: "waiting", label: "Waiting", param: "waiting" },
  { key: "asks", label: "Asks", param: "asks" },
  { key: "tasks", label: "Tasks", param: "tasks" },
  { key: "buy", label: "Buy", param: "buy" },
];

function collapseKey(groupKey: string) {
  return `inbox-collapse:${groupKey}`;
}

function orderItems(items: InboxItem[], order: string[] | null) {
  if (!order) return items;
  const byId = new Map(items.map((item) => [item.sourceId, item]));
  const ordered = order.map((id) => byId.get(id)).filter((item): item is InboxItem => Boolean(item));
  for (const item of items) {
    if (!order.includes(item.sourceId)) ordered.push(item);
  }
  return ordered;
}

export function InboxBoard({
  session,
  sections,
  accounts,
  people,
  tasks,
  whoChips,
}: {
  session: SessionAccount;
  sections: InboxSections;
  accounts: AccountOption[];
  people: PersonOption[];
  tasks: TaskOption[];
  whoChips: { id: string; label: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const filterParam = params.get("filter");
  const who = params.get("who") || "all";
  const showDone = params.get("done") === "1";

  const filter: InboxFilter =
    filterParam === "needs-me" ||
    filterParam === "waiting" ||
    filterParam === "asks" ||
    filterParam === "tasks" ||
    filterParam === "buy"
      ? filterParam
      : null;

  const filtered = useMemo(
    () =>
      filterInboxSections(sections, {
        filter,
        who,
        showDone,
        session,
        accounts,
      }),
    [sections, filter, who, showDone, session, accounts],
  );

  const [expandedAskId, setExpandedAskId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [askComposePrefill, setAskComposePrefill] = useState<{ kind: "task" | "buy"; id: string } | null>(null);
  const [taskOrder, setTaskOrder] = useState<string[] | null>(null);
  const [buyOrder, setBuyOrder] = useState<string[] | null>(null);

  const openTaskIds = useMemo(
    () => filtered.open.filter((item) => item.kind === "task").map((item) => item.sourceId).join(","),
    [filtered.open],
  );
  const openBuyIds = useMemo(
    () => filtered.open.filter((item) => item.kind === "buy").map((item) => item.sourceId).join(","),
    [filtered.open],
  );

  useEffect(() => {
    setTaskOrder(null);
  }, [openTaskIds]);

  useEffect(() => {
    setBuyOrder(null);
  }, [openBuyIds]);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const og of sections.orgGroups) {
      const stored = localStorage.getItem(collapseKey(og.group.groupKey));
      next[og.group.groupKey] = stored === "1";
    }
    setCollapsedGroups(next);
  }, [sections.orgGroups]);

  const pushParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      const q = next.toString();
      router.push(q ? `/home?${q}` : "/home");
    },
    [params, router],
  );

  const vendorOnly = session.canSeeRequests && !session.canSeeTasks && !session.canSeeShop;

  function toggleGroupCollapse(groupKey: string) {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [groupKey]: !prev[groupKey] };
      localStorage.setItem(collapseKey(groupKey), next[groupKey] ? "1" : "0");
      return next;
    });
  }

  function handleAskToggle(itemId: string, sourceId: string, open: boolean) {
    setExpandedAskId(open ? itemId : null);
    if (open) {
      startTransition(async () => {
        await markRequestRead(sourceId);
      });
    }
  }

  function persistReorder(kind: "task" | "buy", orderedIds: string[]) {
    startTransition(() => reorderInboxItems(kind, orderedIds));
  }

  const openPackages = orderItems(
    filtered.open.filter((item) => item.kind === "task"),
    taskOrder,
  );
  const openBuy = orderItems(
    filtered.open.filter((item) => item.kind === "buy"),
    buyOrder,
  );

  const filterButtons = FILTER_CHIPS.filter((chip) => {
    if (vendorOnly && (chip.key === "tasks" || chip.key === "buy")) return false;
    if (!session.canSeeRequests && (chip.key === "needs-me" || chip.key === "waiting" || chip.key === "asks"))
      return false;
    return true;
  });

  const whoButtons = whoChips.filter((chip) => chip.id !== "all");

  return (
    <div className="flex flex-col gap-2 pb-4">
      <InboxAddBar
        session={session}
        accounts={accounts}
        people={people}
        tasks={tasks}
        preferredAssigneeIds={
          who !== "all" && who !== "both" ? [who] : who === "both" ? ["david", "haley"] : undefined
        }
      />

      <div className="border-b border-line">
        <div className="-mx-1 flex gap-0 overflow-x-auto">
          {filterButtons.map((chip) => {
            const active = chip.key === "all" ? !filter : filter === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                className={`shrink-0 border-b-2 px-2.5 py-2 text-sm font-semibold ${
                  active
                    ? "border-[var(--accent)] text-[var(--accent)]"
                    : "border-transparent text-muted"
                }`}
                onClick={() => pushParams({ filter: chip.key === "all" ? null : chip.param ?? null })}
              >
                {chip.label}
              </button>
            );
          })}
          {whoButtons.map((chip) => {
            const active = who === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                className={`shrink-0 border-b-2 px-2.5 py-2 text-sm font-semibold ${
                  active
                    ? "border-[var(--accent)] text-[var(--accent)]"
                    : "border-transparent text-muted"
                }`}
                onClick={() => pushParams({ who: chip.id === "all" ? null : chip.id })}
              >
                {chip.label}
              </button>
            );
          })}
          <button
            type="button"
            className={`shrink-0 border-b-2 px-2.5 py-2 text-sm font-semibold ${
              showDone
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-muted"
            }`}
            onClick={() => pushParams({ done: showDone ? null : "1" })}
          >
            Done
          </button>
        </div>
      </div>

      {session.canSeeRequests ? (
        <Section title={`Needs you${filtered.needsYou.length ? ` · ${filtered.needsYou.length}` : ""}`}>
          {filtered.needsYou.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted">You&apos;re caught up — nothing waiting on you.</p>
          ) : (
            filtered.needsYou.map((item) => (
              <InboxRow
                key={item.id}
                item={item}
                session={session}
                tasks={tasks}
                expanded={expandedAskId === item.id}
                onToggleExpand={() =>
                  handleAskToggle(item.id, item.sourceId, expandedAskId !== item.id)
                }
              />
            ))
          )}
        </Section>
      ) : null}

      {session.canSeeRequests && filtered.waiting.length > 0 ? (
        <Section title={`Waiting · ${filtered.waiting.length}`}>
          {filtered.waiting.map((item) => (
            <InboxRow
              key={item.id}
              item={item}
              session={session}
              tasks={tasks}
              expanded={expandedAskId === item.id}
              onToggleExpand={() =>
                handleAskToggle(item.id, item.sourceId, expandedAskId !== item.id)
              }
            />
          ))}
        </Section>
      ) : null}

      {!vendorOnly ? (
        <Section title="Open">
          {filtered.open.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted">Nothing open — add something above.</p>
          ) : (
            <>
              {openPackages.length > 0 ? (
                <OpenReorderList
                  listId="inbox-open-tasks"
                  items={openPackages}
                  onPersist={(ids) => persistReorder("task", ids)}
                  onOrderChange={setTaskOrder}
                  renderRow={(item, dragHandle) => (
                    <InboxRow
                      item={item}
                      session={session}
                      tasks={tasks}
                      expanded={false}
                      onToggleExpand={() => {}}
                      dragHandle={dragHandle}
                      onAskSomeone={
                        session.canSeeRequests
                          ? () => setAskComposePrefill({ kind: "task", id: item.sourceId })
                          : undefined
                      }
                    />
                  )}
                />
              ) : null}
              {openBuy.length > 0 ? (
                <OpenReorderList
                  listId="inbox-open-buy"
                  items={openBuy}
                  onPersist={(ids) => persistReorder("buy", ids)}
                  onOrderChange={setBuyOrder}
                  renderRow={(item, dragHandle) => (
                    <InboxRow
                      item={item}
                      session={session}
                      tasks={tasks}
                      expanded={false}
                      onToggleExpand={() => {}}
                      dragHandle={dragHandle}
                      onAskSomeone={
                        session.canSeeRequests
                          ? () => setAskComposePrefill({ kind: "buy", id: item.sourceId })
                          : undefined
                      }
                    />
                  )}
                />
              ) : null}
            </>
          )}
        </Section>
      ) : null}

      {!vendorOnly
        ? filtered.orgGroups.map((og) => (
            <Section key={og.group.groupKey} title="">
              <InboxGroupHeader
                group={og.group}
                collapsed={Boolean(collapsedGroups[og.group.groupKey])}
                onToggleCollapse={() => toggleGroupCollapse(og.group.groupKey)}
              />
              {!collapsedGroups[og.group.groupKey]
                ? og.steps.map((item) => (
                    <InboxRow
                      key={item.id}
                      item={item}
                      session={session}
                      tasks={tasks}
                      expanded={false}
                      onToggleExpand={() => {}}
                    />
                  ))
                : null}
            </Section>
          ))
        : null}

      {showDone && filtered.done.length > 0 ? (
        <Section title={`Done · ${filtered.done.length}`}>
          {filtered.done.map((item) => (
            <InboxRow
              key={item.id}
              item={item}
              session={session}
              tasks={tasks}
              expanded={expandedAskId === item.id}
              onToggleExpand={() => {
                if (item.kind !== "ask") return;
                handleAskToggle(item.id, item.sourceId, expandedAskId !== item.id);
              }}
            />
          ))}
        </Section>
      ) : null}

      {askComposePrefill ? (
        <AskFromRowModal
          session={session}
          accounts={accounts}
          prefill={askComposePrefill}
          onClose={() => setAskComposePrefill(null)}
        />
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-line">
      {title ? (
        <div className="border-b border-line bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] px-3 py-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{title}</p>
        </div>
      ) : null}
      <div className="divide-y divide-[var(--line)]">{children}</div>
    </section>
  );
}

function OpenReorderList({
  listId,
  items,
  onPersist,
  onOrderChange,
  renderRow,
}: {
  listId: string;
  items: InboxItem[];
  onPersist: (ids: string[]) => void;
  onOrderChange: (ids: string[] | null) => void;
  renderRow: (item: InboxItem, dragHandle: ReactNode) => ReactNode;
}) {
  const peerIds = items.map((item) => item.sourceId);
  const reorderable = peerIds.length > 1;

  function handleReorder(nextIds: string[], persist = false) {
    onOrderChange(nextIds);
    if (persist) onPersist(nextIds);
  }

  return (
    <>
      {items.map((item) => (
        <div key={item.id} id={`${listId}-row-${item.sourceId}`}>
          {renderRow(
            item,
            reorderable ? (
              <DragHandle
                listId={listId}
                rowId={item.sourceId}
                peerIds={peerIds}
                onReorder={handleReorder}
              />
            ) : null,
          )}
        </div>
      ))}
    </>
  );
}

function DragHandle({
  listId,
  rowId,
  peerIds,
  onReorder,
}: {
  listId: string;
  rowId: string;
  peerIds: string[];
  onReorder: (ids: string[], persist?: boolean) => void;
}) {
  const index = peerIds.indexOf(rowId);
  if (index < 0) return null;

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const startY = event.clientY;
    let current = [...peerIds];
    let lastIndex = current.indexOf(rowId);

    function yToIndex(clientY: number) {
      const mids = current.map((id) => {
        const el = document.getElementById(`${listId}-row-${id}`);
        if (!el) return Number.POSITIVE_INFINITY;
        const rect = el.getBoundingClientRect();
        return rect.top + rect.height / 2;
      });
      let best = lastIndex;
      let bestDist = Number.POSITIVE_INFINITY;
      mids.forEach((mid, i) => {
        const dist = Math.abs(mid - clientY);
        if (dist < bestDist) {
          best = i;
          bestDist = dist;
        }
      });
      return best;
    }

    function onMove(moveEvent: PointerEvent) {
      if (Math.abs(moveEvent.clientY - startY) < 8) return;
      const nextIndex = yToIndex(moveEvent.clientY);
      if (nextIndex === lastIndex) return;
      lastIndex = nextIndex;
      const next = current.filter((id) => id !== rowId);
      next.splice(nextIndex, 0, rowId);
      current = next;
      onReorder(next, false);
    }

    function onUp() {
      handle.releasePointerCapture(event.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      onReorder(current, true);
    }

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  }

  return (
    <button
      type="button"
      aria-label="Drag to reorder"
      className="mt-0.5 shrink-0 touch-none px-1 text-sm text-muted active:text-ink"
      onPointerDown={onPointerDown}
    >
      ≡
    </button>
  );
}

function AskFromRowModal({
  session,
  accounts,
  prefill,
  onClose,
}: {
  session: SessionAccount;
  accounts: AccountOption[];
  prefill: { kind: "task" | "buy"; id: string };
  onClose: () => void;
}) {
  const recipients = accounts.filter((a) => a.id !== session.id);
  const [pending, startTransition] = useTransition();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <form
        className="card w-full max-w-md p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const fd = new FormData(event.currentTarget);
          const recipientAccountId = String(fd.get("recipientAccountId") || "");
          startTransition(async () => {
            await createRequestFromItem({
              kind: prefill.kind,
              sourceId: prefill.id,
              recipientAccountId,
            });
            onClose();
          });
        }}
      >
        <p className="mb-3 text-sm font-semibold">Ask someone about this</p>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-xs text-muted">To</span>
          <select name="recipientAccountId" required className="field-input" defaultValue="">
            <option value="" disabled>
              Choose who…
            </option>
            {recipients.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary min-h-[44px]" disabled={pending}>
            Send ask
          </button>
          <button type="button" className="btn-secondary min-h-[44px]" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
