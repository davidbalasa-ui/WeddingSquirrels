import { OperationalViewsNav } from "@/components/OperationalViewsNav";
import { PlanChapterHeader } from "@/components/PlanChapterHeader";
import { PlaybookList } from "@/components/PlaybookList";
import { loadPlaybookItems } from "@/lib/playbook-data";
import { requirePageSession } from "@/lib/session";

export default async function HairMakeupPage() {
  await requirePageSession({ need: "canSeeTimeline" });
  const items = await loadPlaybookItems("hair_makeup");

  return (
    <>
      <PlanChapterHeader
        title="Hair & Makeup"
        subtitle="Who is in which room, and when. Katie does Haley's hair. The bridal party uses assigned bathrooms and bedrooms at the Airbnb."
        backHref="/day"
        backLabel="Day-of"
      />
      <OperationalViewsNav current="/day/hair-makeup" />
      <PlaybookList items={items} empty="Hair and makeup stations have not been recorded yet." />
    </>
  );
}
