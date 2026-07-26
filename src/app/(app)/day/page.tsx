import { AppHeader } from "@/components/AppHeader";
import { DayTimeline } from "@/components/DayTimeline";
import { prisma } from "@/lib/db";
import { requirePageSession } from "@/lib/session";

export default async function DayPage() {
  const session = await requirePageSession({ need: "canSeeTimeline" });
  const blocks = await prisma.timelineBlock.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <>
      <AppHeader session={session} title="Day-of" subtitle="October 16, 2026" />
      <p className="mb-3 text-sm text-muted">
        {session.canSeeTimeline
          ? "Tap the star on any moment to edit. Everything stays editable."
          : "Day-of schedule"}
      </p>
      <DayTimeline blocks={blocks} canEdit={session.canSeeTimeline} />
    </>
  );
}
