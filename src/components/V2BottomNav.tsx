"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { UNREAD_ASKS_EVENT } from "@/components/AskNotifier";
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
  const fixture = params.get("fixture");
  const tabs = NAV_TABS.filter((item) => canSeeNavTab(session, item.tab));

  // The server count is the baseline; AskNotifier keeps it live between navigations.
  const [liveUnread, setLiveUnread] = useState<number | null>(null);
  const [baseline, setBaseline] = useState(unreadRequests);
  if (unreadRequests !== baseline) {
    setBaseline(unreadRequests);
    setLiveUnread(null);
  }
  useEffect(() => {
    const onUnread = (event: Event) => {
      const detail = (event as CustomEvent<{ count: number }>).detail;
      if (detail && typeof detail.count === "number") setLiveUnread(detail.count);
    };
    window.addEventListener(UNREAD_ASKS_EVENT, onUnread);
    return () => window.removeEventListener(UNREAD_ASKS_EVENT, onUnread);
  }, []);
  const unread = liveUnread ?? unreadRequests;

  return (
    <nav className="nav-bar" aria-label="Primary">
      {tabs.map((item) => {
        const active = isNavTabActive(pathname, item.tab);
        const showBadge = item.tab === "today" && unread > 0;
        return (
          <Link
            key={item.tab}
            href={appendPreviewAsOf(item.href, asOf, fixture)}
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
                  aria-label={`${unread} unread messages`}
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
