import { DayTimeline } from "@/components/DayTimeline";
import { DayTabs } from "@/components/DayTabs";
import { PlanChapterHeader } from "@/components/PlanChapterHeader";
import { timelineEditable } from "@/lib/access";
import { loadTimelineRoleNames } from "@/lib/day-timeline-roles";
import { ReconciledTimelineCard } from "@/components/ReconciledTimelineCard";
import { prisma } from "@/lib/db";
import { planReconciledTimeline } from "@/lib/reconciled-timeline";
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
  const [blocks, context, roleNames] = await Promise.all([
    loadWeddingTimelineBlocks(),
    loadDayOfContext(),
    loadTimelineRoleNames(),
  ]);
  const reconciledPlan = session.isMaster
    ? planReconciledTimeline(
        await prisma.timelineBlock.findMany({
          select: { id: true, seedKey: true, schedule: true, startAt: true, endAt: true, notes: true, sortOrder: true },
        }),
      )
    : null;
  const relatedByBlockId = await loadTimelineRelatedTasks(
    session,
    blocks.map((block) => block.id),
  );

  const subtitle = context.weddingDateLabel
    ? `What is supposed to happen on ${context.weddingDateLabel}.`
    : "What is supposed to happen throughout the wedding day.";

  return (
    <div className="timeline-print-page">
      <PlanChapterHeader title="Wedding Day" subtitle={subtitle} />
      <DayTabs />
      {reconciledPlan ? <ReconciledTimelineCard plan={reconciledPlan} /> : null}
      <DayTimeline
        blocks={blocks}
        canEdit={canEdit}
        startInEdit={startInEdit}
        relatedByBlockId={relatedByBlockId}
        printTitle="Wedding Day"
        printSubtitle={context.weddingDateLabel}
        roleNames={roleNames}
      />
    </div>
  );
}
