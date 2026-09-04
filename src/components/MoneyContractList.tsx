import Link from "next/link";
import {
  contractPaidTotal,
  contractRemaining,
  formatMoney,
  nextDueStateLabel,
  type BudgetContractSnapshot,
} from "@/lib/money";
import { moneyContractHref } from "@/lib/connections";

export function MoneyContractList({
  contracts,
  now,
}: {
  contracts: BudgetContractSnapshot[];
  now?: Date;
}) {
  if (contracts.length === 0) {
    return (
      <p className="border-t border-[var(--line)] py-6 text-base text-muted">No contracts yet.</p>
    );
  }

  return (
    <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
      {contracts.map((contract) => {
        const paid = contractPaidTotal(contract);
        const remaining = contractRemaining(contract);
        const nextLabel = nextDueStateLabel(contract, now);
        const overdue = nextLabel.startsWith("Overdue");

        return (
          <Link
            key={contract.id}
            href={moneyContractHref(contract.id)}
            className="flex min-h-16 items-start justify-between gap-4 py-4 transition-colors hover:bg-[var(--accent-soft)]/25"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-[family-name:var(--font-display)] text-[1.55rem] leading-[1.1] tracking-tight">
                {contract.name}
              </span>
              <span className="mt-1.5 block text-[0.95rem] leading-snug text-muted">
                {formatMoney(contract.price)} contract
              </span>
              <span className="mt-1 block text-sm leading-snug text-muted">
                {formatMoney(paid)} paid · {formatMoney(remaining)} remaining
              </span>
              <span className={`mt-1 block text-sm ${overdue ? "font-semibold text-[var(--warn)]" : "text-muted"}`}>
                {nextLabel}
              </span>
            </span>
            <span className="shrink-0 pt-2 text-lg font-semibold text-[var(--accent)]" aria-hidden>
              →
            </span>
          </Link>
        );
      })}
    </div>
  );
}
