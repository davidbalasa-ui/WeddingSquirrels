"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ModuleIcon } from "@/components/ModuleIcon";
import { canSeeNavTab, isNavTabActive, NAV_TABS } from "@/lib/modules";
import { appendPreviewAsOf } from "@/lib/preview-clock";
import type { SessionAccount } from "@/lib/types";

export function V2BottomNav({
  session,
  unreadRequests = 0,
}: {
  session: SessionAccount;
  unreadRequests?: number;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const asOf = params.get("asOf");
  const tabs = NAV_TABS.filter((item) => canSeeNavTab(session, item.tab));

  return (
    <nav className="nav-bar" aria-label="Primary">
      {tabs.map((item) => {
        const active = isNavTabActive(pathname, item.tab);
        const showBadge = item.tab === "today" && unreadRequests > 0;
        return (
          <Link
            key={item.tab}
            href={appendPreviewAsOf(item.href, asOf)}
            className="nav-link"
            data-active={active}
            aria-current={active ? "page" : undefined}
          >
            <ModuleIcon name={item.icon} className="nav-icon" />
            <span className="relative inline-flex items-center gap-1">
              {item.label}
              {showBadge ? (
                <span
                  className="inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-bold leading-4 text-white"
                  aria-label={`${unreadRequests} unread requests`}
                >
                  {unreadRequests > 9 ? "9+" : unreadRequests}
                </span>
              ) : null}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
