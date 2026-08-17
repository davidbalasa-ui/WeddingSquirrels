import { AppHeader } from "@/components/AppHeader";
import { GuestList } from "@/components/GuestList";
import { GuestRsvpReport } from "@/components/GuestRsvpReport";
import { prisma } from "@/lib/db";
import { summarizeGuestRsvp } from "@/lib/guest-gifts";
import { guestInclude, mapGuestRecord, mapGuestRsvpFields } from "@/lib/guests";
import { requirePageSession } from "@/lib/session";

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string | string[] }>;
}) {
  const session = await requirePageSession({ need: "canSeeGuests" });
  const canEdit = session.canSeeGuests;
  const params = await searchParams;
  const editParam = Array.isArray(params.edit) ? params.edit[0] : params.edit;
  const startInEdit = canEdit && editParam === "1";
  const guests = await prisma.guest.findMany({
    orderBy: { sortOrder: "asc" },
    include: guestInclude(),
  });
  const giftCount = guests.reduce((sum, guest) => sum + guest.gifts.length, 0);
  const report = summarizeGuestRsvp(guests.map((guest) => mapGuestRsvpFields(guest)));

  return (
    <>
      <AppHeader
        session={session}
        title="Guests"
        subtitle={`${guests.length} households · ${giftCount} gifts`}
      />
      <GuestRsvpReport report={report} />
      <GuestList
        guests={guests.map((guest) => mapGuestRecord(guest))}
        canEdit={canEdit}
        startInEdit={startInEdit}
      />
    </>
  );
}
