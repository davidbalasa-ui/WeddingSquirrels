import { startOfMonth } from "date-fns";
import { AppHeader } from "@/components/AppHeader";
import { CalendarMonth } from "@/components/CalendarMonth";
import { prisma } from "@/lib/db";
import { taskVisibilityWhere } from "@/lib/tasks";
import { requirePageSession } from "@/lib/session";

export default async function CalendarPage() {
  const session = await requirePageSession({ need: "canSeeCalendar" });

  const [events, tasks] = await Promise.all([
    prisma.calendarEvent.findMany({ orderBy: { startDate: "asc" } }),
    prisma.task.findMany({
      where: {
        AND: [taskVisibilityWhere(session), { parentId: null }, { dueDate: { not: null } }],
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        status: true,
        orgKey: true,
      },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  const calTasks = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    dueDate: t.dueDate!.toISOString(),
    status: t.status,
    orgKey: t.orgKey,
    href: `/work/${t.id}`,
  }));

  const calEvents = events.map((e) => ({
    id: e.id,
    title: e.title,
    notes: e.notes,
    startDate: e.startDate.toISOString(),
    endDate: e.endDate.toISOString(),
    color: e.color,
    eventKey: e.eventKey,
  }));

  const initialMonth = startOfMonth(new Date()).toISOString();

  return (
    <>
      <AppHeader
        session={session}
        title="Calendar"
        subtitle="Parties, due dates, and countdown cards"
      />
      <CalendarMonth tasks={calTasks} events={calEvents} initialMonth={initialMonth} />
    </>
  );
}
