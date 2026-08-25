"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ModuleIcon } from "@/components/ModuleIcon";
import { MoreSheet } from "@/components/MoreSheet";
import { moreGroups, primaryModules } from "@/lib/modules";
import type { SessionAccount } from "@/lib/types";

export function BottomNav({
  session,
  unreadRequests = 0,
}: {
  session: SessionAccount;
  unreadRequests?: number;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const primaries = primaryModules(session);
  const more = moreGroups(session);
  const activeMore = more.some((group) =>
    group.items.some((item) => pathname.startsWith(item.href!)),
  );

  return (
    <>
      <nav className="nav-bar" aria-label="Main">
        {primaries.map((item) => {
          const active = pathname.startsWith(item.href!);
          const showBadge = item.badge === "unread" && unreadRequests > 0;
          return (
            <Link
              key={item.key}
              href={item.href!}
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
        {more.length > 0 ? (
          <button
            type="button"
            className="nav-link"
            data-active={activeMore}
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
          >
            <ModuleIcon name="more" className="nav-icon" />
            <span>More</span>
          </button>
        ) : null}
      </nav>
      {moreOpen ? <MoreSheet session={session} onClose={() => setMoreOpen(false)} /> : null}
    </>
  );
}
