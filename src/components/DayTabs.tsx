"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function DayTabs({ showNowTab: _showNowTab = false }: { showNowTab?: boolean }) {
  const pathname = usePathname();

  const tabs = [
    { href: "/day", label: "Day" },
    { href: "/day/mc", label: "MC" },
    { href: "/day/contacts", label: "Contacts" },
    { href: "/day/assignments", label: "Assignments" },
  ];

  return (
    <nav aria-label="Day-of pages" className="mb-4 flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active =
          tab.href === "/day"
            ? pathname === "/day" || pathname === "/day/now"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="filter-pill rounded-full border px-3.5 py-2 text-sm font-semibold"
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
