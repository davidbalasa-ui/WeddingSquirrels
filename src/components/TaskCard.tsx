"use client";

import { useState, useTransition } from "react";
import { toggleTaskDone } from "@/app/actions";
import { dueLabel } from "@/lib/tasks";
import type { TaskWithAssignees } from "@/lib/tasks";

export function TaskCard({ task }: { task: TaskWithAssignees }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const label = dueLabel(task.dueDate, task.status);
  const people = task.assignees.map((a) => a.person.name).join(" · ");
  const done = task.status === "done";

  return (
    <article className={`card p-4 ${done ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-label={done ? "Mark not done" : "Mark done"}
          disabled={pending}
          onClick={() => startTransition(() => toggleTaskDone(task.id))}
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line"
          style={{
            background: done ? "var(--accent)" : "transparent",
            color: done ? "white" : "var(--muted)",
          }}
        >
          {done ? "✓" : ""}
        </button>

        <div className="min-w-0 flex-1">
          <p className={`text-[15px] leading-snug ${done ? "line-through" : ""}`}>{task.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>{people || "Unassigned"}</span>
            {label ? (
              <span
                className="rounded-full px-2 py-0.5 font-semibold"
                style={{
                  background: label.startsWith("Overdue") || label === "Due today" ? "var(--warn-soft)" : "var(--accent-soft)",
                  color: label.startsWith("Overdue") || label === "Due today" ? "var(--warn)" : "var(--accent)",
                }}
              >
                {label}
              </span>
            ) : null}
          </div>

          {task.helpText ? (
            <button
              type="button"
              className="mt-2 text-xs font-semibold text-[var(--accent)]"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Hide help" : "Need help?"}
            </button>
          ) : null}
          {open && task.helpText ? (
            <p className="mt-2 text-sm leading-relaxed text-muted">{task.helpText}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
