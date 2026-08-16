import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { GuestCard } from "@/components/GuestCard";
import { prisma } from "@/lib/db";
import { requirePageSession } from "@/lib/session";

export default async function GuestsPage() {
  const session = await requirePageSession({ need: "canSeeGuests" });
  const guests = await prisma.guest.findMany({
    orderBy: { sortOrder: "asc" },
    include: { gifts: { orderBy: { sortOrder: "asc" } } },
  });
  const giftCount = guests.reduce((sum, guest) => sum + guest.gifts.length, 0);

  return (
    <>
      <AppHeader
        session={session}
        title="Guests"
        subtitle={`${guests.length} households · ${giftCount} gifts`}
      />
      <div className="mb-3 flex justify-end print-hide">
        <Link href="/guests/print" className="btn-secondary px-4 py-2 text-sm">
          Print gift list
        </Link>
      </div>
      <div className="flex flex-col gap-3">
        {guests.map((guest) => (
          <GuestCard
            key={guest.id}
            guest={{
              id: guest.id,
              nameLine1: guest.nameLine1,
              nameLine2: guest.nameLine2,
              street: guest.street,
              city: guest.city,
              state: guest.state,
              zip: guest.zip,
              person1TableNumber: guest.person1TableNumber,
              person1TableSpot: guest.person1TableSpot,
              person2TableNumber: guest.person2TableNumber,
              person2TableSpot: guest.person2TableSpot,
              gifts: guest.gifts.map((gift) => ({
                id: gift.id,
                description: gift.description,
                thanked: gift.thanked,
              })),
            }}
          />
        ))}
      </div>
    </>
  );
}
