import { Suspense } from "react";
import { AddTaskButton } from "@/components/AddTaskButton";
import { AppHeader } from "@/components/AppHeader";
import { ShowDoneToggle } from "@/components/ShowDoneToggle";
import { TaskCard } from "@/components/TaskCard";
import { prisma } from "@/lib/db";
import { listTasks } from "@/lib/tasks";
import { requirePageSession } from "@/lib/session";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string }>;
}) {
  const session = await requirePageSession({ need: "canSeeTasks" });
  const sp = await searchParams;
  const showDone = sp.done === "1";
  const tasks = await listTasks(session, { showDone });

  let people = await prisma.person.findMany({ orderBy: { sortOrder: "asc" } });
  if (session.assigneeFilter?.length) {
    people = people.filter((p) => session.assigneeFilter!.includes(p.id));
  }

  const openCount = tasks.filter((t) => t.status !== "done").length;

  return (
    <>
      <AppHeader
        session={session}
        title="Today"
        subtitle={
          session.assigneeFilter?.length
            ? "Your assigned to-dos"
            : `${openCount} open · ranked by urgency`
        }
      />

      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted">Tap a card to decide, note, budget, and finish</p>
        <Suspense>
          <ShowDoneToggle />
        </Suspense>
      </div>

      <div className="mb-3">
        <AddTaskButton people={people} />
      </div>

      <div className="flex flex-col gap-3">
        {tasks.length === 0 ? (
          <div className="card p-6 text-center text-sm text-muted">
            {showDone ? "No tasks yet." : "Nothing open yet — add a new task above."}
          </div>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </>
  );
}
