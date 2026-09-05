import { DayTimeline } from "@/components/DayTimeline";
import { MealBoard } from "@/components/MealBoard";
import { PlanChapterHeader } from "@/components/PlanChapterHeader";
import { mealsEditable, rehearsalScheduleEditable } from "@/lib/access";
import { loadPlanRehearsalPage } from "@/lib/plan-pages";
import { loadTimelineRelatedTasks } from "@/lib/tasks";
import { requirePageSession } from "@/lib/session";

export default async function PlanRehearsalPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string | string[] }>;
}) {
  const session = await requirePageSession({ need: "canSeeDinner" });
  const canEditSchedule = rehearsalScheduleEditable(session);
  const canEditMenu = mealsEditable(session);
  const params = await searchParams;
  const editParam = Array.isArray(params.edit) ? params.edit[0] : params.edit;
  const startInEdit = canEditSchedule && editParam === "1";
  const data = await loadPlanRehearsalPage();
  const relatedByBlockId = await loadTimelineRelatedTasks(
    session,
    data.blocks.map((block) => block.id),
  );

  return (
    <>
      <PlanChapterHeader
        title="Rehearsal & Dinner"
        subtitle="Walkthrough, dinner, and meal choices."
      />

      <section className="mb-10">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          Walkthrough
        </p>
        <DayTimeline
          blocks={data.blocks}
          canEdit={canEditSchedule}
          startInEdit={startInEdit}
          schedule="rehearsal"
          idPrefix="reh"
          fixedAdd={false}
          relatedByBlockId={relatedByBlockId}
        />
      </section>

      <section>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          Dinner
        </p>
        <MealBoard
          courses={data.courses}
          guests={data.guests}
          published={data.published}
          canEditMenu={canEditMenu}
          sessionName={session.name}
        />
      </section>
    </>
  );
}
