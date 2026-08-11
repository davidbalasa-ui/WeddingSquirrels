"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionAccount } from "@/lib/types";

const items = [
  { href: "/today", label: "Today", need: "canSeeTasks" as const },
  { href: "/people", label: "People", need: "canSeePeople" as const },
  { href: "/calendar", label: "Cal", need: "canSeeCalendar" as const },
  { href: "/shop", label: "Shop", need: "canSeeShop" as const },
  { href: "/requests", label: "Ask", need: "canSeeRequests" as const },
  { href: "/money", label: "Money", need: "canSeeBudget" as const },
  { href: "/day", label: "Day-of", need: "canSeeTimeline" as const },
  { href: "/guests", label: "Guests", need: "canSeeGuests" as const },
  { href: "/accounts", label: "Accounts", need: "canManageAccounts" as const },
];

export function BottomNav({
  session,
  unreadRequests = 0,
}: {
  session: SessionAccount;
  unreadRequests?: number;
}) {
  const pathname = usePathname();
  const visible = items.filter(
    (item) => session[item.need] || (item.need === "canManageAccounts" && session.isMaster),
  );

  return (
    <nav className="nav-bar" aria-label="Main">
      {visible.map((item) => {
        const showBadge = item.href === "/requests" && unreadRequests > 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="nav-link"
            data-active={pathname.startsWith(item.href)}
            aria-label={
              showBadge
                ? `${item.label}, ${unreadRequests} unread`
                : item.label
            }
          >
            <span className="nav-link-label">
              <span>{item.label}</span>
              {showBadge ? (
                <span className="nav-badge" aria-hidden>
                  {unreadRequests > 99 ? "99+" : unreadRequests}
                </span>
              ) : null}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
