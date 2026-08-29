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
    <div className="flex items-center gap-2 border-b border-line bg-[color-mix(in_srgb,var(--accent-soft)_40%,transparent)] px-2 py-1.5">
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
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onToggleCollapse}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
          {group.groupLabel} · {group.childDone}/{group.childTotal}
          {label ? ` · ${label}` : ""}
        </p>
        <p className="text-sm font-semibold leading-snug">{group.title}</p>
      </button>
      <button
        type="button"
        className="shrink-0 px-1 text-sm text-muted"
        onClick={onToggleCollapse}
        aria-expanded={!collapsed}
      >
        {collapsed ? "+" : "−"}
      </button>
    </div>
  );
}
