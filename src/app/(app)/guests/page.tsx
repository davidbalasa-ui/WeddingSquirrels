import { AppHeader } from "@/components/AppHeader";
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
          <article key={guest.id} className="card p-4">
            <p className="font-semibold">
              {guest.nameLine1}
              {guest.nameLine2 ? ` ${guest.nameLine2}` : ""}
            </p>
            <p className="mt-1 text-sm text-muted">
              {[guest.street, [guest.city, guest.state].filter(Boolean).join(", "), guest.zip]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </article>
        ))}
      </div>
    </>
  );
}
