import { MoneyPrintView } from "@/components/MoneyPrintView";
import { prisma } from "@/lib/db";
import { requirePageSession } from "@/lib/session";

function toDateInput(value: Date | null) {
  if (!value) return null;
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default async function MoneyPrintPage() {
  const session = await requirePageSession({ need: "canSeeBudget" });
  void session;

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
        planNotes: true,
        amountNeeded: true,
        amountSpent: true,
      },
    }),
  ]);

  return (
    <MoneyPrintView
      items={items.map((item) => ({
        id: item.id,
        name: item.name,
        ownerId: item.ownerId,
        paidById: item.paidById,
        price: item.price,
        amountPaid: item.amountPaid,
        payByDate: toDateInput(item.payByDate),
        note: item.note,
        sortOrder: item.sortOrder,
      }))}
      minor={minorCandidates}
    />
  );
}
