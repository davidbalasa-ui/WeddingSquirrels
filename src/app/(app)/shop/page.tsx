import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ShoppingListBoard } from "@/components/ShoppingListBoard";
import { prisma } from "@/lib/db";
import { requirePageSession } from "@/lib/session";

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ who?: string; purchased?: string }>;
}) {
  const session = await requirePageSession({ need: "canSeeTasks" });
  const sp = await searchParams;
  const who = sp.who || "all";
  const showPurchased = sp.purchased === "1";

  const ownerWhere =
    who === "david"
      ? { ownerId: "david" as const }
      : who === "haley"
        ? { ownerId: "haley" as const }
        : who === "both"
          ? { ownerId: null }
          : {};

  const [items, tasks] = await Promise.all([
    prisma.shoppingItem.findMany({
      where: ownerWhere,
      include: {
        owner: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
      orderBy: [{ purchased: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.task.findMany({
      where: { parentId: null, orgKey: null },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  const toBuyCount = items.filter((i) => !i.purchased).length;

  return (
    <>
      <AppHeader
        session={session}
        title="Shop"
        subtitle={`${toBuyCount} to buy · shared shopping list`}
      />
      <Suspense>
        <ShoppingListBoard
          items={items}
          tasks={tasks}
          who={who}
          showPurchased={showPurchased}
        />
      </Suspense>
    </>
  );
}
