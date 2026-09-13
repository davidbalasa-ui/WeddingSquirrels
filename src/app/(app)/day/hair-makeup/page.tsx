import { OperationalViewsNav } from "@/components/OperationalViewsNav";
import { PlanChapterHeader } from "@/components/PlanChapterHeader";
import { PlaybookBoard } from "@/components/PlaybookBoard";
import { loadPlaybookItems } from "@/lib/playbook-data";
import { timelineEditable } from "@/lib/access";
import { requirePageSession } from "@/lib/session";

export default async function HairMakeupPage() {
  const session = await requirePageSession({ need: "canSeeTimeline" });
  const items = await loadPlaybookItems("hair_makeup");
  const canEdit = timelineEditable(session);

  return (
    <>
      <PlanChapterHeader
        title="Hair & Makeup"
        subtitle="Who is in which room, and when. Katie does Haley's hair. The bridal party uses assigned bathrooms and bedrooms at the Airbnb."
        backHref="/day"
        backLabel="Day-of"
      />
      <OperationalViewsNav current="/day/hair-makeup" />
      <PlaybookBoard
        items={items}
        empty="Hair and makeup stations have not been recorded yet."
        canEdit={canEdit}
      />
    </>
  );
}
