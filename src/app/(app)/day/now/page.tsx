import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { DayNowNext } from "@/components/DayNowNext";
import { DayTabs } from "@/components/DayTabs";
import { isWeddingDay } from "@/lib/day-of-now";
import { loadDayNowPageData, loadDayOfContext } from "@/lib/day-of-page";
import { requirePageSession } from "@/lib/session";

export default async function DayNowPage() {
  const session = await requirePageSession({ need: "canSeeTimeline" });
  const { snapshot, context, canEdit } = await loadDayNowPageData(session);

  if (!context.showNowTab) {
    redirect("/day");
  }

  return (
    <>
      <AppHeader
        session={session}
        title="Day-of"
        subtitle={
          isWeddingDay(context.daysToGo)
            ? `${context.weddingDateLabel ?? "Wedding day"} · Now / Next`
            : "Now / Next preview"
        }
      />
      <DayTabs showNowTab={context.showNowTab} />
      <DayNowNext snapshot={snapshot} canEdit={canEdit} />
    </>
  );
}
