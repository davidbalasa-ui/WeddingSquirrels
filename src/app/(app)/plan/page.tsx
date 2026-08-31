import Link from "next/link";
import { ModuleIcon } from "@/components/ModuleIcon";
import { V2PageHeader } from "@/components/V2PageHeader";
import { modulesForNavTab } from "@/lib/modules";
import { requirePageSession } from "@/lib/session";

export default async function PlanHubPage() {
  const session = await requirePageSession();
  const links = modulesForNavTab(session, "plan");

  return (
    <>
      <V2PageHeader session={session} title="Plan" subtitle="Tasks, timeline, stay, and more" />
      {links.length === 0 ? (
        <div className="card p-5 text-sm text-muted">No planning modules are enabled for this PIN.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {links.map((item) => (
            <Link
              key={item.key}
              href={item.href!}
              className="card flex items-center gap-3 p-4 transition-colors hover:bg-[var(--accent-soft)]/40"
            >
              <ModuleIcon name={item.icon} className="h-6 w-6 shrink-0 text-[var(--accent)]" />
              <span className="flex-1 font-semibold">{item.label}</span>
              <span className="text-sm text-muted" aria-hidden>
                ›
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
