"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createBudgetPayment,
  deleteBudgetPayment,
  markBudgetPaymentPaid,
  saveBudgetPayment,
} from "@/app/actions";
import {
  LEGACY_PAID_LABEL,
  completedPayments,
  dueDateLabel,
  formatMoney,
  hasExplicitSchedule,
  openPayments,
  paymentDisplayLabel,
  paymentIsOverdue,
  paymentRemaining,
  type BudgetContractSnapshot,
  type BudgetPaymentSnapshot,
} from "@/lib/money";

function toDateInput(value: Date | null | undefined) {
  if (!value) return "";
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function PaymentFields({
  payment,
  submitLabel,
}: {
  payment?: BudgetPaymentSnapshot;
  submitLabel: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-muted">Label</span>
        <input
          name="label"
          defaultValue={payment?.label ?? ""}
          placeholder="Deposit, second payment, final…"
          className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-muted">Amount</span>
        <input
          name="amount"
          inputMode="decimal"
          required
          defaultValue={payment?.amount || ""}
          className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-muted">Due date</span>
        <input
          type="date"
          name="dueDate"
          defaultValue={toDateInput(payment?.dueDate)}
          className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
        />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="paid" defaultChecked={payment ? payment.paidAmount + 0.001 >= payment.amount : false} />
        Paid
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-muted">Paid date</span>
        <input
          type="date"
          name="paidAt"
          defaultValue={toDateInput(payment?.paidAt)}
          className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-muted">Note</span>
        <textarea
          name="note"
          rows={2}
          defaultValue={payment?.note ?? ""}
          className="w-full resize-y rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
        />
      </label>
      <button type="submit" className="btn-primary self-start">
        {submitLabel}
      </button>
    </div>
  );
}

export function MoneyPaymentSchedule({
  contract,
  canEdit,
}: {
  contract: BudgetContractSnapshot;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const explicit = hasExplicitSchedule(contract);
  const open = openPayments(contract);
  const history = completedPayments(contract);

  function refreshAfter(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          Payment schedule
        </p>
        {explicit ? (
          open.length === 0 ? (
            <p className="border-t border-[var(--line)] py-4 text-sm text-muted">All scheduled payments are paid.</p>
          ) : (
            <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
              {open.map((payment) => {
                const overdue = paymentIsOverdue(payment);
                const editing = editingId === payment.id;
                return (
                  <article key={payment.id} className="py-3">
                    {editing && canEdit ? (
                      <form
                        action={async (fd) => {
                          fd.set("id", payment.id);
                          await saveBudgetPayment(fd);
                          setEditingId(null);
                          router.refresh();
                        }}
                      >
                        <PaymentFields payment={payment} submitLabel="Save payment" />
                        <button
                          type="button"
                          className="mt-2 text-sm font-semibold text-muted"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-[family-name:var(--font-display)] text-xl leading-tight">
                            {paymentDisplayLabel(payment)}
                          </p>
                          <p className="mt-1 text-sm text-muted">
                            {formatMoney(paymentRemaining(payment))}
                            {payment.dueDate ? ` · ${dueDateLabel(payment.dueDate)}` : ""}
                          </p>
                          {overdue ? (
                            <p className="mt-1 text-sm font-semibold text-[var(--warn)]">Overdue</p>
                          ) : null}
                        </div>
                        {canEdit ? (
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <button
                              type="button"
                              className="text-sm font-semibold text-[var(--accent)]"
                              disabled={pending}
                              onClick={() => refreshAfter(() => markBudgetPaymentPaid(payment.id))}
                            >
                              Mark paid
                            </button>
                            <button
                              type="button"
                              className="text-sm font-semibold text-muted"
                              onClick={() => setEditingId(payment.id)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-sm font-semibold text-[var(--danger)]"
                              disabled={pending}
                              onClick={() => {
                                if (!window.confirm("Remove this payment? The contract total will stay the same.")) {
                                  return;
                                }
                                refreshAfter(() => deleteBudgetPayment(payment.id));
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )
        ) : (
          <div className="border-t border-[var(--line)] py-4">
            <p className="text-sm leading-relaxed text-muted">
              No payment schedule yet. The paid total and due date on this contract are still the
              source of truth.
            </p>
          </div>
        )}
      </section>

      {explicit && history.length > 0 ? (
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">History</p>
          <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {history.map((payment) => (
              <article key={payment.id} className="flex items-start justify-between gap-3 py-3">
                {editingId === payment.id && canEdit ? (
                  <form
                    className="w-full"
                    action={async (fd) => {
                      fd.set("id", payment.id);
                      await saveBudgetPayment(fd);
                      setEditingId(null);
                      router.refresh();
                    }}
                  >
                    <PaymentFields payment={payment} submitLabel="Save payment" />
                  </form>
                ) : (
                  <>
                    <div className="min-w-0">
                      <p className="font-semibold">{paymentDisplayLabel(payment)}</p>
                      <p className="mt-0.5 text-sm text-muted">
                        {formatMoney(payment.paidAmount)} paid
                        {payment.paidAt
                          ? ` · ${payment.paidAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                          : ""}
                      </p>
                    </div>
                    {canEdit ? (
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <button
                          type="button"
                          className="text-sm font-semibold text-muted"
                          onClick={() => setEditingId(payment.id)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-sm font-semibold text-[var(--danger)]"
                          disabled={pending}
                          onClick={() => {
                            if (!window.confirm("Remove this payment? The contract total will stay the same.")) {
                              return;
                            }
                            refreshAfter(() => deleteBudgetPayment(payment.id));
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {canEdit ? (
        adding ? (
          <section className="rounded-2xl border border-line p-4">
            {contract.amountPaid > 0.001 && !explicit ? (
              <p className="mb-3 text-sm leading-relaxed text-muted">
                This contract already shows {formatMoney(contract.amountPaid)} paid. Adding a schedule
                keeps that paid-to-date as “{LEGACY_PAID_LABEL}” instead of guessing how it was split.
                Schedule only what is still ahead.
              </p>
            ) : null}
            <form
              action={async (fd) => {
                fd.set("budgetItemId", contract.id);
                await createBudgetPayment(fd);
                setAdding(false);
                router.refresh();
              }}
            >
              <PaymentFields submitLabel="Add payment" />
              <button
                type="button"
                className="mt-2 text-sm font-semibold text-muted"
                onClick={() => setAdding(false)}
              >
                Cancel
              </button>
            </form>
          </section>
        ) : (
          <button
            type="button"
            className="text-sm font-semibold text-[var(--accent)]"
            onClick={() => {
              setEditingId(null);
              setAdding(true);
            }}
          >
            Add a payment
          </button>
        )
      ) : null}
    </div>
  );
}
