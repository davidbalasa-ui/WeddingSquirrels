import Link from "next/link";
import { moneyContractHref } from "@/lib/connections";
import type { TodayAttentionPayment } from "@/lib/today";

function formatMoney(amount: number) {
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function TodayAttentionPaymentRow({ item }: { item: TodayAttentionPayment }) {
  const dateLine = item.dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <Link
      href={moneyContractHref(item.budgetItemId)}
      className="flex items-start gap-2 py-2 transition-colors hover:bg-[var(--accent-soft)]/20"
    >
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-[var(--warn)] text-[10px] font-bold text-[var(--warn)]">
        $
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[15px] font-semibold leading-snug">{item.name}</p>
          <span className="text-[13px] text-muted">{formatMoney(item.amountRemaining)}</span>
        </div>
        <p
          className={`mt-0.5 text-xs ${
            item.urgency === "high" ? "font-semibold text-[var(--danger)]" : "text-muted"
          }`}
        >
          {item.reason} · {dateLine}
        </p>
      </div>
    </Link>
  );
}
