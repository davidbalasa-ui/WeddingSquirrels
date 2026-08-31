"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition, type ReactNode } from "react";
import { markRequestRead } from "@/app/actions";
import { InboxAddBar } from "@/components/InboxAddBar";
import { InboxGroupHeader } from "@/components/InboxGroup";
import { InboxNoteRow, InboxPackageHeader } from "@/components/InboxNoteRow";
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
  hidePrioritySections = false,
}: {
  session: SessionAccount;
  sections: InboxSections;
  accounts: AccountOption[];
  people: PersonOption[];
  tasks: TaskOption[];
  whoChips: { id: string; label: string }[];
  hidePrioritySections?: boolean;
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

  function isGroupCollapsed(groupKey: string) {
    if (groupKey in collapsedGroups) return collapsedGroups[groupKey];
    if (typeof window === "undefined") return false;
    return localStorage.getItem(collapseKey(groupKey)) === "1";
  }

  const pushParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      const q = next.toString();
      router.push(q ? `/today?${q}` : "/today");
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

  const openGroups = filtered.openGroups ?? [];
  const openBuy = filtered.openBuy ?? filtered.open.filter((item) => item.kind === "buy");

  const filterButtons = FILTER_CHIPS.filter((chip) => {
    if (vendorOnly && (chip.key === "tasks" || chip.key === "buy")) return false;
    if (!session.canSeeRequests && (chip.key === "needs-me" || chip.key === "waiting" || chip.key === "asks"))
      return false;
    return true;
  });

  const whoButtons = whoChips.filter((chip) => chip.id !== "all");

  return (
    <div className="flex flex-col pb-4">
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

      {session.canSeeRequests && !hidePrioritySections ? (
        <Section title={`Needs you${filtered.needsYou.length ? ` · ${filtered.needsYou.length}` : ""}`}>
          {filtered.needsYou.length === 0 ? (
            <p className="py-2 text-sm text-muted">You&apos;re caught up — nothing waiting on you.</p>
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

      {session.canSeeRequests && !hidePrioritySections && filtered.waiting.length > 0 ? (
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
          {openGroups.length === 0 && openBuy.length === 0 ? (
            <p className="py-2 text-sm text-muted">Nothing open — add something above.</p>
          ) : (
            <>
              {openGroups.map((og) =>
                og.hasChildren ? (
                  <div key={og.package.id} className="divide-y divide-[var(--line)]">
                    <InboxPackageHeader item={og.package} session={session} people={people} />
                    {og.steps.map((step) => (
                      <div key={step.id} className="pl-3">
                        <InboxNoteRow item={step} session={session} people={people} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <InboxNoteRow key={og.package.id} item={og.package} session={session} people={people} />
                ),
              )}
              {openBuy.map((item) => (
                <InboxNoteRow key={item.id} item={item} session={session} people={people} />
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
                collapsed={isGroupCollapsed(og.group.groupKey)}
                onToggleCollapse={() => toggleGroupCollapse(og.group.groupKey)}
              />
              {!isGroupCollapsed(og.group.groupKey)
                ? og.steps.map((item) => (
                    <InboxNoteRow key={item.id} item={item} session={session} people={people} />
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
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      {title ? (
        <p className="pt-3 pb-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
          {title}
        </p>
      ) : null}
      <div className="divide-y divide-[var(--line)] border-t border-line">{children}</div>
    </section>
  );
}
