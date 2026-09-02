"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PeopleSort, PeopleTab } from "@/lib/people-directory";

const FILTERS: { key: PeopleTab; label: string }[] = [
  { key: "all", label: "Everyone" },
  { key: "guests", label: "Guests" },
  { key: "vendors", label: "Vendors" },
  { key: "day-of", label: "Day-of" },
];

const SORTS: { key: PeopleSort; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "role", label: "Role" },
  { key: "rsvp", label: "Reply" },
  { key: "table", label: "Table" },
];

export function PeopleHubFilters({
  activeFilter,
  activeSort,
  counts,
  showSort,
}: {
  activeFilter: PeopleTab;
  activeSort: PeopleSort;
  counts: Record<PeopleTab, number>;
  showSort: boolean;
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
    <div className="mb-4 flex flex-col gap-2">
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

      {showSort ? (
        <label className="flex items-center gap-2 text-sm">
          <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
            Sort
          </span>
          <select
            className="min-w-0 flex-1 rounded-xl border border-line bg-[var(--card)] px-3 py-2 text-sm outline-none ring-[var(--accent)] focus:ring-2"
            value={activeSort}
            onChange={(event) => pushParams({ sort: event.target.value })}
          >
            {SORTS.map((sort) => (
              <option key={sort.key} value={sort.key}>
                {sort.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
