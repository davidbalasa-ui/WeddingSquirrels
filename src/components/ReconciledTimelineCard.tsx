"use client";

import { useState } from "react";
import { applyReconciledTimelineAction, restoreReconciledMomentAction } from "@/app/actions";
import { reconciledPlanIsEmpty, type ReconciledPlan } from "@/lib/reconciled-timeline";

/**
 * Master-only: adds the reconciled document's new moments and removes the ones it
 * folds away in one tap. Moments already on the page are never rewritten by that
 * tap; any that read differently from the document can be switched back one at a time.
 */
function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

export function ReconciledTimelineCard({ plan }: { plan: ReconciledPlan }) {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [open, setOpen] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState(false);
  if (state === "done") return null;
  const onlyDifferences = reconciledPlanIsEmpty(plan);
  if (onlyDifferences && plan.updates.length === 0) return null;

  async function apply() {
    setState("working");
    const result = await applyReconciledTimelineAction().catch(() => ({ ok: false as const }));
    if (!result.ok) {
      setState("error");
      return;
    }
    setState("done");
    window.location.reload();
  }

  async function restore(seedKey: string) {
    setRestoring(seedKey);
    setRestoreError(false);
    const result = await restoreReconciledMomentAction(seedKey).catch(() => ({ ok: false as const }));
    setRestoring(null);
    if (!result.ok) {
      setRestoreError(true);
      return;
    }
    window.location.reload();
  }

  const differences = plan.updates.length ? (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Kept as you have them</p>
      <p className="mt-0.5 text-xs text-muted">These read differently from the document. Apply leaves them alone.</p>
      <ul className="mt-1 list-none space-y-1.5 p-0">
        {plan.updates.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-x-2">
            <span>
              {row.before.startAt}{row.before.endAt ? ` – ${row.before.endAt}` : ""} · {row.before.title}
            </span>
            <button
              type="button"
              className="min-h-9 text-left text-xs font-semibold text-[var(--accent)]"
              disabled={restoring !== null}
              onClick={() => void restore(row.seedKey)}
            >
              {restoring === row.seedKey ? "Switching…" : `Use the document’s version (${row.startAt}${row.endAt ? ` – ${row.endAt}` : ""} · ${row.notes.split("\n")[0]})`}
            </button>
          </li>
        ))}
      </ul>
      {restoreError ? <p className="mt-1 text-sm text-[var(--danger)]">Couldn’t switch that moment. Try again.</p> : null}
    </div>
  ) : null;

  // Everything from the document is on the timeline; only the owner's own edits differ.
  if (onlyDifferences) {
    return (
      <section className="mb-3 print-hide">
        <button type="button" className="min-h-9 text-xs font-semibold text-muted" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide" : plan.updates.length === 1 ? "1 moment reads differently from the reconciled document" : `${plan.updates.length} moments read differently from the reconciled document`}
        </button>
        {open ? <div className="card mt-1 px-3 py-3 text-sm">{differences}</div> : null}
      </section>
    );
  }

  return (
    <section className="card mb-3 px-3 py-3 print-hide">
      <p className="text-sm font-semibold">Reconciled timeline update ready</p>
      <p className="mt-0.5 text-xs text-muted">
        From the “David and Haley Reconciled Wedding Timeline” document: {count(plan.inserts.length, "new moment")},
        {" "}{count(plan.removals.length, "moment")} folded into others. Moments already on the timeline keep your wording
        {plan.updates.length ? ` (${plan.updates.length} ${plan.updates.length === 1 ? "reads" : "read"} differently from the document)` : ""}.
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
          {differences}
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
