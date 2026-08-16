import { GiftPrintView } from "@/components/GiftPrintView";
import { prisma } from "@/lib/db";
import { giftPrintRows } from "@/lib/guest-gifts";
import { requirePageSession } from "@/lib/session";

export default async function GuestsPrintPage() {
  await requirePageSession({ need: "canSeeGuests" });
  const guests = await prisma.guest.findMany({
    orderBy: [{ nameLine1: "asc" }, { sortOrder: "asc" }],
    include: { gifts: { orderBy: { sortOrder: "asc" } } },
  });

  return <GiftPrintView rows={giftPrintRows(guests)} />;
}
