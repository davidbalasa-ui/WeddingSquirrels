"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { PeopleAttendanceFilter, PeopleTab } from "@/lib/people-directory";

const FILTERS: { key: PeopleTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "guests", label: "Guests" },
  { key: "vendors", label: "Vendors" },
  { key: "day-of", label: "Day-of" },
];

const ATTENDANCE: { key: PeopleAttendanceFilter; label: string }[] = [
  { key: "all", label: "Everyone" },
  { key: "pending", label: "No reply" },
  { key: "attending", label: "Accepted" },
  { key: "not_attending", label: "Declined" },
];

export function PeopleHubFilters({
  activeFilter,
  counts,
  activeAttendance,
  showGuestFilters,
  visibleTabs,
}: {
  activeFilter: PeopleTab;
  counts: Record<PeopleTab, number>;
  activeAttendance: PeopleAttendanceFilter;
  showGuestFilters: boolean;
  visibleTabs: PeopleTab[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function hrefFor(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value == null) next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  return (
    <div className="mb-6 flex flex-col gap-3">
      <div className="-mx-1 flex gap-1 overflow-x-auto pb-1">
        {FILTERS.filter((filter) => visibleTabs.includes(filter.key)).map((filter) => {
          const active = activeFilter === filter.key;
          return (
            <Link
              key={filter.key}
              href={hrefFor({ tab: filter.key === "all" ? null : filter.key })}
              className="min-h-11 shrink-0 px-3 py-2 text-sm font-semibold"
              style={{
                color: active ? "var(--accent)" : "var(--muted)",
                boxShadow: active ? "inset 0 -2px 0 var(--accent)" : "none",
              }}
            >
              {filter.label}
              <span className="ml-1.5 text-xs font-semibold opacity-70">{counts[filter.key]}</span>
            </Link>
          );
        })}
      </div>

      {showGuestFilters ? (
        <div className="flex flex-wrap gap-2 pb-0.5">
          {ATTENDANCE.map((option) => {
            const active = activeAttendance === option.key;
            return (
              <Link
                key={option.key}
                href={hrefFor({ rsvp: option.key === "all" ? null : option.key })}
                className="min-h-10 shrink-0 rounded-full px-3 py-1.5 text-sm"
                style={{
                  background: active ? "var(--accent-soft)" : "transparent",
                  color: active ? "var(--accent)" : "var(--muted)",
                }}
              >
                {option.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
