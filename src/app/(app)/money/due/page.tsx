import { MoneyChapterHeader } from "@/components/MoneyChapterHeader";
import { MoneyDueList } from "@/components/MoneyDueList";
import { loadMoneyPageData } from "@/lib/money-page";
import { requirePageSession } from "@/lib/session";

export default async function MoneyDuePage() {
  const session = await requirePageSession({ need: "canSeeBudget" });
  const data = await loadMoneyPageData(session);

  return (
    <>
      <MoneyChapterHeader
        title="Coming due"
        subtitle="What still needs to be paid, in the order it comes due."
      />
      <MoneyDueList title="Payments" items={data.dueItems} emptyTitle="Nothing is due." />
    </>
  );
}
