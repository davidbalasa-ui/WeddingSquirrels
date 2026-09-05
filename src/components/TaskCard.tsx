"use client";

import Link from "next/link";
import { EscalatePriorityButton } from "@/components/EscalatePriorityButton";
import { moneyHref, personProfileHref, taskHref, timelineHref } from "@/lib/entity-links";
import { dueLabel } from "@/lib/tasks";
import type { TaskWithAssignees } from "@/lib/tasks";

export function TaskCard({ task }: { task: TaskWithAssignees }) {
  const label = dueLabel(task.dueDate, task.status);
  const done = task.status === "done";
  const escalated = Boolean(task.escalatedAt);
  const childTotal = task.children?.length ?? 0;
  const childDone = task.children?.filter((c) => c.status === "done").length ?? 0;
  const hasMoney =
    task.amountNeeded != null || (task.amountSpent != null && task.amountSpent > 0);
  const isWeek = task.orgKey === "week_before";
  const isDay = task.orgKey === "day_before";
  const isOrg = isWeek || isDay;
  const preview = task.planNotes?.trim() || task.summary?.trim() || "";
  const dueUrgent = label?.startsWith("Overdue") || label === "Due today";
  const assignees = task.assignees.filter((row) => row.person);
  const relatedBudget = task.budgetItem;
  const relatedBlock = task.timelineBlock;

  return (
    <article
      className={`flex items-start gap-1.5 px-3 py-2 ${done ? "opacity-60" : ""} ${
        escalated ? "bg-[var(--warn-soft)]/35" : ""
      } ${isOrg ? (isWeek ? "bg-[#f7f1e4]/80" : "bg-[#e7f0ec]/80") : ""}`}
    >
      <div className="min-w-0 flex-1">
        <Link href={taskHref(task.id)} className="block">
          {isOrg ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
              Shared · {isWeek ? "7 days out" : "1 day out"}
            </p>
          ) : null}
          <p className={`text-[15px] font-semibold leading-snug ${done ? "line-through" : ""}`}>
            {task.title}
          </p>
          {preview ? (
            <p className="mt-0.5 line-clamp-1 text-sm leading-snug text-muted">{preview}</p>
          ) : null}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
          {assignees.length > 0 ? (
            <span className="inline-flex flex-wrap gap-x-1">
              {assignees.map((row, index) => (
                <span key={row.personId}>
                  {index > 0 ? " · " : null}
                  <Link
                    href={personProfileHref(row.personId)}
                    className="font-semibold text-[var(--accent)]"
                  >
                    {row.person.name}
                  </Link>
                </span>
              ))}
            </span>
          ) : (
            <span>{isOrg ? "David · Haley" : "Unassigned"}</span>
          )}
          {escalated ? (
            <span className="font-semibold text-[var(--warn)]">
              Priority{task.escalatedBy ? ` · ${task.escalatedBy}` : ""}
            </span>
          ) : null}
          {childTotal > 0 ? (
            <span className="font-semibold text-[var(--accent)]">
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
          {relatedBudget ? (
            <Link href={moneyHref(relatedBudget.id)} className="font-semibold text-[var(--accent)]">
              {relatedBudget.name}
            </Link>
          ) : null}
          {relatedBlock ? (
            <Link
              href={timelineHref({
                schedule: relatedBlock.schedule === "rehearsal" ? "rehearsal" : "wedding",
                blockId: relatedBlock.id,
              })}
              className="font-semibold text-[var(--accent)]"
            >
              {relatedBlock.startAt || "Timeline"}
            </Link>
          ) : null}
          {label ? (
            <span
              className={`font-semibold ${dueUrgent ? "text-[var(--warn)]" : "text-[var(--accent)]"}`}
            >
              {label}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <Link href={taskHref(task.id)} className="text-lg text-muted" aria-hidden>
          ›
        </Link>
        <EscalatePriorityButton taskId={task.id} escalated={escalated} compact />
      </div>
    </article>
  );
}
