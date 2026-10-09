import Link from "next/link";
import { ModuleIcon } from "@/components/ModuleIcon";
import { OfflineSetupCard } from "@/components/OfflineSetupCard";
import { V2PageHeader } from "@/components/V2PageHeader";
import { modulesForNavTab, moreGroups, NAV_TABS } from "@/lib/modules";
import { requirePageSession } from "@/lib/session";

export default async function MoreHubPage() {
  const session = await requirePageSession();
  const moreModules = modulesForNavTab(session, "more").filter((item) => item.key !== "print");
  // Everything already reachable from the bottom bar or the Admin section above stays out of this list.
  const legacyGroups = moreGroups(session)
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => item.navTab !== "more" && !NAV_TABS.some((tab) => tab.href === item.href),
      ),
    }))
    .filter((group) => group.items.length > 0);

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
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Print</p>
          <Link
            href="/print"
            className="card flex items-center gap-3 p-4 transition-colors hover:bg-[var(--accent-soft)]/40"
          >
            <ModuleIcon name="print" className="h-6 w-6 shrink-0 text-[var(--accent)]" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Wedding Binder & Print</span>
              <span className="mt-0.5 block text-sm text-muted">
                Create a binder, day-of packet, or wedding party packet from current information.
              </span>
            </span>
            <span className="text-sm text-muted" aria-hidden>
              ›
            </span>
          </Link>
        </section>

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
