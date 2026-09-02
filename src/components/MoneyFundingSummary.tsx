"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  createFundingSource,
  deleteFundingSource,
  saveFundingSource,
} from "@/app/actions";
import {
  formatMoney,
  type FundingSourceSnapshot,
  type MoneyLedgerSummary,
} from "@/lib/money";

export function MoneyFundingSummary({
  ledger,
  sources,
  canEdit,
  canEditFunding,
}: {
  ledger: MoneyLedgerSummary;
  sources: FundingSourceSnapshot[];
  canEdit: boolean;
  canEditFunding: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className="card mb-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Total budget
            </p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-3xl leading-none text-[var(--accent)]">
              {formatMoney(ledger.projectedBudget)}
            </p>
            <p className="mt-2 text-sm text-muted">
              {formatMoney(ledger.availableFunding)} available
              {ledger.expectedFunding > 0
                ? ` · ${formatMoney(ledger.expectedFunding)} expected`
                : ""}
            </p>
          </div>
          {canEditFunding ? (
            <button
              type="button"
              className="btn-secondary shrink-0 px-3 py-2 text-sm"
              onClick={() => setOpen(true)}
            >
              Edit funding
            </button>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-[var(--accent-soft)] px-3 py-2">
            <p className="text-xs text-muted">Spent</p>
            <p className="font-semibold text-[var(--accent)]">
              {formatMoney(ledger.paidSpending)}
              {ledger.pendingSpending > 0 ? (
                <span className="text-xs font-medium text-muted">
                  {" "}
                  ({formatMoney(ledger.pendingSpending)} pending)
                </span>
              ) : null}
            </p>
          </div>
          <div className="rounded-xl bg-[var(--accent-soft)] px-3 py-2">
            <p className="text-xs text-muted">Projected left</p>
            <p
              className={`font-semibold ${
                ledger.projectedBalance < 0 ? "text-[var(--warn)]" : "text-[var(--accent)]"
              }`}
            >
              {formatMoney(ledger.projectedBalance)}
            </p>
          </div>
        </div>
      </section>

      {open ? (
        <FundingEditor sources={sources} onClose={() => setOpen(false)} canEdit={canEdit} />
      ) : null}
    </>
  );
}

function FundingEditor({
  sources,
  onClose,
  canEdit,
}: {
  sources: FundingSourceSnapshot[];
  onClose: () => void;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, []);

  function runFundingAction(action: () => Promise<void>, onSuccess?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
        setRevision((value) => value + 1);
        onSuccess?.();
      } catch {
        setError("Couldn't save funding — try again.");
      }
    });
  }

  return (
    <div className="overlay-backdrop" role="presentation" onClick={onClose}>
      <div
        className="overlay-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="funding-editor-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Funding sources
            </p>
            <h2 id="funding-editor-title" className="font-[family-name:var(--font-display)] text-2xl">
              Where the budget comes from
            </h2>
          </div>
          <button
            type="button"
            className="filter-pill rounded-full px-3 text-sm font-semibold"
            onClick={onClose}
            aria-label="Close funding editor"
          >
            Close
          </button>
        </div>

        {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}

        <div className="mt-4 flex flex-col gap-3" key={revision}>
          {sources.length === 0 ? (
            <p className="text-sm text-muted">
              No funding sources yet. Add one below to build your total budget.
            </p>
          ) : null}

          {sources.map((source) => (
            <form
              key={source.id}
              className="rounded-2xl border border-line p-3"
              onSubmit={(event) => {
                event.preventDefault();
                const fd = new FormData(event.currentTarget);
                runFundingAction(() => saveFundingSource(fd));
              }}
            >
              <input type="hidden" name="id" value={source.id} />
              <div className="grid gap-2">
                <input
                  name="label"
                  defaultValue={source.label}
                  disabled={!canEdit}
                  className="overlay-field"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    name="amount"
                    inputMode="decimal"
                    defaultValue={source.amount}
                    disabled={!canEdit}
                    className="overlay-field"
                  />
                  <select
                    name="status"
                    defaultValue={source.status}
                    disabled={!canEdit}
                    className="overlay-field"
                  >
                    <option value="available">Available</option>
                    <option value="expected">Expected</option>
                  </select>
                </div>
                <input
                  name="note"
                  defaultValue={source.note || ""}
                  disabled={!canEdit}
                  placeholder="Optional note"
                  className="overlay-field"
                />
              </div>
              {canEdit ? (
                <div className="mt-2 flex flex-wrap gap-3">
                  <button type="submit" className="text-sm font-semibold text-[var(--accent)] underline">
                    Save
                  </button>
                  <button
                    type="button"
                    className="text-sm font-semibold text-[var(--danger)] underline"
                    onClick={() =>
                      runFundingAction(() => deleteFundingSource(source.id), onClose)
                    }
                  >
                    Remove
                  </button>
                </div>
              ) : null}
            </form>
          ))}

          {canEdit ? (
            adding ? (
              <form
                className="rounded-2xl border border-dashed border-line p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const fd = new FormData(event.currentTarget);
                  runFundingAction(() => createFundingSource(fd), () => setAdding(false));
                }}
              >
                <div className="grid gap-2">
                  <input
                    name="label"
                    placeholder="Source name"
                    className="overlay-field"
                    autoFocus
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      name="amount"
                      inputMode="decimal"
                      placeholder="Amount"
                      className="overlay-field"
                    />
                    <select name="status" defaultValue="available" className="overlay-field">
                      <option value="available">Available</option>
                      <option value="expected">Expected</option>
                    </select>
                  </div>
                  <input name="note" placeholder="Optional note" className="overlay-field" />
                </div>
                <div className="mt-2 flex gap-3">
                  <button type="submit" className="btn-primary px-3 py-2 text-sm">
                    Add source
                  </button>
                  <button
                    type="button"
                    className="btn-secondary px-3 py-2 text-sm"
                    onClick={() => setAdding(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                className="rounded-2xl border border-dashed border-line px-4 py-3 text-sm font-semibold text-[var(--accent)]"
                onClick={() => setAdding(true)}
              >
                Add funding source
              </button>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
