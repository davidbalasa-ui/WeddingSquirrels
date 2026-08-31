import { startOfMonth } from "date-fns";
import Link from "next/link";
import { CalendarMonth } from "@/components/CalendarMonth";
import { V2PageHeader } from "@/components/V2PageHeader";
import { prisma } from "@/lib/db";
import { requirePageSession } from "@/lib/session";
import { taskVisibilityWhere } from "@/lib/tasks";

export default async function PlanCalendarPage() {
  const session = await requirePageSession({ need: "canSeeCalendar" });

  const [events, tasks] = await Promise.all([
    prisma.calendarEvent.findMany({ orderBy: { startDate: "asc" } }),
    session.canSeeTasks
      ? prisma.task.findMany({
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
        })
      : Promise.resolve([]),
  ]);

  const calTasks = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    dueDate: task.dueDate!.toISOString(),
    status: task.status,
    orgKey: task.orgKey,
    href: `/work/${task.id}`,
  }));

  const calEvents = events.map((event) => ({
    id: event.id,
    title: event.title,
    notes: event.notes,
    startDate: event.startDate.toISOString(),
    endDate: event.endDate.toISOString(),
    color: event.color,
    eventKey: event.eventKey,
  }));

  return (
    <>
      <V2PageHeader
        session={session}
        title="Calendar"
        subtitle="Events, due dates, and wedding-week plans"
      />
      <Link
        href="/plan"
        className="mb-3 inline-block text-sm font-semibold text-[var(--accent)]"
      >
        ‹ Plan
      </Link>
      <CalendarMonth
        tasks={calTasks}
        events={calEvents}
        initialMonth={startOfMonth(new Date()).toISOString()}
      />
    </>
  );
}
