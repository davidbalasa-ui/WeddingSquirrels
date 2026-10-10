"use client";

import { useState } from "react";
import { applyReconciledTimelineAction, keepDoubledMomentAction, restoreReconciledMomentAction } from "@/app/actions";
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
  const [keeping, setKeeping] = useState<string | null>(null);
  const [keepError, setKeepError] = useState(false);
  if (state === "done") return null;
  const onlyDifferences = reconciledPlanIsEmpty(plan);
  const doubles = plan.doubles ?? [];
  if (onlyDifferences && plan.updates.length === 0 && doubles.length === 0) {
    // The owner looks here for the Apply button; say why there is none.
    return (
      <p className="mb-3 text-xs text-muted print-hide" data-testid="reconciled-up-to-date">
        Everything from the reconciled timeline document is already on the page. Nothing to apply.
      </p>
    );
  }

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

  async function keep(id: string) {
    setKeeping(id);
    setKeepError(false);
    const result = await keepDoubledMomentAction(id).catch(() => ({ ok: false as const }));
    setKeeping(null);
    if (!result.ok) {
      setKeepError(true);
      return;
    }
    window.location.reload();
  }

  // Both copies of these Thursday moments were edited, so Apply leaves both; one tap keeps one.
  const doubled = doubles.length ? (
    <section className="card mb-3 px-3 py-3 text-sm print-hide" data-testid="reconciled-doubles">
      <p className="text-sm font-semibold">
        {doubles.length === 1 ? "1 rehearsal moment is on the page twice" : `${doubles.length} rehearsal moments are on the page twice`}
      </p>
      <p className="mt-0.5 text-xs text-muted">Both copies were edited, so Apply leaves them. Tap the one to keep; the other is removed.</p>
      <ul className="mt-2 list-none space-y-2 p-0">
        {doubles.map((pair) => (
          <li key={pair.document.id}>
            <p className="text-xs font-semibold text-muted">{pair.startAt}</p>
            <div className="mt-0.5 flex flex-wrap gap-2">
              {[pair.mine, pair.document].map((copy) => (
                <button
                  key={copy.id}
                  type="button"
                  className="btn-secondary min-h-11 px-3 py-2 text-left text-sm"
                  disabled={keeping !== null}
                  onClick={() => void keep(copy.id)}
                >
                  {keeping === copy.id ? "Keeping…" : `Keep “${copy.title}”`}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      {keepError ? <p className="mt-1 text-sm text-[var(--danger)]">Couldn’t remove the other copy. Try again.</p> : null}
    </section>
  ) : null;

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
      <>
        {doubled}
        {plan.updates.length ? (
          <section className="mb-3 print-hide">
            <button type="button" className="min-h-9 text-xs font-semibold text-muted" onClick={() => setOpen((v) => !v)}>
              {open ? "Hide" : plan.updates.length === 1 ? "1 moment reads differently from the reconciled document" : `${plan.updates.length} moments read differently from the reconciled document`}
            </button>
            {open ? <div className="card mt-1 px-3 py-3 text-sm">{differences}</div> : null}
          </section>
        ) : null}
      </>
    );
  }

  return (
    <>
    {doubled}
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
    </>
  );
}
