import Link from "next/link";
import { redirect } from "next/navigation";
import { MoneyAddContract } from "@/components/MoneyAddContract";
import { MoneyContractList } from "@/components/MoneyContractList";
import { MoneyDueList } from "@/components/MoneyDueList";
import { MoneyHero } from "@/components/MoneyHero";
import { MoneyMinorList } from "@/components/MoneyMinorList";
import { MoneyPosition } from "@/components/MoneyPosition";
import { loadMoneyPageData } from "@/lib/money-page";
import { requirePageSession } from "@/lib/session";

export default async function MoneyPage({
  searchParams,
}: {
  searchParams: Promise<{ contract?: string }>;
}) {
  const session = await requirePageSession({ need: "canSeeBudget" });
  const params = await searchParams;
  if (params.contract) redirect(`/money/${params.contract}`);

  const data = await loadMoneyPageData(session);
  const comingDue = data.dueItems.slice(0, 6);

  return (
    <>
      <MoneyHero session={session} />
      <MoneyPosition summary={data.summary} />
      <MoneyDueList
        title="Coming due"
        items={comingDue}
        showAllHref="/money/due"
        emptyTitle="Nothing coming due."
      />
      {data.historyItems.length > 0 ? (
        <p className="mb-8 text-sm">
          <Link href="/money/history" className="font-semibold text-[var(--accent)]">
            Payment history
          </Link>
        </p>
      ) : null}
      <section className="mb-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          Contracts
        </p>
        <MoneyContractList contracts={data.contracts} />
        <MoneyAddContract canEdit={data.canEdit} />
      </section>
      <MoneyMinorList minor={data.minor} canEdit={data.canEdit} />
    </>
  );
}
