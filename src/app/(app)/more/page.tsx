import Link from "next/link";
import { ModuleIcon } from "@/components/ModuleIcon";
import { OfflineSetupCard } from "@/components/OfflineSetupCard";
import { V2PageHeader } from "@/components/V2PageHeader";
import { modulesForNavTab, moreGroups } from "@/lib/modules";
import { requirePageSession } from "@/lib/session";

export default async function MoreHubPage() {
  const session = await requirePageSession();
  const moreModules = modulesForNavTab(session, "more");
  const legacyGroups = moreGroups(session);

  return (
    <>
      <V2PageHeader session={session} title="More" subtitle="Settings, access, and offline" />
      <div className="flex flex-col gap-4">
        {moreModules.length > 0 ? (
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Admin</p>
            <div className="flex flex-col gap-2">
              {moreModules.map((item) => (
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
          </section>
        ) : null}

        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Offline</p>
          <OfflineSetupCard variant="panel" />
        </section>

        {legacyGroups.length > 0 ? (
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">All modules</p>
            {legacyGroups.map((group) => (
              <div key={group.group} className="mb-3">
                <p className="mb-2 text-xs font-semibold text-muted">{group.label}</p>
                <div className="flex flex-col gap-2">
                  {group.items.map((item) => (
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
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </>
  );
}
