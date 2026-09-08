"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toggleTaskDone } from "@/app/actions";
import type { InboxOrgGroup } from "@/lib/inbox";
import { inboxDateLine } from "@/lib/inbox";
import { taskHref } from "@/lib/entity-links";

export function InboxGroupHeader({
  group,
  collapsed,
  onToggleCollapse,
  originHref,
}: {
  group: InboxOrgGroup;
  collapsed: boolean;
  onToggleCollapse: () => void;
  originHref?: string;
}) {
  const [pending, startTransition] = useTransition();
  const dateLine = inboxDateLine(group.dueDate, group.parentDone);
  const workspaceHref = group.parentTaskId
    ? taskHref(group.parentTaskId, { returnTo: originHref })
    : null;

  return (
    <div className="flex items-center gap-2 py-1.5">
      {group.parentTaskId ? (
        <button
          type="button"
          aria-label={group.parentDone ? "Mark card not done" : "Mark card done"}
          disabled={pending}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-line text-[11px] leading-none"
          style={{
            background: group.parentDone ? "var(--accent)" : "transparent",
            color: group.parentDone ? "white" : "transparent",
            borderColor: group.parentDone ? "var(--accent)" : undefined,
          }}
          onClick={() => startTransition(() => toggleTaskDone(group.parentTaskId))}
        >
          {group.parentDone ? "✓" : ""}
        </button>
      ) : null}
      {workspaceHref ? (
        <Link href={workspaceHref} className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            {group.groupLabel}
            {dateLine ? ` · ${dateLine}` : ""}
          </p>
          {group.title !== group.groupLabel ? (
            <p className="text-sm font-semibold leading-snug">{group.title}</p>
          ) : null}
        </Link>
      ) : (
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onToggleCollapse}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            {group.groupLabel}
            {dateLine ? ` · ${dateLine}` : ""}
          </p>
          {group.title !== group.groupLabel ? (
            <p className="text-sm font-semibold leading-snug">{group.title}</p>
          ) : null}
        </button>
      )}
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
