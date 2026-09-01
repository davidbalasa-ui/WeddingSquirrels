import { MoneyDueList } from "@/components/MoneyDueList";
import { MoneyFundingSummary } from "@/components/MoneyFundingSummary";
import { V2PageHeader } from "@/components/V2PageHeader";
import { loadMoneyPageData } from "@/lib/money-page";
import { requirePageSession } from "@/lib/session";

export default async function MoneyDuePage() {
  const session = await requirePageSession({ need: "canSeeBudget" });
  const data = await loadMoneyPageData(session);

  return (
    <>
      <V2PageHeader session={session} title="Due payments" subtitle="Installments and balances" />
      <MoneyFundingSummary
        ledger={data.ledger}
        sources={data.fundingSources}
        canEdit={false}
      />
      <MoneyDueList title="All due payments" items={data.overdueItems.length > 0 ? data.overdueItems : data.dueItems} />
      <div className="mt-6">
        <a href="/money" className="text-sm font-semibold text-[var(--accent)]">
          ← Back to Money
        </a>
      </div>
    </>
  );
}
