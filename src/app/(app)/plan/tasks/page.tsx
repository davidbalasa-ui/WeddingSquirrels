import Link from "next/link";
import { TaskCard } from "@/components/TaskCard";
import { V2PageHeader } from "@/components/V2PageHeader";
import { listOrgCards, listTasks } from "@/lib/tasks";
import { requirePageSession } from "@/lib/session";

export default async function PlanTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string }>;
}) {
  const session = await requirePageSession({ need: "canSeeTasks" });
  const { done } = await searchParams;
  const showDone = done === "1";
  const [tasks, orgCards] = await Promise.all([
    listTasks(session, { showDone }),
    listOrgCards(session, { showDone }),
  ]);
  const visibleTasks = showDone ? tasks : tasks.filter((task) => task.status !== "done");
  const visibleOrgCards = showDone
    ? orgCards
    : orgCards.filter((task) => task.status !== "done");

  return (
    <>
      <V2PageHeader
        session={session}
        title="Tasks"
        subtitle={`${visibleTasks.length} ${showDone ? "total" : "open"} decision ${
          visibleTasks.length === 1 ? "card" : "cards"
        }`}
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/plan" className="text-sm font-semibold text-[var(--accent)]">
          ‹ Plan
        </Link>
        <Link
          href={showDone ? "/plan/tasks" : "/plan/tasks?done=1"}
          className="rounded-full border border-line px-3 py-2 text-xs font-semibold text-muted"
        >
          {showDone ? "Open only" : "Include done"}
        </Link>
      </div>

      {visibleOrgCards.length > 0 ? (
        <section className="mb-6">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Wedding week · {visibleOrgCards.length}
          </p>
          <div className="card divide-y divide-[var(--line)] overflow-hidden">
            {visibleOrgCards.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
          Decisions · {visibleTasks.length}
        </p>
        {visibleTasks.length > 0 ? (
          <div className="card divide-y divide-[var(--line)] overflow-hidden">
            {visibleTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        ) : (
          <div className="card px-3 py-4 text-sm text-muted">
            {showDone ? "No task cards yet." : "Everything is done."}
          </div>
        )}
      </section>
    </>
  );
}
