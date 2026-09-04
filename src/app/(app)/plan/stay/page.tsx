import { PlanChapterHeader } from "@/components/PlanChapterHeader";
import { StayBoard } from "@/components/StayBoard";
import { loadPlanStayPage } from "@/lib/plan-pages";
import { summarizeStayOccupancy } from "@/lib/plan";
import { requirePageSession } from "@/lib/session";

export default async function PlanStayPage() {
  const session = await requirePageSession({ need: "canSeeStay" });
  const data = await loadPlanStayPage();
  const occupancy = summarizeStayOccupancy(data.slots);
  const subtitle =
    occupancy.total === 0
      ? "Beds are not laid out yet."
      : occupancy.open === 0
        ? `All ${occupancy.total} beds assigned.`
        : `${occupancy.assigned} of ${occupancy.total} beds assigned.`;

  return (
    <>
      <PlanChapterHeader title="Stay" subtitle={subtitle} />
      <StayBoard slots={data.slots} notes={data.notes} />
    </>
  );
}
