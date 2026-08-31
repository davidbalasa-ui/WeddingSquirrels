import Link from "next/link";
import { Suspense } from "react";
import { ShoppingListBoard } from "@/components/ShoppingListBoard";
import { V2PageHeader } from "@/components/V2PageHeader";
import { prisma } from "@/lib/db";
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
    session.canSeeTasks
      ? prisma.task.findMany({
          where: { parentId: null, orgKey: null },
          orderBy: { title: "asc" },
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
  ]);

  const toBuyCount = items.filter((item) => !item.purchased).length;

  return (
    <>
      <V2PageHeader
        session={session}
        title="Shopping"
        subtitle={`${toBuyCount} to buy · shared list`}
      />
      <Link
        href="/plan"
        className="mb-3 inline-block text-sm font-semibold text-[var(--accent)]"
      >
        ‹ Plan
      </Link>
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
