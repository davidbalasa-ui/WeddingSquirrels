import Link from "next/link";
import { formatMoney, type MoneySummary } from "@/lib/money";

export function MoneyHero({ summary }: { summary: MoneySummary }) {
  return (
    <section className="card mb-6 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Remaining
          </p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-4xl leading-none text-[var(--accent)]">
            {formatMoney(summary.remaining)}
          </p>
          <p className="mt-2 text-sm text-muted">
            {formatMoney(summary.paid)} paid of {formatMoney(summary.committed)}
          </p>
        </div>
        <Link href="/money/print" className="btn-secondary print-hide shrink-0 px-4 py-2 text-sm">
          Print
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-[var(--warn-soft)] px-3 py-2">
          <p className="text-xs text-muted">Overdue</p>
          <p className="font-semibold text-[var(--warn)]">
            {summary.overdueCount > 0
              ? `${summary.overdueCount} · ${formatMoney(summary.overdueAmount)}`
              : "None"}
          </p>
        </div>
        <div className="rounded-xl bg-[var(--accent-soft)] px-3 py-2">
          <p className="text-xs text-muted">Due soon</p>
          <p className="font-semibold text-[var(--accent)]">
            {summary.dueSoonCount > 0
              ? `${summary.dueSoonCount} · ${formatMoney(summary.dueSoonAmount)}`
              : "Clear"}
          </p>
        </div>
      </div>
    </section>
  );
}
