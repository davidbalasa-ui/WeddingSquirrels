"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function DayTabs({ showNowTab = false }: { showNowTab?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const timelineHref = showNowTab ? "/day?view=timeline" : "/day";
  const viewTimeline = searchParams.get("view") === "timeline";

  const tabs = [
    ...(showNowTab ? [{ href: "/day/now", label: "Now" }] : []),
    { href: timelineHref, label: "Timeline" },
    { href: "/day/contacts", label: "Contacts" },
    { href: "/day/assignments", label: "Assignments" },
  ];

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active =
          tab.href === "/day/now"
            ? pathname === "/day/now"
            : tab.href === timelineHref
              ? pathname === "/day" && (!showNowTab || viewTimeline)
              : pathname.startsWith(tab.href);
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
