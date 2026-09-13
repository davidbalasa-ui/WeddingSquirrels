import { OperationalViewsNav } from "@/components/OperationalViewsNav";
import { PlanChapterHeader } from "@/components/PlanChapterHeader";
import { PlaybookBoard } from "@/components/PlaybookBoard";
import { loadPlaybookItems } from "@/lib/playbook-data";
import { timelineEditable } from "@/lib/access";
import { requirePageSession } from "@/lib/session";

export default async function ShotListPage() {
  const session = await requirePageSession({ need: "canSeeTimeline" });
  const items = await loadPlaybookItems("shot");
  const canEdit = timelineEditable(session);

  return (
    <>
      <PlanChapterHeader
        title="Photo Shot List"
        subtitle="A photographer checklist. Nothing here is marked done unless someone actually completed it — these shots are still open."
        backHref="/day"
        backLabel="Day-of"
      />
      <OperationalViewsNav current="/day/shots" />
      <PlaybookBoard
        items={items}
        empty="No shot list recorded yet."
        showCompleted
        canEdit={canEdit}
      />
    </>
  );
}
