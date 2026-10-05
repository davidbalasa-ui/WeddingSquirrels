import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { DayTabs } from "@/components/DayTabs";
import { VenueLayoutFigure } from "@/components/VenueLayoutFigure";
import { requirePageSession } from "@/lib/session";

export default async function DayVenuePage() {
  const session = await requirePageSession({ need: "canSeeTimeline" });

  return (
    <>
      <AppHeader session={session} title="Day-of" subtitle="Venue layout · Black Sheep Shelter" />
      <DayTabs />
      <VenueLayoutFigure />
      <p className="mt-4 text-sm text-muted">
        Who sits where is under{" "}
        <Link href="/people?tab=guests" className="font-semibold text-[var(--accent)]">
          Guests
        </Link>
        . To update this drawing, replace the file at <code>public/seating-layout.png</code>.
      </p>
    </>
  );
}
