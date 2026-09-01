import Link from "next/link";
import { MoneyDueList } from "@/components/MoneyDueList";
import { MoneyHero } from "@/components/MoneyHero";
import { V2PageHeader } from "@/components/V2PageHeader";
import { buildMoneyDueItems } from "@/lib/money";
import { loadMoneyPageData } from "@/lib/money-page";
import { requirePageSession } from "@/lib/session";

export default async function MoneyDuePage() {
  const session = await requirePageSession({ need: "canSeeBudget" });
  const data = await loadMoneyPageData(session);
  const dueItems = buildMoneyDueItems(data.contracts);

  return (
    <>
      <V2PageHeader session={session} title="Due payments" subtitle="Overdue and upcoming installments" />
      <MoneyHero summary={data.summary} />
      <MoneyDueList title="All upcoming and overdue" items={dueItems} />
      <div className="mt-6">
        <Link href="/money" className="text-sm font-semibold text-[var(--accent)]">
          ← Back to Money
        </Link>
      </div>
    </>
  );
}
