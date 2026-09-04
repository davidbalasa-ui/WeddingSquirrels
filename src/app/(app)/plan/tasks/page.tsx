import { TaskCard } from "@/components/TaskCard";
import { PlanChapterHeader } from "@/components/PlanChapterHeader";
import { PlanTaskFilters } from "@/components/PlanTaskFilters";
import {
  filterTasksForPlanView,
  parsePlanTaskView,
  summarizeVisibleTasks,
} from "@/lib/plan";
import { listOrgCards, listTasks } from "@/lib/tasks";
import { requirePageSession } from "@/lib/session";

const VIEW_COPY: Record<string, string> = {
  open: "What still needs a decision.",
  overdue: "Past due, still open.",
  soon: "Due this week.",
  mine: "Assigned to you.",
  done: "Finished decision cards.",
};

export default async function PlanTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; done?: string }>;
}) {
  const session = await requirePageSession({ need: "canSeeTasks" });
  const params = await searchParams;
  const view = params.done === "1" ? "done" : parsePlanTaskView(params.view);
  const now = new Date();
  const showDone = view === "done";

  const [tasks, orgCards] = await Promise.all([
    listTasks(session, { showDone }),
    listOrgCards(session, { showDone }),
  ]);

  const visibleTasks = filterTasksForPlanView(tasks, view, session, now);
  const visibleOrgCards =
    view === "open" || view === "done"
      ? orgCards.filter((task) => (view === "done" ? task.status === "done" : task.status !== "done"))
      : [];
  const summary = summarizeVisibleTasks(
    tasks.filter((task) => task.status !== "done"),
    now,
  );

  const subtitle =
    view === "open" && summary.open > 0
      ? summary.overdue > 0
        ? `${summary.open} open · ${summary.overdue} overdue`
        : summary.dueSoon > 0
          ? `${summary.open} open · ${summary.dueSoon} due this week`
          : `${summary.open} open`
      : VIEW_COPY[view];

  return (
    <>
      <PlanChapterHeader title="Tasks" subtitle={subtitle} />
      <PlanTaskFilters active={view} />

      {visibleOrgCards.length > 0 ? (
        <section className="mb-8">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            Wedding week
          </p>
          <div className="divide-y divide-[var(--line)] border-b border-t border-[var(--line)]">
            {visibleOrgCards.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          Decisions
        </p>
        {visibleTasks.length > 0 ? (
          <div className="divide-y divide-[var(--line)] border-b border-t border-[var(--line)]">
            {visibleTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        ) : (
          <p className="border-t border-[var(--line)] py-6 text-base text-muted">
            {view === "done"
              ? "No finished cards yet."
              : view === "overdue"
                ? "Nothing overdue."
                : view === "soon"
                  ? "Nothing due this week."
                  : view === "mine"
                    ? "Nothing assigned to you."
                    : "Everything is done."}
          </p>
        )}
      </section>
    </>
  );
}
