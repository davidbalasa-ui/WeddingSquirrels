import { AppHeader } from "@/components/AppHeader";
import { GuestList } from "@/components/GuestList";
import { GuestRsvpReport } from "@/components/GuestRsvpReport";
import { GuestRsvpSync } from "@/components/GuestRsvpSync";
import { prisma } from "@/lib/db";
import { summarizeGuestRsvp } from "@/lib/guest-gifts";
import { guestInclude, mapGuestRecord, mapGuestRsvpFields } from "@/lib/guests";
import { requirePageSession } from "@/lib/session";

export default async function GuestsPage() {
  const session = await requirePageSession({ need: "canSeeGuests" });
  const canEdit = session.canSeeGuests;
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
      {session.isMaster ? <GuestRsvpSync /> : null}
      <GuestList guests={guests.map((guest) => mapGuestRecord(guest))} canEdit={canEdit} />
    </>
  );
}
