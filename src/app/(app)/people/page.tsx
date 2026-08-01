import Link from "next/link";
import { Suspense } from "react";
import { AddTaskButton } from "@/components/AddTaskButton";
import { AppHeader } from "@/components/AppHeader";
import { ShowDoneToggle } from "@/components/ShowDoneToggle";
import { TaskCard } from "@/components/TaskCard";
import { prisma } from "@/lib/db";
import { listTasks } from "@/lib/tasks";
import { requirePageSession } from "@/lib/session";

function filterHref(who: string, showDone: boolean) {
  const params = new URLSearchParams();
  if (who !== "all") params.set("who", who);
  if (showDone) params.set("done", "1");
  const q = params.toString();
  return q ? `/people?${q}` : "/people";
}

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

  const who = sp.who || "all";
  const personId = who === "all" ? null : who;
  const tasks = await listTasks(session, { showDone, personId });
  const priorityTasks = tasks.filter((t) => t.escalatedAt);
  const regularTasks = tasks.filter((t) => !t.escalatedAt);

  const hasDavid = people.some((p) => p.id === "david");
  const hasHaley = people.some((p) => p.id === "haley");

  const orderedFilters: { id: string; label: string }[] = [{ id: "all", label: "All" }];
  const preferred = ["david", "haley"];
  for (const id of preferred) {
    const person = people.find((p) => p.id === id);
    if (person) {
      orderedFilters.push({
        id: person.id,
        label: person.id === "david" ? "David items" : "Haley items",
      });
    }
  }
  if (hasDavid && hasHaley) {
    orderedFilters.push({ id: "both", label: "Both" });
  }
  for (const person of people) {
    if (preferred.includes(person.id)) continue;
    orderedFilters.push({ id: person.id, label: person.name });
  }

  const activeLabel =
    who === "all"
      ? "everyone"
      : who === "both"
        ? "both of you"
        : who === "david"
          ? "David only"
          : who === "haley"
            ? "Haley only"
            : people.find((p) => p.id === who)?.name || who;

  return (
    <>
      <AppHeader
        session={session}
        title="By person"
        subtitle={`Showing ${activeLabel} · ${tasks.length} task${tasks.length === 1 ? "" : "s"}`}
      />

      <section className="card mb-4 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
          Filter by owner
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {orderedFilters.map((filter) => {
            const active = who === filter.id;
            return (
              <Link
                key={filter.id}
                href={filterHref(filter.id, showDone)}
                className="filter-pill shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold"
                style={{
                  borderColor: active ? "var(--accent)" : "var(--line)",
                  background: active ? "var(--accent-soft)" : "transparent",
                  color: active ? "var(--accent)" : "var(--muted)",
                }}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted">
          {who === "all"
            ? "All decision packages you can see."
            : who === "both"
              ? "Tasks assigned to both David and Haley."
              : who === "david"
                ? "Tasks assigned to David only (not shared)."
                : who === "haley"
                  ? "Tasks assigned to Haley only (not shared)."
                  : `Tasks assigned to ${activeLabel}.`}
        </p>
      </section>

      <div className="mb-3 flex justify-end">
        <Suspense>
          <ShowDoneToggle />
        </Suspense>
      </div>

      <div className="mb-3">
        <AddTaskButton people={people} />
      </div>

      <div className="flex flex-col gap-3">
        {priorityTasks.length > 0 ? (
          <section className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--warn)]">
              Priority — pinned to top
            </p>
            {priorityTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </section>
        ) : null}
        {regularTasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
        {tasks.length === 0 ? (
          <div className="card p-6 text-center text-sm text-muted">No tasks for this filter.</div>
        ) : null}
      </div>
    </>
  );
}
