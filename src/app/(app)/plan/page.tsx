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
