import { DayTimeline } from "@/components/DayTimeline";
import { PlanChapterHeader } from "@/components/PlanChapterHeader";
import { timelineEditable } from "@/lib/access";
import { loadDayOfContext, loadWeddingTimelineBlocks } from "@/lib/day-of-page";
import { loadTimelineRelatedTasks } from "@/lib/tasks";
import { requirePageSession } from "@/lib/session";

export default async function PlanTimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string | string[] }>;
}) {
  const session = await requirePageSession({ need: "canSeeTimeline" });
  const canEdit = timelineEditable(session);
  const params = await searchParams;
  const editParam = Array.isArray(params.edit) ? params.edit[0] : params.edit;
  const startInEdit = canEdit && editParam === "1";
  const [blocks, context] = await Promise.all([loadWeddingTimelineBlocks(), loadDayOfContext()]);
  const relatedByBlockId = await loadTimelineRelatedTasks(
    session,
    blocks.map((block) => block.id),
  );

  const subtitle = context.weddingDateLabel
    ? `What is supposed to happen on ${context.weddingDateLabel}.`
    : "What is supposed to happen throughout the wedding day.";

  return (
    <>
      <PlanChapterHeader title="Wedding Day" subtitle={subtitle} />
      <DayTimeline
        blocks={blocks}
        canEdit={canEdit}
        startInEdit={startInEdit}
        relatedByBlockId={relatedByBlockId}
      />
    </>
  );
}
