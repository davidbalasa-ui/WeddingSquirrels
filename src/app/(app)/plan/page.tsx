import Link from "next/link";
import { ModuleIcon } from "@/components/ModuleIcon";
import { V2PageHeader } from "@/components/V2PageHeader";
import { loadPlanPageData } from "@/lib/plan";
import { requirePageSession } from "@/lib/session";

export default async function PlanHubPage() {
  const session = await requirePageSession();
  const data = await loadPlanPageData(session);

  return (
    <>
      <V2PageHeader
        session={session}
        title="Plan"
        subtitle={
          session.canSeeTasks
            ? `${data.openTasks} open ${data.openTasks === 1 ? "task" : "tasks"} · every part of the wedding`
            : "Every part of the wedding"
        }
      />
      {data.focus ? (
        <section className="mb-6">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Next decision
          </p>
          <Link
            href={data.focus.href}
            className={`card block p-5 transition-colors hover:bg-[var(--accent-soft)]/35 ${
              data.focus.escalated ? "ring-2 ring-[var(--warn)]" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-[family-name:var(--font-display)] text-2xl leading-tight">
                  {data.focus.title}
                </p>
                {data.focus.detail ? (
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
                    {data.focus.detail}
                  </p>
                ) : null}
                <p className="mt-3 text-xs font-semibold text-[var(--accent)]">
                  {data.focus.ownerLabel}
                  {data.focus.dueLabel ? ` · ${data.focus.dueLabel}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-lg text-muted" aria-hidden>
                ›
              </span>
            </div>
          </Link>
        </section>
      ) : session.canSeeTasks ? (
        <section className="card mb-6 p-5">
          <p className="font-[family-name:var(--font-display)] text-xl">Planning queue clear</p>
          <p className="mt-1 text-sm text-muted">No open decision cards need attention.</p>
        </section>
      ) : null}

      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
        Wedding plan
      </p>
      {data.rows.length === 0 ? (
        <div className="card p-5 text-sm text-muted">No planning modules are enabled for this PIN.</div>
      ) : (
        <div className="divide-y divide-[var(--line)] border-y border-line">
          {data.rows.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="flex min-h-[5rem] items-center gap-3 py-3 transition-colors hover:bg-[var(--accent-soft)]/30"
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  item.attention
                    ? "bg-[var(--warn-soft)] text-[var(--warn)]"
                    : "bg-[var(--accent-soft)] text-[var(--accent)]"
                }`}
              >
                <ModuleIcon name={item.icon} className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-[family-name:var(--font-display)] text-lg leading-tight">
                  {item.label}
                </span>
                <span className="mt-0.5 block truncate text-sm text-muted">{item.detail}</span>
              </span>
              <span className="text-lg text-muted" aria-hidden>
                ›
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
