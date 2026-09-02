"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  PeopleAttendanceFilter,
  PeopleRoleFilter,
  PeopleTab,
  PeopleView,
} from "@/lib/people-directory";

const FILTERS: { key: PeopleTab; label: string }[] = [
  { key: "all", label: "Everyone" },
  { key: "guests", label: "Guests" },
  { key: "vendors", label: "Vendors" },
  { key: "day-of", label: "Day-of" },
];

const ROLES: { key: PeopleRoleFilter; label: string }[] = [
  { key: "all", label: "All roles" },
  { key: "guest", label: "Guest" },
  { key: "wedding_party", label: "Wedding" },
  { key: "family", label: "Family" },
  { key: "vendor", label: "Vendor" },
];

const ATTENDANCE: { key: PeopleAttendanceFilter; label: string }[] = [
  { key: "all", label: "All replies" },
  { key: "pending", label: "No reply" },
  { key: "attending", label: "Attending" },
  { key: "not_attending", label: "Not attending" },
];

const selectClass =
  "rounded-xl border border-line bg-[var(--card)] px-2.5 py-1.5 text-sm outline-none ring-[var(--accent)] focus:ring-2";

export function PeopleHubFilters({
  activeFilter,
  counts,
  activeRole,
  activeAttendance,
  activeView,
  showGuestFilters,
}: {
  activeFilter: PeopleTab;
  counts: Record<PeopleTab, number>;
  activeRole: PeopleRoleFilter;
  activeAttendance: PeopleAttendanceFilter;
  activeView: PeopleView;
  showGuestFilters: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function pushParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value == null) next.delete(key);
      else next.set(key, value);
    }
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((filter) => {
          const active = activeFilter === filter.key;
          const count = counts[filter.key];
          if (filter.key === "all" && count === 0) return null;
          return (
            <button
              key={filter.key}
              type="button"
              className="filter-pill shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold"
              style={{
                borderColor: active ? "var(--accent)" : "var(--line)",
                background: active ? "var(--accent-soft)" : "transparent",
                color: active ? "var(--accent)" : "var(--muted)",
              }}
              onClick={() => pushParams({ tab: filter.key })}
            >
              {filter.label}
              <span className="ml-1.5 text-xs opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {showGuestFilters ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={selectClass}
            value={activeRole}
            aria-label="Filter by role"
            onChange={(event) => {
              const value = event.target.value as PeopleRoleFilter;
              pushParams({ role: value === "all" ? null : value });
            }}
          >
            {ROLES.map((role) => (
              <option key={role.key} value={role.key}>
                {role.label}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={activeAttendance}
            aria-label="Filter by attendance"
            onChange={(event) => {
              const value = event.target.value as PeopleAttendanceFilter;
              pushParams({ rsvp: value === "all" ? null : value });
            }}
          >
            {ATTENDANCE.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${
              activeView === "table"
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                : "border-line text-muted"
            }`}
            onClick={() => pushParams({ view: activeView === "table" ? null : "table" })}
          >
            {activeView === "table" ? "List" : "Tables"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
