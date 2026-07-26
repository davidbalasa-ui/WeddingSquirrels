import Link from "next/link";
import { Suspense } from "react";
import { AddTaskButton } from "@/components/AddTaskButton";
import { AppHeader } from "@/components/AppHeader";
import { ShowDoneToggle } from "@/components/ShowDoneToggle";
import { TaskCard } from "@/components/TaskCard";
import { prisma } from "@/lib/db";
import { listTasks } from "@/lib/tasks";
import { requirePageSession } from "@/lib/session";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ who?: string; done?: string }>;
}) {
  const session = await requirePageSession({ need: "canSeeTasks" });
  const sp = await searchParams;
  const showDone = sp.done === "1";

  let people = await prisma.person.findMany({ orderBy: { sortOrder: "asc" } });
  if (session.assigneeFilter?.length) {
    people = people.filter((p) => session.assigneeFilter!.includes(p.id));
  }

  const who = sp.who || people[0]?.id || "david";
  const tasks = await listTasks(session, { showDone, personId: who });

  return (
    <>
      <AppHeader session={session} title="By person" subtitle="Who needs to do what" />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {people.map((person) => {
          const active = who === person.id;
          return (
            <Link
              key={person.id}
              href={`/people?who=${person.id}${showDone ? "&done=1" : ""}`}
              className="shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold"
              style={{
                borderColor: active ? "var(--accent)" : "var(--line)",
                background: active ? "var(--accent-soft)" : "var(--bg-elevated)",
                color: active ? "var(--accent)" : "var(--muted)",
              }}
            >
              {person.name}
            </Link>
          );
        })}
      </div>

      <div className="mb-3 flex justify-end">
        <Suspense>
          <ShowDoneToggle />
        </Suspense>
      </div>

      <div className="mb-3">
        <AddTaskButton people={people} />
      </div>

      <div className="flex flex-col gap-3">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
        {tasks.length === 0 ? (
          <div className="card p-6 text-center text-sm text-muted">No tasks for this person.</div>
        ) : null}
      </div>
    </>
  );
}
