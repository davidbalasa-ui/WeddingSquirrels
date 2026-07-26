"use client";

import Link from "next/link";
import { dueLabel } from "@/lib/tasks";
import type { TaskWithAssignees } from "@/lib/tasks";

export function TaskCard({ task }: { task: TaskWithAssignees }) {
  const label = dueLabel(task.dueDate, task.status);
  const people = task.assignees.map((a) => a.person.name).join(" · ");
  const done = task.status === "done";
  const childTotal = task.children?.length ?? 0;
  const childDone = task.children?.filter((c) => c.status === "done").length ?? 0;
  const hasMoney =
    task.amountNeeded != null || (task.amountSpent != null && task.amountSpent > 0);
  const preview =
    task.planNotes?.trim() ||
    task.summary ||
    "Open to write the plan, money, and finish this decision.";

  return (
    <Link href={`/work/${task.id}`} className={`card block p-4 ${done ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={`text-[15px] font-semibold leading-snug ${done ? "line-through" : ""}`}>
            {task.title}
          </p>
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">{preview}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>{people || "Unassigned"}</span>
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
        </div>
        <span className="mt-1 text-lg text-muted" aria-hidden>
          ›
        </span>
      </div>
    </Link>
  );
}
