import { AppHeader } from "@/components/AppHeader";
import { MoneyBoard } from "@/components/MoneyBoard";
import { moneyEditable } from "@/lib/access";
import { prisma } from "@/lib/db";
import { requirePageSession } from "@/lib/session";

function toDateInput(value: Date | null) {
  if (!value) return null;
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default async function MoneyPage() {
  const session = await requirePageSession({ need: "canSeeBudget" });
  const canEdit = moneyEditable(session);

  const [allItems, minorCandidates] = await Promise.all([
    prisma.budgetItem.findMany({
      orderBy: { sortOrder: "asc" },
      include: { shares: { select: { pinAccountId: true } } },
    }),
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

  const items =
    session.isMaster || canEdit
      ? allItems
      : session.canSeeBudget
        ? allItems.filter(
            (item) =>
              (session.linkedPersonId != null && item.ownerId === session.linkedPersonId) ||
              item.shares.some((share) => share.pinAccountId === session.id),
          )
        : [];

  return (
    <>
      <AppHeader session={session} title="Money" subtitle="Budget + minor expenses from decisions" />
      <MoneyBoard
        items={items.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          amountPaid: item.amountPaid,
          ownerId: item.ownerId,
          paidById: item.paidById,
          payByDate: toDateInput(item.payByDate),
          note: item.note,
          sortOrder: item.sortOrder,
        }))}
        minor={canEdit ? minorCandidates : []}
        canEdit={canEdit}
      />
    </>
  );
}
