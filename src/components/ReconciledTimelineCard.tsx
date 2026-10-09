"use client";

import { useState } from "react";
import { applyReconciledTimelineAction } from "@/app/actions";
import type { ReconciledPlan } from "@/lib/reconciled-timeline";

/** Master-only: shows what the reconciled document would change and applies it in one tap. */
export function ReconciledTimelineCard({ plan }: { plan: ReconciledPlan }) {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [open, setOpen] = useState(false);
  const total = plan.inserts.length + plan.updates.length + plan.removals.length;
  if (total === 0 || state === "done") return null;

  async function apply() {
    setState("working");
    const result = await applyReconciledTimelineAction();
    if (!result.ok) {
      setState("error");
      return;
    }
    setState("done");
    window.location.reload();
  }

  return (
    <section className="card mb-3 px-3 py-3 print-hide">
      <p className="text-sm font-semibold">Reconciled timeline update ready</p>
      <p className="mt-0.5 text-xs text-muted">
        From the “David and Haley Reconciled Wedding Timeline” document: {plan.inserts.length} new moments, {plan.updates.length} updated,
        {" "}{plan.removals.length} folded into others. Moments the document does not mention are left as they are
        {plan.untouched.length ? ` (${plan.untouched.length})` : ""}.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary min-h-11 px-4 py-2 text-sm" onClick={() => void apply()} disabled={state === "working"}>
          {state === "working" ? "Applying…" : "Apply to the timeline"}
        </button>
        <button type="button" className="min-h-11 px-2 text-sm font-semibold text-[var(--accent)]" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide details" : "See what changes"}
        </button>
      </div>
      {state === "error" ? (
        <p className="mt-2 text-sm text-[var(--danger)]">Couldn’t apply — nothing was changed. Try again.</p>
      ) : null}
      {open ? (
        <div className="mt-3 space-y-2 text-sm">
          {plan.updates.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Updated</p>
              <ul className="mt-1 list-none space-y-0.5 p-0">
                {plan.updates.map((row) => (
                  <li key={row.id}>
                    {row.before.title} ({row.before.startAt}{row.before.endAt ? ` – ${row.before.endAt}` : ""}) → {row.notes.split("\n")[0]} ({row.startAt}{row.endAt ? ` – ${row.endAt}` : ""})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {plan.inserts.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">New</p>
              <ul className="mt-1 list-none space-y-0.5 p-0">
                {plan.inserts.map((row) => (
                  <li key={row.seedKey}>{row.startAt}{row.endAt ? ` – ${row.endAt}` : ""} · {row.notes.split("\n")[0]}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {plan.removals.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Folded into other moments</p>
              <ul className="mt-1 list-none space-y-0.5 p-0">
                {plan.removals.map((row) => <li key={row.id}>{row.title}</li>)}
              </ul>
            </div>
          ) : null}
          {plan.untouched.length ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Not in the document, left alone</p>
              <ul className="mt-1 list-none space-y-0.5 p-0">
                {plan.untouched.map((row) => <li key={row.id}>{row.startAt} · {row.title}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
