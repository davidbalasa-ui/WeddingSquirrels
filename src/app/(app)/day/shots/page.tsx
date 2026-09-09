import { OperationalViewsNav } from "@/components/OperationalViewsNav";
import { PlanChapterHeader } from "@/components/PlanChapterHeader";
import { PlaybookList } from "@/components/PlaybookList";
import { loadPlaybookItems } from "@/lib/playbook-data";
import { requirePageSession } from "@/lib/session";

export default async function ShotListPage() {
  await requirePageSession({ need: "canSeeTimeline" });
  const items = await loadPlaybookItems("shot");

  return (
    <>
      <PlanChapterHeader
        title="Photo Shot List"
        subtitle="A photographer checklist. Nothing here is marked done unless someone actually completed it — these shots are still open."
        backHref="/day"
        backLabel="Day-of"
      />
      <OperationalViewsNav current="/day/shots" />
      <PlaybookList
        items={items}
        empty="No shot list recorded yet."
        showCompleted
      />
    </>
  );
}
