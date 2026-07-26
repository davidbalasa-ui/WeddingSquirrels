import { AppHeader } from "@/components/AppHeader";
import { BudgetCard } from "@/components/BudgetCard";
import { prisma } from "@/lib/db";
import { requirePageSession } from "@/lib/session";

export default async function MoneyPage() {
  const session = await requirePageSession({ need: "canSeeBudget" });
  const items = await prisma.budgetItem.findMany({ orderBy: { sortOrder: "asc" } });

  const total = items.reduce((s, i) => s + i.price, 0);
  const paid = items.reduce((s, i) => s + i.amountPaid, 0);
  const remaining = total - paid;

  return (
    <>
      <AppHeader
        session={session}
        title="Money"
        subtitle="What’s left, and who owns it"
      />

      <section className="card mb-4 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Remaining</p>
        <p className="mt-1 font-[family-name:var(--font-display)] text-4xl text-[var(--accent)]">
          ${remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
        <p className="mt-2 text-sm text-muted">
          ${paid.toLocaleString(undefined, { maximumFractionDigits: 0 })} paid of $
          {total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
      </section>

      <p className="mb-3 text-sm text-muted">
        {session.isMaster ? "Tap a card’s owner to assign David, Haley, or Both." : "Budget overview"}
      </p>

      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <BudgetCard key={item.id} item={item} canEdit={session.isMaster} />
        ))}
      </div>
    </>
  );
}
