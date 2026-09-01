import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { moneyContractHref } from "@/lib/connections";
import { dueDateLabel, formatMoney, type MoneyDueItem } from "@/lib/money";

export function MoneyDueList({
  title,
  items,
  showAllHref,
  emptyTitle,
}: {
  title: string;
  items: MoneyDueItem[];
  showAllHref?: string;
  emptyTitle?: string;
}) {
  if (items.length === 0) {
    return (
      <section className="mb-6">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{title}</p>
        <EmptyState
          title={emptyTitle ?? "No payments due right now"}
          detail="Installments and balances will show up here when something is coming due."
          actionHref={showAllHref}
          actionLabel={showAllHref ? "View payment schedule" : undefined}
        />
      </section>
    );
  }

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{title}</p>
        {showAllHref ? (
          <Link href={showAllHref} className="text-xs font-semibold text-[var(--accent)]">
            View all
          </Link>
        ) : null}
      </div>
      <div className="divide-y divide-[var(--line)] border-y border-line">
        {items.map((item) => (
          <Link
            key={item.id}
            href={moneyContractHref(item.contractId)}
            className="flex min-h-[4.5rem] items-center gap-3 py-3 transition-colors hover:bg-[var(--accent-soft)]/30"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-[family-name:var(--font-display)] text-lg leading-tight">
                {item.contractName}
              </span>
              <span className="mt-0.5 block text-sm text-muted">
                {item.label} · {formatMoney(item.amount)}
              </span>
              <span
                className={`mt-1 block text-xs font-semibold ${
                  item.overdue ? "text-[var(--warn)]" : "text-[var(--accent)]"
                }`}
              >
                {dueDateLabel(item.dueDate)}
              </span>
            </span>
            <span className="text-lg text-muted" aria-hidden>
              ›
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
