"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionAccount } from "@/lib/types";

const items = [
  { href: "/today", label: "Today", key: "tasks", need: "canSeeTasks" as const },
  { href: "/people", label: "People", key: "people", need: "canSeeTasks" as const },
  { href: "/money", label: "Money", key: "money", need: "canSeeBudget" as const },
  { href: "/day", label: "Day-of", key: "day", need: "canSeeTimeline" as const },
  { href: "/guests", label: "Guests", key: "guests", need: "canSeeGuests" as const },
  { href: "/accounts", label: "Accounts", key: "accounts", need: "canManageAccounts" as const },
];

export function BottomNav({ session }: { session: SessionAccount }) {
  const pathname = usePathname();
  const visible = items.filter((item) => session[item.need] || (item.need === "canManageAccounts" && session.isMaster));

  return (
    <nav className="nav-bar" aria-label="Main">
      {visible.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="nav-link"
          data-active={pathname.startsWith(item.href)}
        >
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
