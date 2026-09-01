"use client";

import { useState } from "react";
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
}: {
  ledger: MoneyLedgerSummary;
  sources: FundingSourceSnapshot[];
  canEdit: boolean;
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
          {canEdit && sources.length > 0 ? (
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

        {sources.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            {sources.map((source) => (
              <span key={source.id}>
                {source.label}: {formatMoney(source.amount)}
                {source.status === "expected" ? " expected" : ""}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted">
            Funding sources will appear here after the database migration runs.
          </p>
        )}
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
  const [adding, setAdding] = useState(false);

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

        <div className="mt-4 flex flex-col gap-3">
          {sources.map((source) => (
            <form
              key={source.id}
              action={async (fd) => {
                await saveFundingSource(fd);
              }}
              className="rounded-2xl border border-line p-3"
            >
              <input type="hidden" name="id" value={source.id} />
              <div className="grid gap-2">
                <input
                  name="label"
                  defaultValue={source.label}
                  disabled={!canEdit}
                  className="w-full rounded-xl border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    name="amount"
                    inputMode="decimal"
                    defaultValue={source.amount}
                    disabled={!canEdit}
                    className="w-full rounded-xl border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                  <select
                    name="status"
                    defaultValue={source.status}
                    disabled={!canEdit}
                    className="w-full rounded-xl border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
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
                  className="w-full rounded-xl border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
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
                    onClick={async () => {
                      await deleteFundingSource(source.id);
                    }}
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
                action={async (fd) => {
                  await createFundingSource(fd);
                  setAdding(false);
                }}
                className="rounded-2xl border border-dashed border-line p-3"
              >
                <div className="grid gap-2">
                  <input
                    name="label"
                    placeholder="Source name"
                    className="w-full rounded-xl border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                    autoFocus
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      name="amount"
                      inputMode="decimal"
                      placeholder="Amount"
                      className="w-full rounded-xl border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                    />
                    <select
                      name="status"
                      defaultValue="available"
                      className="w-full rounded-xl border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                    >
                      <option value="available">Available</option>
                      <option value="expected">Expected</option>
                    </select>
                  </div>
                  <input
                    name="note"
                    placeholder="Optional note"
                    className="w-full rounded-xl border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
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
