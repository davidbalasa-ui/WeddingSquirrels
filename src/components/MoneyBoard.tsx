"use client";

import { useState, useTransition } from "react";
import {
  createBudgetItem,
  deleteBudgetItem,
  saveBudgetItem,
  saveMinorExpense,
  setBudgetOwner,
} from "@/app/actions";
import { StarIcon } from "@/components/StarIcon";

export type BudgetItemView = {
  id: string;
  name: string;
  price: number;
  amountPaid: number;
  ownerId: string | null;
  note: string | null;
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

function money(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
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
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Remaining</p>
        <p className="mt-1 font-[family-name:var(--font-display)] text-4xl text-[var(--accent)]">
          ${money(grandLeft)}
        </p>
        <p className="mt-2 text-sm text-muted">
          ${money(grandPaid)} paid of ${money(grandTotal)}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-[var(--accent-soft)] px-3 py-2">
            <p className="text-xs text-muted">Budget left</p>
            <p className="font-semibold text-[var(--accent)]">${money(Math.max(0, budgetTotal - budgetPaid))}</p>
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
          {canEdit ? "Tap the star to edit any line — totals, paid, notes, owner." : "Main budget lines"}
        </p>
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const remaining = Math.max(0, item.price - item.amountPaid);
            const selected =
              item.ownerId === "david" ? "david" : item.ownerId === "haley" ? "haley" : null;
            const editing = editingBudgetId === item.id;

            if (editing && canEdit) {
              return (
                <article key={item.id} className="card p-4">
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
                      <span className="mb-1 block text-xs text-muted">Notes</span>
                      <textarea
                        name="note"
                        defaultValue={item.note || ""}
                        rows={3}
                        placeholder="Payment plan, vendor contact, due dates…"
                        className="w-full resize-y rounded-xl border border-line bg-transparent px-3 py-2.5 text-[15px] outline-none focus:border-[var(--accent)]"
                      />
                    </label>
                    <fieldset>
                      <legend className="mb-2 text-xs text-muted">Owner</legend>
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
                              defaultChecked={selected === owner.id}
                            />
                            {owner.label}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        className="rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-muted"
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
              <article key={item.id} className="card relative p-4 pr-12">
                {canEdit ? (
                  <button
                    type="button"
                    aria-label={`Edit ${item.name}`}
                    title="Edit"
                    className="star-btn absolute right-3 top-3"
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
                {canEdit ? (
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {owners.map((owner) => {
                      const active = selected === owner.id;
                      return (
                        <button
                          key={owner.label}
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            startTransition(() => setBudgetOwner(item.id, owner.id))
                          }
                          className="rounded-xl border px-2 py-2 text-sm font-semibold transition"
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
                  <p className="mt-3 text-sm text-muted">
                    Owner:{" "}
                    {selected === "david" ? "David" : selected === "haley" ? "Haley" : "Both / unset"}
                  </p>
                )}
              </article>
            );
          })}

          {canEdit ? (
            addingBudget ? (
              <article className="card p-4">
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
                  <textarea
                    name="note"
                    rows={2}
                    placeholder="Notes…"
                    className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                  />
                  <button
                    type="submit"
                    className="rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
                  >
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
                className="flex items-center justify-center gap-2 rounded-[18px] border border-dashed border-line px-4 py-4 text-sm font-semibold text-[var(--accent)]"
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
                        <article key={m.id} className="card p-4">
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
                            <button
                              type="submit"
                              className="rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
                            >
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
                            className="star-btn absolute right-3 top-3"
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
