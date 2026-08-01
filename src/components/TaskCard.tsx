"use client";

import Link from "next/link";
import { EscalatePriorityButton } from "@/components/EscalatePriorityButton";
import { dueLabel } from "@/lib/tasks";
import type { TaskWithAssignees } from "@/lib/tasks";

export function TaskCard({ task }: { task: TaskWithAssignees }) {
  const label = dueLabel(task.dueDate, task.status);
  const people = task.assignees.map((a) => a.person.name).join(" · ");
  const done = task.status === "done";
  const escalated = Boolean(task.escalatedAt);
  const childTotal = task.children?.length ?? 0;
  const childDone = task.children?.filter((c) => c.status === "done").length ?? 0;
  const hasMoney =
    task.amountNeeded != null || (task.amountSpent != null && task.amountSpent > 0);
  const isWeek = task.orgKey === "week_before";
  const isDay = task.orgKey === "day_before";
  const isOrg = isWeek || isDay;

  const preview =
    task.planNotes?.trim() ||
    task.summary ||
    "Open to write the plan, money, and finish this decision.";

  const badges = (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
      <span>{people || "Unassigned"}</span>
      {escalated ? (
        <span className="rounded-full bg-[var(--warn-soft)] px-2 py-0.5 font-semibold text-[var(--warn)]">
          Priority{task.escalatedBy ? ` · ${task.escalatedBy}` : ""}
        </span>
      ) : null}
      {childTotal > 0 ? (
        <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 font-semibold text-[var(--accent)]">
          {childDone}/{childTotal} steps
        </span>
      ) : null}
      {hasMoney ? (
        <span>
          $
          {(task.amountSpent || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          {task.amountNeeded != null
            ? ` / $${task.amountNeeded.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
            : ""}
        </span>
      ) : null}
      {label ? (
        <span
          className="rounded-full px-2 py-0.5 font-semibold"
          style={{
            background:
              label.startsWith("Overdue") || label === "Due today"
                ? "var(--warn-soft)"
                : "var(--accent-soft)",
            color:
              label.startsWith("Overdue") || label === "Due today"
                ? "var(--warn)"
                : "var(--accent)",
          }}
        >
          {label}
        </span>
      ) : null}
    </div>
  );

  if (isOrg) {
    return (
      <article
        className={`overflow-hidden rounded-[20px] border shadow-[var(--shadow)] ${done ? "opacity-60" : ""} ${escalated ? "ring-2 ring-[var(--warn)]" : ""}`}
        style={{
          borderColor: isWeek ? "#c4b28a" : "#9bb7ae",
          background: isWeek
            ? "linear-gradient(135deg, #f7f1e4 0%, #fffdf8 55%, #efe6d4 100%)"
            : "linear-gradient(135deg, #e7f0ec 0%, #fffdf8 55%, #dce8e2 100%)",
        }}
      >
        <Link href={`/work/${task.id}`} className="block p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                Shared · {isWeek ? "7 days out" : "1 day out"}
              </p>
              <p
                className={`mt-1 font-[family-name:var(--font-display)] text-2xl leading-tight ${done ? "line-through" : ""}`}
              >
                {task.title}
              </p>
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{preview}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>{people || "David · Haley"}</span>
                {escalated ? (
                  <span className="rounded-full bg-white/70 px-2 py-0.5 font-semibold text-[var(--warn)]">
                    Priority
                  </span>
                ) : null}
                {childTotal > 0 ? (
                  <span className="rounded-full bg-white/70 px-2 py-0.5 font-semibold text-[var(--accent)]">
                    {childDone}/{childTotal} steps
                  </span>
                ) : null}
                {label ? (
                  <span className="rounded-full bg-white/70 px-2 py-0.5 font-semibold text-[var(--accent)]">
                    {label}
                  </span>
                ) : null}
              </div>
            </div>
            <span className="mt-1 text-lg text-muted" aria-hidden>
              ›
            </span>
          </div>
        </Link>
        <div className="border-t border-line/60 px-4 py-3">
          <EscalatePriorityButton taskId={task.id} escalated={escalated} compact />
        </div>
      </article>
    );
  }

  return (
    <article className={`card p-4 ${done ? "opacity-60" : ""} ${escalated ? "ring-2 ring-[var(--warn)]" : ""}`}>
      <div className="flex items-start gap-3">
        <Link href={`/work/${task.id}`} className="min-w-0 flex-1">
          <p className={`text-[15px] font-semibold leading-snug ${done ? "line-through" : ""}`}>
            {task.title}
          </p>
          <p className={`mt-1.5 line-clamp-3 text-sm leading-relaxed ${escalated ? "text-ink" : "text-muted"}`}>
            {preview}
          </p>
          {badges}
        </Link>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="text-lg text-muted" aria-hidden>
            ›
          </span>
          <EscalatePriorityButton taskId={task.id} escalated={escalated} compact />
        </div>
      </div>
    </article>
  );
}
