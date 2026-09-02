"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PersonAvatar } from "@/components/PersonAvatar";
import {
  filterDirectoryByList,
  filterDirectoryEntries,
  type DirectoryEntry,
  type PeopleList,
} from "@/lib/people-directory";

const LIST_TABS: { key: PeopleList; label: string }[] = [
  { key: "guests", label: "Guest list" },
  { key: "day-of", label: "Day-of contacts" },
  { key: "vendors", label: "Vendors" },
];

export function PeopleDirectorySearch({ entries }: { entries: DirectoryEntry[] }) {
  const [query, setQuery] = useState("");
  const [list, setList] = useState<PeopleList>("guests");

  const filtered = useMemo(() => {
    const byList = filterDirectoryByList(entries, list);
    return filterDirectoryEntries(byList, query);
  }, [entries, list, query]);

  const tabCounts = useMemo(() => {
    const counts: Record<PeopleList, number> = { guests: 0, "day-of": 0, vendors: 0 };
    for (const entry of entries) {
      counts[entry.list] += 1;
    }
    return counts;
  }, [entries]);

  return (
    <section>
      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
        People lists
      </label>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {LIST_TABS.map((tab) => {
          const active = list === tab.key;
          const count = tabCounts[tab.key];
          return (
            <button
              key={tab.key}
              type="button"
              className="filter-pill shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold"
              style={{
                borderColor: active ? "var(--accent)" : "var(--line)",
                background: active ? "var(--accent-soft)" : "transparent",
                color: active ? "var(--accent)" : "var(--muted)",
              }}
              onClick={() => setList(tab.key)}
            >
              {tab.label}
              <span className="ml-1.5 text-xs opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={`Search ${LIST_TABS.find((tab) => tab.key === list)?.label.toLowerCase() ?? "people"}`}
        className="mb-3 w-full rounded-xl border border-line bg-[var(--card)] px-3 py-2.5 text-sm outline-none ring-[var(--accent)] focus:ring-2"
        aria-label="Search people"
      />

      {filtered.length === 0 ? (
        <div className="card px-3 py-4 text-sm text-muted">
          No one on this list yet{query ? " matching your search" : ""}.
        </div>
      ) : (
        <div className="card divide-y divide-[var(--line)] overflow-hidden">
          {filtered.map((entry) => (
            <Link
              key={entry.profileId}
              href={`/people/${encodeURIComponent(entry.profileId)}`}
              className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-[var(--accent-soft)]/30"
            >
              <PersonAvatar name={entry.name} photoSrc={entry.photoSrc} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-snug">{entry.name}</span>
                <span className="mt-0.5 block truncate text-xs text-muted">
                  {entry.subtitle ?? entry.roles.join(" · ")}
                </span>
              </span>
              <span className="shrink-0 text-sm text-muted" aria-hidden>
                ›
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
