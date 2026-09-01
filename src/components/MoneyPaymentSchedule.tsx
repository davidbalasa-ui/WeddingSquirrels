import {
  dueDateLabel,
  formatMoney,
  paymentIsOverdue,
  paymentIsPaid,
  paymentRemaining,
  resolveContractPayments,
  type BudgetContractSnapshot,
} from "@/lib/money";

export function MoneyPaymentSchedule({
  contract,
  canEdit,
  onMarkPaid,
}: {
  contract: BudgetContractSnapshot;
  canEdit: boolean;
  onMarkPaid?: (paymentId: string) => void;
}) {
  const payments = resolveContractPayments(contract);
  if (payments.length === 0) return null;

  return (
    <div className="mt-3 border-t border-line pt-2">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
        Payment schedule
      </p>
      <div className="flex flex-col gap-1.5">
        {payments.map((payment) => {
          const paid = paymentIsPaid(payment);
          const remaining = paymentRemaining(payment);
          const overdue = paymentIsOverdue(payment);
          return (
            <div
              key={payment.id}
              className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm ${
                paid
                  ? "bg-[var(--accent-soft)]/40"
                  : overdue
                    ? "bg-[var(--warn-soft)]"
                    : ""
              }`}
            >
              <div className="min-w-0">
                <p className="font-semibold">{payment.label}</p>
                <p className="text-xs text-muted">
                  {paid
                    ? `${formatMoney(payment.paidAmount)} paid`
                    : payment.dueDate
                      ? dueDateLabel(payment.dueDate)
                      : "No due date"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-[var(--accent)]">
                  {paid ? formatMoney(payment.amount) : formatMoney(remaining)}
                </p>
                {!paid && canEdit && onMarkPaid && !payment.id.includes(":") ? (
                  <button
                    type="button"
                    className="mt-1 text-xs font-semibold text-[var(--accent)]"
                    onClick={() => onMarkPaid(payment.id)}
                  >
                    Mark paid
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
