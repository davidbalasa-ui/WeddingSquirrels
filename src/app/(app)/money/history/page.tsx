import Link from "next/link";
import { MoneyChapterHeader } from "@/components/MoneyChapterHeader";
import { moneyContractHref } from "@/lib/connections";
import { formatMoney } from "@/lib/money";
import { loadMoneyPageData } from "@/lib/money-page";
import { requirePageSession } from "@/lib/session";

export default async function MoneyHistoryPage() {
  const session = await requirePageSession({ need: "canSeeBudget" });
  const data = await loadMoneyPageData(session);

  return (
    <>
      <MoneyChapterHeader title="History" subtitle="Payments that have already been made." />
      {data.historyItems.length === 0 ? (
        <p className="border-t border-[var(--line)] py-6 text-base text-muted">No payments recorded yet.</p>
      ) : (
        <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {data.historyItems.map((item) => (
            <Link
              key={item.id}
              href={moneyContractHref(item.contractId)}
              className="flex min-h-16 items-start justify-between gap-4 py-4"
            >
              <span className="min-w-0">
                <span className="block font-[family-name:var(--font-display)] text-[1.45rem] leading-[1.1]">
                  {item.contractName}
                </span>
                <span className="mt-1 block text-sm text-muted">{item.label}</span>
              </span>
              <span className="shrink-0 font-[family-name:var(--font-display)] text-xl">
                {formatMoney(item.amount)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
