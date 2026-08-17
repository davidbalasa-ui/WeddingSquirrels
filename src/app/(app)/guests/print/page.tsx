import { GiftPrintView } from "@/components/GiftPrintView";
import { prisma } from "@/lib/db";
import { giftPrintRows } from "@/lib/guest-gifts";
import { guestInclude, mapGuestRecord } from "@/lib/guests";
import { requirePageSession } from "@/lib/session";

export default async function GuestsPrintPage() {
  await requirePageSession({ need: "canSeeGuests" });
  const guests = await prisma.guest.findMany({
    orderBy: [{ nameLine1: "asc" }, { sortOrder: "asc" }],
    include: guestInclude(),
  });

  return (
    <GiftPrintView
      rows={giftPrintRows(
        guests.map((guest) => {
          const record = mapGuestRecord(guest);
          return {
            id: record.id,
            nameLine1: record.people[0]?.name ?? "",
            nameLine2: record.people[1]?.name ?? null,
            people: record.people,
            street: record.street,
            city: record.city,
            state: record.state,
            zip: record.zip,
            gifts: record.gifts,
          };
        }),
      )}
    />
  );
}
