"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { createRequestFromItem, markRequestRead, reorderInboxItems } from "@/app/actions";
import { InboxAddBar } from "@/components/InboxAddBar";
import { InboxGroupHeader } from "@/components/InboxGroup";
import { InboxRow } from "@/components/InboxRow";
import {
  filterInboxSections,
  type AccountOption,
  type InboxFilter,
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
  const [dragSourceId, setDragSourceId] = useState<string | null>(null);
  const [askComposePrefill, setAskComposePrefill] = useState<{ kind: "task" | "buy"; id: string } | null>(null);

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

  function onDropReorder(
    kind: "task" | "buy",
    targetSourceId: string,
    draggedSourceId: string,
    items: { sourceId: string }[],
  ) {
    if (draggedSourceId === targetSourceId) return;
    const ids = items.map((i) => i.sourceId);
    const from = ids.indexOf(draggedSourceId);
    const to = ids.indexOf(targetSourceId);
    if (from < 0 || to < 0) return;
    const reordered = [...ids];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved!);
    startTransition(() => reorderInboxItems(kind, reordered));
  }

  const openPackages = filtered.open.filter((i) => i.kind === "task");
  const openBuy = filtered.open.filter((i) => i.kind === "buy");

  return (
    <div className="flex flex-col gap-3 pb-4">
      <InboxAddBar
        session={session}
        accounts={accounts}
        people={people}
        tasks={tasks}
        preferredAssigneeIds={
          who !== "all" && who !== "both" ? [who] : who === "both" ? ["david", "haley"] : undefined
        }
      />

      <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
        {FILTER_CHIPS.filter((chip) => {
          if (vendorOnly && (chip.key === "tasks" || chip.key === "buy")) return false;
          if (!session.canSeeRequests && (chip.key === "needs-me" || chip.key === "waiting" || chip.key === "asks"))
            return false;
          return true;
        }).map((chip) => {
          const active = chip.key === "all" ? !filter : filter === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              className="filter-pill shrink-0 rounded-full border px-3 py-2 text-sm font-semibold"
              data-active={active}
              style={
                active
                  ? {
                      borderColor: "var(--accent)",
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                    }
                  : undefined
              }
              onClick={() =>
                pushParams({ filter: chip.key === "all" ? null : chip.param ?? null })
              }
            >
              {chip.label}
            </button>
          );
        })}
        {whoChips
          .filter((w) => w.id !== "all")
          .map((chip) => {
            const active = who === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                className="filter-pill shrink-0 rounded-full border px-3 py-2 text-sm font-semibold"
                data-active={active}
                style={
                  active
                    ? {
                        borderColor: "var(--accent)",
                        background: "var(--accent-soft)",
                        color: "var(--accent)",
                      }
                    : undefined
                }
                onClick={() => pushParams({ who: chip.id === "all" ? null : chip.id })}
              >
                {chip.label}
              </button>
            );
          })}
        <button
          type="button"
          className="filter-pill shrink-0 rounded-full border px-3 py-2 text-sm font-semibold"
          data-active={showDone}
          style={
            showDone
              ? {
                  borderColor: "var(--accent)",
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                }
              : undefined
          }
          onClick={() => pushParams({ done: showDone ? null : "1" })}
        >
          Done
        </button>
      </div>

      {session.canSeeRequests ? (
        <Section title={`Needs you${filtered.needsYou.length ? ` · ${filtered.needsYou.length}` : ""}`}>
          {filtered.needsYou.length === 0 ? (
            <p className="px-1 text-sm text-muted">You&apos;re caught up — nothing waiting on you.</p>
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
            <p className="px-1 text-sm text-muted">Nothing open — add something above.</p>
          ) : (
            <>
              {openPackages.map((item) => (
                <DraggableRow
                  key={item.id}
                  item={item}
                  kind="task"
                  dragSourceId={dragSourceId}
                  setDragSourceId={setDragSourceId}
                  onDrop={(targetSourceId, draggedSourceId) =>
                    onDropReorder("task", targetSourceId, draggedSourceId, openPackages)
                  }
                >
                  <InboxRow
                    item={item}
                    session={session}
                    tasks={tasks}
                    expanded={false}
                    onToggleExpand={() => {}}
                    onAskSomeone={
                      session.canSeeRequests
                        ? () => setAskComposePrefill({ kind: "task", id: item.sourceId })
                        : undefined
                    }
                  />
                </DraggableRow>
              ))}
              {openBuy.map((item) => (
                <DraggableRow
                  key={item.id}
                  item={item}
                  kind="buy"
                  dragSourceId={dragSourceId}
                  setDragSourceId={setDragSourceId}
                  onDrop={(targetSourceId, draggedSourceId) =>
                    onDropReorder("buy", targetSourceId, draggedSourceId, openBuy)
                  }
                >
                  <InboxRow
                    item={item}
                    session={session}
                    tasks={tasks}
                    expanded={false}
                    onToggleExpand={() => {}}
                    onAskSomeone={
                      session.canSeeRequests
                        ? () => setAskComposePrefill({ kind: "buy", id: item.sourceId })
                        : undefined
                    }
                  />
                </DraggableRow>
              ))}
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      {title ? (
        <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{title}</p>
      ) : null}
      {children}
    </section>
  );
}

function DraggableRow({
  item,
  dragSourceId,
  setDragSourceId,
  onDrop,
  children,
}: {
  item: { sourceId: string };
  kind: "task" | "buy";
  dragSourceId: string | null;
  setDragSourceId: (id: string | null) => void;
  onDrop: (targetSourceId: string, draggedSourceId: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      draggable
      onDragStart={() => setDragSourceId(item.sourceId)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (dragSourceId) onDrop(item.sourceId, dragSourceId);
        setDragSourceId(null);
      }}
      className="flex items-stretch gap-1"
    >
      <button
        type="button"
        className="mt-3 shrink-0 cursor-grab px-1 text-muted active:cursor-grabbing"
        aria-label="Drag to reorder"
        onPointerDown={(e) => e.stopPropagation()}
      >
        ⠿
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
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
