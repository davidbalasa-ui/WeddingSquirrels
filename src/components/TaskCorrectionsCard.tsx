"use client";

import { useState } from "react";
import { applyTaskCorrectionsAction } from "@/app/actions";
import { taskCorrectionsPlanIsEmpty, type TaskCorrectionsPlan } from "@/lib/task-corrections";

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

function dayLabel(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** Master-only: adds David's dated jobs and ticks the steps he marked done, in one tap. */
export function TaskCorrectionsCard({ plan }: { plan: TaskCorrectionsPlan }) {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [open, setOpen] = useState(false);
  if (state === "done" || taskCorrectionsPlanIsEmpty(plan)) return null;

  async function apply() {
    setState("working");
    const result = await applyTaskCorrectionsAction().catch(() => ({ ok: false as const }));
    if (!result.ok) {
      setState("error");
      return;
    }
    setState("done");
    window.location.reload();
  }

  return (
    <section className="card mb-5 px-3 py-3" data-testid="task-corrections-card">
      <p className="text-sm font-semibold">Task update ready</p>
      <p className="mt-0.5 text-xs text-muted">
        From your printout: {count(plan.inserts.length, "new dated job")}, {count(plan.marks.length, "item")} marked done.
        Nothing is reworded or deleted.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary min-h-11 px-4 py-2 text-sm" onClick={() => void apply()} disabled={state === "working"}>
          {state === "working" ? "Applying…" : "Apply to tasks"}
        </button>
        <button type="button" className="min-h-11 px-2 text-sm font-semibold text-[var(--accent)]" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide details" : "See what changes"}
        </button>
      </div>
      {state === "error" ? <p className="mt-2 text-sm text-[var(--danger)]">Couldn’t apply — nothing was changed. Try again.</p> : null}
      {open ? (
        <div className="mt-3 space-y-2 text-sm">
          {plan.inserts.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">New</p>
              <ul className="mt-1 list-none space-y-0.5 p-0">
                {plan.inserts.map((row) => (
                  <li key={row.title}>
                    {dayLabel(row.due)} · {row.title}
                    {row.summary ? <span className="text-muted"> ({row.summary})</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {plan.marks.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Marked done</p>
              <ul className="mt-1 list-none space-y-0.5 p-0">
                {plan.marks.map((row) => (
                  <li key={row.id}>{row.card ? `${row.card} · ${row.title}` : row.title}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
