"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/day", label: "Timeline" },
  { href: "/day/contacts", label: "Contacts" },
  { href: "/day/assignments", label: "Assignments" },
];

export function DayTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active =
          tab.href === "/day" ? pathname === "/day" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="filter-pill rounded-full border px-3.5 py-2 text-sm font-semibold"
            data-active={active}
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
    </div>
  );
}
