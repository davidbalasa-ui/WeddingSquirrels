import { AppHeader } from "@/components/AppHeader";
import { MoneyBoard } from "@/components/MoneyBoard";
import { budgetVisibilityWhere, moneyEditable, showNothingSharedYet } from "@/lib/access";
import { prisma } from "@/lib/db";
import { requirePageSession } from "@/lib/session";

export default async function MoneyPage() {
  const session = await requirePageSession({ need: "canSeeBudget" });

  const shareCount = session.isMaster
    ? 0
    : await prisma.budgetItemShare.count({ where: { pinAccountId: session.id } });
  const nothingSharedYet = showNothingSharedYet(session, shareCount);

  const rawItems = nothingSharedYet
    ? []
    : await prisma.budgetItem.findMany({
        where: budgetVisibilityWhere(session),
        orderBy: { sortOrder: "asc" },
        include: { shares: { select: { pinAccountId: true } } },
      });

  const [minorCandidates, shareAccounts] = await Promise.all([
    session.isMaster
      ? prisma.task.findMany({
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
      : Promise.resolve([]),
    prisma.pinAccount.findMany({
      where: { isMaster: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const items = rawItems.map((item) => ({
    id: item.id,
    name: item.name,
    price: item.price,
    amountPaid: item.amountPaid,
    ownerId: item.ownerId,
    note: item.note,
    sharedPinAccountIds: item.shares.map((s) => s.pinAccountId),
  }));

  return (
    <>
      <AppHeader session={session} title="Money" subtitle="Budget + minor expenses from decisions" />
      <MoneyBoard
        items={items}
        minor={minorCandidates}
        canEdit={moneyEditable(session)}
        shareAccounts={shareAccounts}
        emptyMessage={nothingSharedYet ? "Nothing shared with you yet." : null}
      />
    </>
  );
}
