import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { DayTabs } from "@/components/DayTabs";
import { DayTimeline } from "@/components/DayTimeline";
import { timelineEditable } from "@/lib/access";
import { isWeddingDay } from "@/lib/day-of-now";
import { loadDayOfContext } from "@/lib/day-of-page";
import { prisma } from "@/lib/db";
import { sortTimelineBlocks } from "@/lib/day-of-time";
import { requirePageSession } from "@/lib/session";

export default async function DayPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string | string[]; view?: string | string[] }>;
}) {
  const session = await requirePageSession({ need: "canSeeTimeline" });
  const canEdit = timelineEditable(session);
  const params = await searchParams;
  const editParam = Array.isArray(params.edit) ? params.edit[0] : params.edit;
  const viewParam = Array.isArray(params.view) ? params.view[0] : params.view;
  const startInEdit = canEdit && editParam === "1";
  const context = await loadDayOfContext();

  if (context.showNowTab && isWeddingDay(context.daysToGo) && viewParam !== "timeline") {
    redirect("/day/now");
  }

  const blocks = sortTimelineBlocks(
    await prisma.timelineBlock.findMany({ where: { schedule: "wedding" } }),
  );

  return (
    <>
      <AppHeader
        session={session}
        title="Day-of"
        subtitle={context.weddingDateLabel ?? "October 16, 2026"}
      />
      <DayTabs showNowTab={context.showNowTab} />
      <DayTimeline blocks={blocks} canEdit={canEdit} startInEdit={startInEdit} />
    </>
  );
}
