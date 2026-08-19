import { AppHeader } from "@/components/AppHeader";
import { DayTabs } from "@/components/DayTabs";
import { DayTimeline } from "@/components/DayTimeline";
import { timelineEditable } from "@/lib/access";
import { prisma } from "@/lib/db";
import { sortTimelineBlocks } from "@/lib/day-of-time";
import { requirePageSession } from "@/lib/session";

export default async function DayPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string | string[] }>;
}) {
  const session = await requirePageSession({ need: "canSeeTimeline" });
  const canEdit = timelineEditable(session);
  const params = await searchParams;
  const editParam = Array.isArray(params.edit) ? params.edit[0] : params.edit;
  const startInEdit = canEdit && editParam === "1";
  const blocks = sortTimelineBlocks(
    await prisma.timelineBlock.findMany({ where: { schedule: "wedding" } }),
  );

  return (
    <>
      <AppHeader session={session} title="Day-of" subtitle="October 16, 2026" />
      <DayTabs />
      <DayTimeline blocks={blocks} canEdit={canEdit} startInEdit={startInEdit} />
    </>
  );
}
