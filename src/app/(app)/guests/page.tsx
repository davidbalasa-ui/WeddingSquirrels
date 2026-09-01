import { appendFileSync } from "node:fs";
import { AppHeader } from "@/components/AppHeader";
import { GuestList } from "@/components/GuestList";
import { GuestRsvpReport } from "@/components/GuestRsvpReport";
import { GuestRsvpSync } from "@/components/GuestRsvpSync";
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
  // #region agent log
  appendFileSync("/opt/cursor/logs/debug.log", JSON.stringify({ hypothesisId: "C", location: "src/app/(app)/guests/page.tsx:GuestsPage:loaded", message: "Guests page loaded RSVP distribution", data: { total: guests.length, attending: guests.filter((guest) => guest.rsvpStatus === "attending").length, notAttending: guests.filter((guest) => guest.rsvpStatus === "not_attending").length, pending: guests.filter((guest) => guest.rsvpStatus === "pending").length }, timestamp: Date.now() }) + "\n");
  // #endregion
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
      <GuestList
        guests={guests.map((guest) => mapGuestRecord(guest))}
        canEdit={canEdit}
        startInEdit={startInEdit}
      />
    </>
  );
}
