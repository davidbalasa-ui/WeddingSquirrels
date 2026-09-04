import { MoneyPrintView } from "@/components/MoneyPrintView";
import { loadMinorExpenses, loadVisibleBudgetContracts } from "@/lib/money-page";
import { moneyEditable } from "@/lib/access";
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
  const canEdit = moneyEditable(session);
  const [items, minor] = await Promise.all([
    loadVisibleBudgetContracts(session),
    loadMinorExpenses(canEdit),
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
      minor={minor}
    />
  );
}
