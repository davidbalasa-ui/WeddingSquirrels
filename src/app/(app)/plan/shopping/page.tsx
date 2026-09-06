import { Suspense } from "react";
import { PlanChapterHeader } from "@/components/PlanChapterHeader";
import { ShoppingListBoard } from "@/components/ShoppingListBoard";
import { loadPlanShoppingPage } from "@/lib/plan-pages";
import { requirePageSession } from "@/lib/session";

export default async function PlanShoppingPage({
  searchParams,
}: {
  searchParams: Promise<{ who?: string; purchased?: string }>;
}) {
  const session = await requirePageSession({ need: "canSeeShop" });
  const sp = await searchParams;
  const who = sp.who || "all";
  const showPurchased = sp.purchased === "1";
  const data = await loadPlanShoppingPage(session, { who });
  const subtitle =
    data.summary.remaining === 0
      ? data.summary.purchased === 0
        ? "Nothing on the list yet."
        : "Everything is purchased."
      : data.summary.remaining === 1
        ? "1 thing left."
        : `${data.summary.remaining} things left.`;

  return (
    <>
      <PlanChapterHeader title="Shopping" subtitle={subtitle} />
      <Suspense>
        <ShoppingListBoard
          items={data.items}
          tasks={data.tasks}
          who={who}
          showPurchased={showPurchased}
        />
      </Suspense>
    </>
  );
}
