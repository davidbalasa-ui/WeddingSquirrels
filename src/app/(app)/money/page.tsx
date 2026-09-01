import { MoneyBoard } from "@/components/MoneyBoard";
import { MoneyDueList } from "@/components/MoneyDueList";
import { MoneyHero } from "@/components/MoneyHero";
import { V2PageHeader } from "@/components/V2PageHeader";
import { moneyEditable } from "@/lib/access";
import { prisma } from "@/lib/db";
import { loadMoneyPageData } from "@/lib/money-page";
import { requirePageSession } from "@/lib/session";

export default async function MoneyPage() {
  const session = await requirePageSession({ need: "canSeeBudget" });
  const canEdit = moneyEditable(session);
  const data = await loadMoneyPageData(session);

  const minorCandidates = canEdit
    ? await prisma.task.findMany({
        where: {
          parentId: null,
          budgetItemId: null,
          OR: [{ amountNeeded: { not: null } }, { amountSpent: { gt: 0 } }],
        },
        orderBy: [{ title: "asc" }],
        select: {
          id: true,
          title: true,
          summary: true,
          planNotes: true,
          amountNeeded: true,
          amountSpent: true,
        },
      })
    : [];

  return (
    <>
      <V2PageHeader
        session={session}
        title="Money"
        subtitle={`${data.summary.overdueCount} overdue · ${data.summary.dueSoonCount} due soon`}
      />
      <MoneyHero summary={data.summary} />
      <MoneyDueList
        title={data.overdueItems.length > 0 ? "Overdue payments" : "Due next"}
        items={data.overdueItems.length > 0 ? data.overdueItems : data.dueItems}
        showAllHref="/money/due"
      />
      <MoneyBoard items={data.contracts} minor={minorCandidates} canEdit={canEdit} hideSummary />
    </>
  );
}
