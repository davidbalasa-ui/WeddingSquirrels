import Link from "next/link";
import { dueDateLabel, formatMoney, type MoneyDueItem } from "@/lib/money";
import { moneyContractHref } from "@/lib/connections";

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
  return (
    <section className="mb-8">
      <div className="mb-2 flex items-end justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{title}</p>
        {showAllHref ? (
          <Link href={showAllHref} className="text-sm font-semibold text-[var(--accent)]">
            All due
          </Link>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="border-t border-[var(--line)] py-6 text-base text-muted">
          {emptyTitle ?? "Nothing is due right now."}
        </p>
      ) : (
        <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {items.map((item) => (
            <Link
              key={item.id}
              href={moneyContractHref(item.contractId)}
              className="flex min-h-[4.75rem] items-center gap-3 py-3.5 transition-colors hover:bg-[var(--accent-soft)]/25"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-[family-name:var(--font-display)] text-[1.45rem] leading-[1.1] tracking-tight">
                  {item.contractName}
                </span>
                <span className="mt-1 block text-[0.95rem] leading-snug text-muted">
                  {item.kind === "legacy" ? item.label : `${item.label} · ${formatMoney(item.amount)}`}
                </span>
                <span
                  className={`mt-1 block text-sm font-semibold ${
                    item.overdue ? "text-[var(--warn)]" : "text-[var(--accent)]"
                  }`}
                >
                  {dueDateLabel(item.dueDate)}
                </span>
              </span>
              <span className="shrink-0 text-lg font-semibold text-[var(--accent)]" aria-hidden>
                →
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
