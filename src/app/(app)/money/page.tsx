import { AppHeader } from "@/components/AppHeader";
import { MoneyBoard } from "@/components/MoneyBoard";
import { prisma } from "@/lib/db";
import { requirePageSession } from "@/lib/session";

export default async function MoneyPage() {
  const session = await requirePageSession({ need: "canSeeBudget" });

  const [items, minorCandidates] = await Promise.all([
    prisma.budgetItem.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.task.findMany({
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
    }),
  ]);

  return (
    <>
      <AppHeader session={session} title="Money" subtitle="Budget + minor expenses from decisions" />
      <MoneyBoard items={items} minor={minorCandidates} canEdit={session.isMaster} />
    </>
  );
}
