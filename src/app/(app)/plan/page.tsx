import { PlanDomainList } from "@/components/PlanDomainList";
import { PlanHero } from "@/components/PlanHero";
import { loadPlanPageData } from "@/lib/plan";
import { requirePageSession } from "@/lib/session";

export default async function PlanHubPage() {
  const session = await requirePageSession();
  const data = await loadPlanPageData(session);

  return (
    <>
      <PlanHero session={session} />
      <PlanDomainList rows={data.rows} />
    </>
  );
}
