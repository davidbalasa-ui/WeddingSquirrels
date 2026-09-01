import { Suspense } from "react";
import { MoneyBoard } from "@/components/MoneyBoard";
import { MoneyDueList } from "@/components/MoneyDueList";
import { MoneyFundingSummary } from "@/components/MoneyFundingSummary";
import { PageLoading } from "@/components/PageLoading";
import { V2PageHeader } from "@/components/V2PageHeader";
import { moneyEditable } from "@/lib/access";
import { findProfileIdForBudgetName, profileHref } from "@/lib/connections";
import { prisma } from "@/lib/db";
import { loadMoneyPageData } from "@/lib/money-page";
import { requirePageSession } from "@/lib/session";

export default async function MoneyPage() {
  const session = await requirePageSession({ need: "canSeeBudget" });
  const canEdit = moneyEditable(session);
  const data = await loadMoneyPageData(session);

  const [persons, contacts] = await Promise.all([
    prisma.person.findMany({ select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
    session.canSeeTimeline
      ? prisma.contact.findMany({ select: { id: true, name: true }, orderBy: { sortOrder: "asc" } })
      : Promise.resolve([]),
  ]);

  const profileHrefByContractId = Object.fromEntries(
    data.contracts
      .map((contract) => {
        const profileId = findProfileIdForBudgetName(contract.name, contacts, persons);
        return profileId ? [contract.id, profileHref(profileId)] : null;
      })
      .filter((entry): entry is [string, string] => entry !== null),
  );

  return (
    <>
      <V2PageHeader
        session={session}
        title="Money"
        subtitle={`${data.summary.overdueCount} overdue · ${data.summary.dueSoonCount} due soon`}
      />
      <MoneyFundingSummary
        ledger={data.ledger}
        sources={data.fundingSources}
        canEdit={canEdit}
      />
      <MoneyDueList
        title={data.overdueItems.length > 0 ? "Overdue payments" : "Due next"}
        items={data.overdueItems.length > 0 ? data.overdueItems : data.dueItems}
        showAllHref="/money/due"
      />
      <Suspense fallback={<PageLoading label="Loading budget" />}>
        <MoneyBoard
          items={data.contracts}
          minor={data.minor}
          canEdit={canEdit}
          profileHrefByContractId={profileHrefByContractId}
        />
      </Suspense>
    </>
  );
}
