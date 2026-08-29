"use client";

import { useTransition } from "react";
import { toggleTaskDone } from "@/app/actions";
import type { InboxOrgGroup } from "@/lib/inbox";
import { dueLabel } from "@/lib/tasks";

export function InboxGroupHeader({
  group,
  collapsed,
  onToggleCollapse,
}: {
  group: InboxOrgGroup;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const label = dueLabel(group.dueDate, group.parentDone ? "done" : "todo");

  return (
    <div
      className="flex items-center gap-2 rounded-xl border px-3 py-2.5"
      style={{
        borderColor: group.groupKey === "week_before" ? "#c4b28a" : "#9bb7ae",
        background:
          group.groupKey === "week_before"
            ? "linear-gradient(135deg, #f7f1e4 0%, #fffdf8 70%)"
            : "linear-gradient(135deg, #e7f0ec 0%, #fffdf8 70%)",
      }}
    >
      {group.parentTaskId ? (
        <button
          type="button"
          aria-label={group.parentDone ? "Mark card not done" : "Mark card done"}
          disabled={pending}
          className="step-check shrink-0"
          style={{
            background: group.parentDone ? "var(--accent)" : "transparent",
            color: group.parentDone ? "white" : "var(--muted)",
          }}
          onClick={() => startTransition(() => toggleTaskDone(group.parentTaskId))}
        >
          {group.parentDone ? "✓" : ""}
        </button>
      ) : null}
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={onToggleCollapse}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
          {group.groupLabel} · {group.childDone}/{group.childTotal}
        </p>
        <p className="text-sm font-semibold leading-snug">{group.title}</p>
        {label ? <p className="mt-0.5 text-xs text-muted">{label}</p> : null}
      </button>
      <button
        type="button"
        className="shrink-0 px-2 text-sm text-muted"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
      >
        {collapsed ? "+" : "−"}
      </button>
    </div>
  );
}
