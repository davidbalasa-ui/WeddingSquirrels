"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  createBudgetItem,
  deleteBudgetItem,
  saveBudgetItem,
  saveMinorExpense,
  setBudgetOwner,
  setBudgetPaidBy,
  setBudgetPayByDate,
} from "@/app/actions";
import { StarIcon } from "@/components/StarIcon";

export type BudgetItemView = {
  id: string;
  name: string;
  price: number;
  amountPaid: number;
  ownerId: string | null;
  paidById: string | null;
  payByDate: string | null;
  note: string | null;
  sortOrder: number;
};

export type MinorExpenseView = {
  id: string;
  title: string;
  summary: string | null;
  planNotes: string | null;
  amountNeeded: number | null;
  amountSpent: number;
};

const owners = [
  { id: "david", label: "David" },
  { id: "haley", label: "Haley" },
  { id: null, label: "Both" },
] as const;

const payers = [
  { id: "david", label: "David" },
  { id: "haley", label: "Haley" },
  { id: null, label: "Both" },
] as const;

function money(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function personKey(id: string | null): "david" | "haley" | null {
  return id === "david" || id === "haley" ? id : null;
}

function personLabel(id: string | null, empty = "Both / unset") {
  if (id === "david") return "David";
  if (id === "haley") return "Haley";
  return empty;
}

function isFullyPaid(price: number, amountPaid: number) {
  return Math.max(0, price - amountPaid) <= 0.001;
}

function isOverdue(item: BudgetItemView) {
  if (isFullyPaid(item.price, item.amountPaid) || !item.payByDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${item.payByDate.slice(0, 10)}T12:00:00`);
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
        ? new Date(`${a.payByDate.slice(0, 10)}T12:00:00`).getTime()
        : Number.POSITIVE_INFINITY;
      const bDate = b.payByDate
        ? new Date(`${b.payByDate.slice(0, 10)}T12:00:00`).getTime()
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
}: {
  items: BudgetItemView[];
  minor: MinorExpenseView[];
  canEdit: boolean;
}) {
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [editingMinorId, setEditingMinorId] = useState<string | null>(null);
  const [addingBudget, setAddingBudget] = useState(false);
  const [pending, startTransition] = useTransition();

  const budgetTotal = items.reduce((s, i) => s + i.price, 0);
  const budgetPaid = items.reduce((s, i) => s + i.amountPaid, 0);

  const sortedItems = sortBudgetItems(items);

  const minorNeeded = minor.reduce((s, m) => s + (m.amountNeeded ?? m.amountSpent), 0);
  const minorPaid = minor.reduce((s, m) => s + m.amountSpent, 0);
  const minorUnpaid = Math.max(0, minorNeeded - minorPaid);

  const grandTotal = budgetTotal + minorNeeded;
  const grandPaid = budgetPaid + minorPaid;
  const grandLeft = Math.max(0, grandTotal - grandPaid);

  const unpaidMinor = minor.filter((m) => (m.amountNeeded ?? m.amountSpent) - m.amountSpent > 0.001);
  const paidMinor = minor.filter((m) => m.amountSpent > 0 && (m.amountNeeded ?? 0) - m.amountSpent <= 0.001);
  const partialMinor = minor.filter((m) => m.amountSpent > 0 && (m.amountNeeded ?? 0) - m.amountSpent > 0.001);

  return (
    <div className="flex flex-col gap-4">
      <section className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Remaining</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-4xl text-[var(--accent)]">
              ${money(grandLeft)}
            </p>
            <p className="mt-2 text-sm text-muted">
              ${money(grandPaid)} paid of ${money(grandTotal)}
            </p>
          </div>
          <Link href="/money/print" className="btn-secondary print-hide shrink-0 px-4 py-2 text-sm">
            Print
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-xl bg-[var(--accent-soft)] px-3 py-2">
            <p className="text-xs text-muted">Budget left</p>
            <p className="font-semibold text-[var(--accent)]">
              ${money(Math.max(0, budgetTotal - budgetPaid))}
            </p>
          </div>
          <div className="rounded-xl bg-[var(--accent-soft)] px-3 py-2">
            <p className="text-xs text-muted">Minor paid</p>
            <p className="font-semibold text-[var(--accent)]">${money(minorPaid)}</p>
          </div>
          <div className="rounded-xl bg-[var(--warn-soft)] px-3 py-2">
            <p className="text-xs text-muted">Minor unpaid</p>
            <p className="font-semibold text-[var(--warn)]">${money(minorUnpaid)}</p>
          </div>
        </div>
      </section>

      <div>
        <h2 className="mb-1 font-[family-name:var(--font-display)] text-xl">Budget</h2>
        <p className="mb-3 text-sm text-muted">
          {canEdit
            ? "Tap the star to edit any line — totals, paid, due date, payer, notes."
            : "Main budget lines"}
        </p>
        {sortedItems.length === 0 ? (
          <div className="card p-5 text-sm text-muted">No budget lines yet.</div>
        ) : null}
        <div className="flex flex-col gap-3">
          {sortedItems.map((item) => {
            const remaining = Math.max(0, item.price - item.amountPaid);
            const selectedOwner = personKey(item.ownerId);
            const selectedPayer = personKey(item.paidById);
            const editing = editingBudgetId === item.id;
            const overdue = isOverdue(item);

            if (editing && canEdit) {
              return (
                <article key={item.id} className="card p-4 print-hide">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
                      Editing budget line
                    </p>
                    <button
                      type="button"
                      aria-label="Close editor"
                      className="star-btn star-btn-active"
                      onClick={() => setEditingBudgetId(null)}
                    >
                      <StarIcon filled size={18} />
                    </button>
                  </div>
                  <form
                    action={async (fd) => {
                      await saveBudgetItem(fd);
                      setEditingBudgetId(null);
                    }}
                    className="flex flex-col gap-3"
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <label className="block text-sm">
                      <span className="mb-1 block text-xs text-muted">Name</span>
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
                        <span className="mb-1 block text-xs text-muted">Amount paid</span>
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
                        defaultValue={item.payByDate?.slice(0, 10) || ""}
                        className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block text-xs text-muted">Notes</span>
                      <textarea
                        name="note"
                        defaultValue={item.note || ""}
                        rows={3}
                        placeholder="Payment plan, vendor contact…"
                        className="w-full resize-y rounded-xl border border-line bg-transparent px-3 py-2.5 text-[15px] outline-none focus:border-[var(--accent)]"
                      />
                    </label>
                    <fieldset>
                      <legend className="mb-2 text-xs text-muted">Responsible</legend>
                      <div className="grid grid-cols-3 gap-2">
                        {owners.map((owner) => (
                          <label
                            key={owner.label}
                            className="flex items-center justify-center gap-1 rounded-xl border border-line px-2 py-2 text-sm font-semibold"
                          >
                            <input
                              type="radio"
                              name="ownerId"
                              value={owner.id ?? ""}
                              defaultChecked={selectedOwner === owner.id}
                            />
                            {owner.label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <fieldset>
                      <legend className="mb-2 text-xs text-muted">Paid by</legend>
                      <div className="grid grid-cols-3 gap-2">
                        {payers.map((payer) => (
                          <label
                            key={payer.label}
                            className="flex items-center justify-center gap-1 rounded-xl border border-line px-2 py-2 text-sm font-semibold"
                          >
                            <input
                              type="radio"
                              name="paidById"
                              value={payer.id ?? ""}
                              defaultChecked={selectedPayer === payer.id}
                            />
                            {payer.label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
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
                      Remove budget line
                    </button>
                  </form>
                </article>
              );
            }

            return (
              <article
                key={item.id}
                className="card relative p-4 pr-12"
                style={
                  overdue
                    ? {
                        borderColor: "var(--warn)",
                        background: "color-mix(in srgb, var(--warn-soft) 65%, var(--bg-elevated))",
                      }
                    : undefined
                }
              >
                {canEdit ? (
                  <button
                    type="button"
                    aria-label={`Edit ${item.name}`}
                    title="Edit"
                    className="star-btn absolute right-3 top-3 print-hide"
                    onClick={() => {
                      setAddingBudget(false);
                      setEditingMinorId(null);
                      setEditingBudgetId(item.id);
                    }}
                  >
                    <StarIcon size={17} />
                  </button>
                ) : null}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold leading-snug">{item.name}</h3>
                    <p className="mt-1 text-sm text-muted">
                      ${money(item.amountPaid)} paid of ${money(item.price)}
                      {overdue ? " · Overdue" : ""}
                    </p>
                    {item.note ? (
                      <p className="mt-2 text-sm leading-relaxed text-muted">{item.note}</p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="font-[family-name:var(--font-display)] text-xl text-[var(--accent)]">
                      ${money(remaining)}
                    </p>
                    <p className="text-xs text-muted">left</p>
                  </div>
                </div>

                <div className="mt-3">
                  <p className="mb-2 text-xs text-muted">Responsible</p>
                  {canEdit ? (
                    <div className="grid grid-cols-3 gap-2 print-hide">
                      {owners.map((owner) => {
                        const active = selectedOwner === owner.id;
                        return (
                          <button
                            key={owner.label}
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              startTransition(() => setBudgetOwner(item.id, owner.id))
                            }
                            className="owner-pill rounded-xl border px-2 py-2 text-sm font-semibold transition"
                            style={{
                              borderColor: active ? "var(--accent)" : "var(--line)",
                              background: active ? "var(--accent-soft)" : "transparent",
                              color: active ? "var(--accent)" : "var(--muted)",
                            }}
                          >
                            {owner.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted">{personLabel(selectedOwner)}</p>
                  )}
                </div>

                <div className="mt-3">
                  <p className="mb-2 text-xs text-muted">Paid by</p>
                  {canEdit ? (
                    <div className="grid grid-cols-3 gap-2 print-hide">
                      {payers.map((payer) => {
                        const active = selectedPayer === payer.id;
                        return (
                          <button
                            key={payer.label}
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              startTransition(() => setBudgetPaidBy(item.id, payer.id))
                            }
                            className="owner-pill rounded-xl border px-2 py-2 text-sm font-semibold transition"
                            style={{
                              borderColor: active ? "var(--accent)" : "var(--line)",
                              background: active ? "var(--accent-soft)" : "transparent",
                              color: active ? "var(--accent)" : "var(--muted)",
                            }}
                          >
                            {payer.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted">{personLabel(selectedPayer, "—")}</p>
                  )}
                </div>

                <div className="mt-3">
                  <p className="mb-2 text-xs text-muted">Pay by</p>
                  {canEdit ? (
                    <input
                      type="date"
                      className="print-hide w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                      defaultValue={item.payByDate?.slice(0, 10) || ""}
                      disabled={pending}
                      onChange={(e) => {
                        const value = e.target.value;
                        startTransition(() => setBudgetPayByDate(item.id, value));
                      }}
                    />
                  ) : (
                    <p className="text-sm text-muted">
                      {item.payByDate ? item.payByDate.slice(0, 10) : "—"}
                    </p>
                  )}
                </div>
              </article>
            );
          })}

          {canEdit ? (
            addingBudget ? (
              <article className="card p-4 print-hide">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
                    New budget line
                  </p>
                  <button
                    type="button"
                    className="star-btn star-btn-active"
                    aria-label="Close"
                    onClick={() => setAddingBudget(false)}
                  >
                    <StarIcon filled size={18} />
                  </button>
                </div>
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
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs text-muted">Pay by date</span>
                    <input
                      type="date"
                      name="payByDate"
                      className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                    />
                  </label>
                  <textarea
                    name="note"
                    rows={2}
                    placeholder="Notes…"
                    className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                  />
                  <fieldset>
                    <legend className="mb-2 text-xs text-muted">Responsible</legend>
                    <div className="grid grid-cols-3 gap-2">
                      {owners.map((owner) => (
                        <label
                          key={owner.label}
                          className="flex items-center justify-center gap-1 rounded-xl border border-line px-2 py-2 text-sm font-semibold"
                        >
                          <input
                            type="radio"
                            name="ownerId"
                            value={owner.id ?? ""}
                            defaultChecked={owner.id === null}
                          />
                          {owner.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend className="mb-2 text-xs text-muted">Paid by</legend>
                    <div className="grid grid-cols-3 gap-2">
                      {payers.map((payer) => (
                        <label
                          key={payer.label}
                          className="flex items-center justify-center gap-1 rounded-xl border border-line px-2 py-2 text-sm font-semibold"
                        >
                          <input
                            type="radio"
                            name="paidById"
                            value={payer.id ?? ""}
                            defaultChecked={payer.id === null}
                          />
                          {payer.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <button type="submit" className="btn-primary">
                    Add budget line
                  </button>
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
                className="print-hide flex items-center justify-center gap-2 rounded-[18px] border border-dashed border-line px-4 py-4 text-sm font-semibold text-[var(--accent)]"
              >
                <StarIcon size={16} />
                Add budget line
              </button>
            )
          ) : null}
        </div>
      </div>

      <div>
        <h2 className="mb-1 font-[family-name:var(--font-display)] text-xl">Minor expenses</h2>
        <p className="mb-3 text-sm text-muted">
          From decision packages that aren’t already on the budget (e.g. centerpieces). Photographer stays
          on the budget only.
        </p>

        {minor.length === 0 ? (
          <div className="card p-5 text-sm text-muted">
            No minor expenses yet. When you add money needed/spent on a decision that isn’t linked to a
            budget line, it shows up here.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="card p-3">
                <p className="text-xs text-muted">Minor paid</p>
                <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--accent)]">
                  ${money(minorPaid)}
                </p>
              </div>
              <div className="card p-3">
                <p className="text-xs text-muted">Minor unpaid</p>
                <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--warn)]">
                  ${money(minorUnpaid)}
                </p>
              </div>
            </div>

            {[
              { label: "Unpaid", list: unpaidMinor.filter((m) => m.amountSpent === 0) },
              { label: "Partially paid", list: partialMinor },
              { label: "Paid", list: paidMinor },
            ].map((section) =>
              section.list.length === 0 ? null : (
                <div key={section.label} className="flex flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                    {section.label}
                  </p>
                  {section.list.map((m) => {
                    const needed = m.amountNeeded ?? m.amountSpent;
                    const left = Math.max(0, needed - m.amountSpent);
                    const editing = editingMinorId === m.id;

                    if (editing && canEdit) {
                      return (
                        <article key={m.id} className="card p-4 print-hide">
                          <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
                              Editing minor expense
                            </p>
                            <button
                              type="button"
                              className="star-btn star-btn-active"
                              aria-label="Close"
                              onClick={() => setEditingMinorId(null)}
                            >
                              <StarIcon filled size={18} />
                            </button>
                          </div>
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
                                <span className="mb-1 block text-xs text-muted">Needed</span>
                                <input
                                  name="amountNeeded"
                                  inputMode="decimal"
                                  defaultValue={m.amountNeeded ?? ""}
                                  className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                                  autoFocus
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
                            <label className="block text-sm">
                              <span className="mb-1 block text-xs text-muted">Notes</span>
                              <textarea
                                name="planNotes"
                                defaultValue={m.planNotes || ""}
                                rows={3}
                                className="w-full resize-y rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                              />
                            </label>
                            <button type="submit" className="btn-primary">
                              Save
                            </button>
                          </form>
                        </article>
                      );
                    }

                    return (
                      <article key={m.id} className="card relative p-4 pr-12">
                        {canEdit ? (
                          <button
                            type="button"
                            aria-label={`Edit ${m.title}`}
                            className="star-btn absolute right-3 top-3 print-hide"
                            onClick={() => {
                              setAddingBudget(false);
                              setEditingBudgetId(null);
                              setEditingMinorId(m.id);
                            }}
                          >
                            <StarIcon size={17} />
                          </button>
                        ) : null}
                        <h3 className="font-semibold">{m.title}</h3>
                        <p className="mt-1 text-sm text-muted">
                          ${money(m.amountSpent)} spent
                          {m.amountNeeded != null ? ` of $${money(m.amountNeeded)} needed` : ""}
                          {left > 0 ? ` · $${money(left)} left` : ""}
                        </p>
                        {m.planNotes ? (
                          <p className="mt-2 text-sm leading-relaxed text-muted">{m.planNotes}</p>
                        ) : m.summary ? (
                          <p className="mt-2 text-sm leading-relaxed text-muted">{m.summary}</p>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
