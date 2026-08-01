import { AppHeader } from "@/components/AppHeader";
import { GuestCard } from "@/components/GuestCard";
import { prisma } from "@/lib/db";
import { requirePageSession } from "@/lib/session";

export default async function GuestsPage() {
  const session = await requirePageSession({ need: "canSeeGuests" });
  const guests = await prisma.guest.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <>
      <AppHeader session={session} title="Guests" subtitle={`${guests.length} households`} />
      <div className="flex flex-col gap-3">
        {guests.map((guest) => (
          <GuestCard key={guest.id} guest={guest} />
        ))}
      </div>
    </>
  );
}
