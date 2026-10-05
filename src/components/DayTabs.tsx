"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** One scrollable row for every wedding-day view, so switching never needs a scroll to the bottom. */
const TABS = [
  { href: "/day", label: "Day" },
  { href: "/day/mc", label: "MC" },
  { href: "/day/contacts", label: "Contacts" },
  { href: "/day/venue", label: "Venue" },
  { href: "/day/assignments", label: "Assignments" },
  { href: "/day/hair-makeup", label: "Hair & Makeup" },
  { href: "/day/shots", label: "Shots" },
  { href: "/day/decor", label: "Decor" },
  { href: "/plan/timeline", label: "Timeline" },
];

export function DayTabs({ showNowTab: _showNowTab = false }: { showNowTab?: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Day-of pages"
      className="day-tabs -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1"
    >
      {TABS.map((tab) => {
        const active =
          tab.href === "/day"
            ? pathname === "/day" || pathname === "/day/now"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="filter-pill shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold"
            data-active={active}
            aria-current={active ? "page" : undefined}
            style={
              active
                ? {
                    borderColor: "var(--accent)",
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                  }
                : undefined
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
