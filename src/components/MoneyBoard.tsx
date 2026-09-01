"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  createBudgetItem,
  deleteBudgetItem,
  markBudgetPaymentPaid,
  saveBudgetItem,
  saveMinorExpense,
} from "@/app/actions";
import { MoneyPaymentSchedule } from "@/components/MoneyPaymentSchedule";
import { StarIcon } from "@/components/StarIcon";
import {
  contractRemaining,
  formatMoney,
  nextUnpaidPaymentLabel,
  type BudgetContractSnapshot,
} from "@/lib/money";
import type { MinorExpenseSnapshot } from "@/lib/money";

export type BudgetItemView = BudgetContractSnapshot;
export type MinorExpenseView = MinorExpenseSnapshot;

function isFullyPaid(price: number, amountPaid: number) {
  return contractRemaining({ price, amountPaid }) <= 0.001;
}

function toDateInput(value: Date | string | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return value.slice(0, 10);
}

function isOverdue(item: BudgetItemView) {
  if (isFullyPaid(item.price, item.amountPaid) || !item.payByDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${toDateInput(item.payByDate)}T12:00:00`);
  if (Number.isNaN(due.getTime())) return false;
  due.setHours(0, 0, 0, 0);
  return due < today;
}

function sortBudgetItems(items: BudgetItemView[]) {
  return [...items].sort((a, b) => {
    const aDone = isFullyPaid(a.price, a.amountPaid) ? 1 : 0;
    const bDone = isFullyPaid(b.price, b.amountPaid) ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;

    if (!aDone) {
      const aDate = a.payByDate
        ? new Date(`${toDateInput(a.payByDate)}T12:00:00`).getTime()
        : Number.POSITIVE_INFINITY;
      const bDate = b.payByDate
        ? new Date(`${toDateInput(b.payByDate)}T12:00:00`).getTime()
        : Number.POSITIVE_INFINITY;
      if (aDate !== bDate) return aDate - bDate;
    }

    return a.sortOrder - b.sortOrder;
  });
}

export function MoneyBoard({
  items,
  minor,
  canEdit,
  profileHrefByContractId = {},
}: {
  items: BudgetItemView[];
  minor: MinorExpenseView[];
  canEdit: boolean;
  hideSummary?: boolean;
  profileHrefByContractId?: Record<string, string>;
}) {
  const searchParams = useSearchParams();
  const highlightContractId = searchParams.get("contract");
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [editingMinorId, setEditingMinorId] = useState<string | null>(null);
  const [addingBudget, setAddingBudget] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!highlightContractId) return;
    setExpandedId(highlightContractId);
    highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightContractId, items.length]);

  const sortedItems = sortBudgetItems(items);

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl">Spending</h2>
        {sortedItems.length === 0 ? (
          <div className="rounded-2xl border border-line px-4 py-5 text-sm text-muted">
            No budget lines yet.
          </div>
        ) : (
          <div className="divide-y divide-[var(--line)] border-y border-line">
            {sortedItems.map((item) => {
              const remaining = contractRemaining(item);
              const expanded = expandedId === item.id;
              const editing = editingBudgetId === item.id;
              const overdue = isOverdue(item);
              const nextPayment = nextUnpaidPaymentLabel(item);

              if (editing && canEdit) {
                return (
                  <article key={item.id} className="py-3 print-hide">
                    <form
                      action={async (fd) => {
                        await saveBudgetItem(fd);
                        setEditingBudgetId(null);
                      }}
                      className="flex flex-col gap-3"
                    >
                      <input type="hidden" name="id" value={item.id} />
                      <label className="block text-sm">
                        <span className="mb-1 block text-xs text-muted">Item</span>
                        <input
                          name="name"
                          defaultValue={item.name}
                          className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                          autoFocus
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block text-sm">
                          <span className="mb-1 block text-xs text-muted">Total cost</span>
                          <input
                            name="price"
                            inputMode="decimal"
                            defaultValue={item.price}
                            className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="mb-1 block text-xs text-muted">Paid so far</span>
                          <input
                            name="amountPaid"
                            inputMode="decimal"
                            defaultValue={item.amountPaid}
                            className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                          />
                        </label>
                      </div>
                      <label className="block text-sm">
                        <span className="mb-1 block text-xs text-muted">Pay by date</span>
                        <input
                          type="date"
                          name="payByDate"
                          defaultValue={toDateInput(item.payByDate) || ""}
                          className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-xs text-muted">Notes</span>
                        <textarea
                          name="note"
                          defaultValue={item.note || ""}
                          rows={3}
                          className="w-full resize-y rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button type="submit" className="btn-primary">
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setEditingBudgetId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                      <button
                        type="button"
                        className="self-start text-sm font-semibold text-[var(--danger)]"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            await deleteBudgetItem(item.id);
                            setEditingBudgetId(null);
                          })
                        }
                      >
                        Remove
                      </button>
                    </form>
                  </article>
                );
              }

              return (
                <article
                  key={item.id}
                  id={`contract-${item.id}`}
                  ref={highlightContractId === item.id ? highlightRef : null}
                  className={overdue ? "bg-[var(--warn-soft)]/35" : undefined}
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 py-3 text-left"
                    onClick={() => setExpandedId(expanded ? null : item.id)}
                  >
                    <span className="min-w-0 flex-1">
                      {profileHrefByContractId[item.id] ? (
                        <Link
                          href={profileHrefByContractId[item.id]!}
                          className="block font-semibold leading-snug text-[var(--accent)] hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {item.name}
                        </Link>
                      ) : (
                        <span className="block font-semibold leading-snug">{item.name}</span>
                      )}
                      <span className="mt-0.5 block text-sm text-muted">
                        {formatMoney(item.amountPaid)} spent of {formatMoney(item.price)}
                        {overdue ? " · Overdue" : ""}
                      </span>
                      {nextPayment && !expanded ? (
                        <span className="mt-0.5 block text-xs text-muted">{nextPayment}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-[family-name:var(--font-display)] text-lg text-[var(--accent)]">
                        {formatMoney(remaining)}
                      </span>
                      <span className="text-xs text-muted">left</span>
                    </span>
                  </button>

                  {expanded ? (
                    <div className="pb-3 pl-1">
                      {item.note ? (
                        <p className="mb-3 break-all text-sm leading-relaxed text-muted">{item.note}</p>
                      ) : null}
                      <MoneyPaymentSchedule
                        contract={item}
                        canEdit={canEdit}
                        onMarkPaid={
                          canEdit
                            ? (paymentId) =>
                                startTransition(() => markBudgetPaymentPaid(paymentId))
                            : undefined
                        }
                      />
                      {canEdit ? (
                        <button
                          type="button"
                          className="mt-3 text-sm font-semibold text-[var(--accent)] underline print-hide"
                          onClick={() => {
                            setAddingBudget(false);
                            setEditingMinorId(null);
                            setEditingBudgetId(item.id);
                          }}
                        >
                          Edit item
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}

        {canEdit ? (
          addingBudget ? (
            <article className="mt-3 rounded-2xl border border-line p-4 print-hide">
              <form
                action={async (fd) => {
                  await createBudgetItem(fd);
                  setAddingBudget(false);
                }}
                className="flex flex-col gap-3"
              >
                <input
                  name="name"
                  placeholder="Vendor or item"
                  className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    name="price"
                    inputMode="decimal"
                    placeholder="Total"
                    className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                  />
                  <input
                    name="amountPaid"
                    inputMode="decimal"
                    placeholder="Paid"
                    className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <input
                  type="date"
                  name="payByDate"
                  className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                />
                <textarea
                  name="note"
                  rows={2}
                  placeholder="Notes…"
                  className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                />
                <div className="flex gap-2">
                  <button type="submit" className="btn-primary">
                    Add expense
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setAddingBudget(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </article>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditingBudgetId(null);
                setEditingMinorId(null);
                setAddingBudget(true);
              }}
              className="print-hide mt-3 flex w-full items-center justify-center gap-2 rounded-[18px] border border-dashed border-line px-4 py-3 text-sm font-semibold text-[var(--accent)]"
            >
              <StarIcon size={16} />
              Add expense
            </button>
          )
        ) : null}
      </section>

      {minor.length > 0 ? (
        <section>
          <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl">Other spending</h2>
          <div className="divide-y divide-[var(--line)] border-y border-line">
            {minor.map((m) => {
              const needed = m.amountNeeded ?? m.amountSpent;
              const left = Math.max(0, needed - m.amountSpent);
              const editing = editingMinorId === m.id;

              if (editing && canEdit) {
                return (
                  <article key={m.id} className="py-3 print-hide">
                    <form
                      action={async (fd) => {
                        await saveMinorExpense(fd);
                        setEditingMinorId(null);
                      }}
                      className="flex flex-col gap-3"
                    >
                      <input type="hidden" name="id" value={m.id} />
                      <p className="font-semibold">{m.title}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block text-sm">
                          <span className="mb-1 block text-xs text-muted">Planned</span>
                          <input
                            name="amountNeeded"
                            inputMode="decimal"
                            defaultValue={m.amountNeeded ?? ""}
                            className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="mb-1 block text-xs text-muted">Spent</span>
                          <input
                            name="amountSpent"
                            inputMode="decimal"
                            defaultValue={m.amountSpent || ""}
                            className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                          />
                        </label>
                      </div>
                      <textarea
                        name="planNotes"
                        defaultValue={m.planNotes || ""}
                        rows={3}
                        className="w-full resize-y rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                      />
                      <button type="submit" className="btn-primary">
                        Save
                      </button>
                    </form>
                  </article>
                );
              }

              return (
                <article key={m.id} className="flex items-center gap-3 py-3">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => canEdit && setEditingMinorId(m.id)}
                  >
                    <span className="block font-semibold">{m.title}</span>
                    <span className="mt-0.5 block text-sm text-muted">
                      {formatMoney(m.amountSpent)} spent of {formatMoney(needed)}
                    </span>
                    {m.planNotes ? (
                      <span className="mt-0.5 line-clamp-2 block overflow-hidden break-all text-xs text-muted">
                        {m.planNotes}
                      </span>
                    ) : null}
                  </button>
                  <span className="shrink-0 text-right">
                    <span className="block font-[family-name:var(--font-display)] text-lg text-[var(--accent)]">
                      {formatMoney(left)}
                    </span>
                    <span className="text-xs text-muted">left</span>
                  </span>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
