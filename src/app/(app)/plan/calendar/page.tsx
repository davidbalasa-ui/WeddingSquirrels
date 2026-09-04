import { CalendarMonth } from "@/components/CalendarMonth";
import { PlanChapterHeader } from "@/components/PlanChapterHeader";
import { upcomingCalendarEvents } from "@/lib/plan";
import { loadPlanCalendarPage } from "@/lib/plan-pages";
import { requirePageSession } from "@/lib/session";

export default async function PlanCalendarPage() {
  await requirePageSession({ need: "canSeeCalendar" });
  const data = await loadPlanCalendarPage();
  const now = new Date();
  const upcoming = upcomingCalendarEvents(
    data.events.map((event) => ({
      id: event.id,
      title: event.title,
      startDate: new Date(event.startDate),
      endDate: new Date(event.endDate),
    })),
    now,
  );
  const subtitle =
    upcoming.length === 0
      ? "Dates that belong on the wedding calendar."
      : upcoming.length === 1
        ? "1 upcoming event."
        : `${upcoming.length} upcoming events.`;

  return (
    <>
      <PlanChapterHeader title="Calendar" subtitle={subtitle} />
      <CalendarMonth events={data.events} initialMonth={data.initialMonth} />
    </>
  );
}
