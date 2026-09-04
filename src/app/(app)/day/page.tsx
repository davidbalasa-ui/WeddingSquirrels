import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { DayTabs } from "@/components/DayTabs";
import { DayTimeline } from "@/components/DayTimeline";
import { timelineEditable } from "@/lib/access";
import { isWeddingDay } from "@/lib/day-of-now";
import { loadDayOfContext, loadWeddingTimelineBlocks } from "@/lib/day-of-page";
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
  const [context, blocks] = await Promise.all([loadDayOfContext(), loadWeddingTimelineBlocks()]);

  if (context.showNowTab && isWeddingDay(context.daysToGo) && viewParam !== "timeline") {
    redirect("/day/now");
  }

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
