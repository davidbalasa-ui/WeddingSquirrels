"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PersonAvatar } from "@/components/PersonAvatar";
import {
  filterDirectoryByKind,
  filterDirectoryEntries,
  type DirectoryEntry,
  type PeopleFilter,
} from "@/lib/people-directory";

const FILTER_CHIPS: { key: PeopleFilter; label: string }[] = [
  { key: "all", label: "Everyone" },
  { key: "day-of", label: "Day-of contacts" },
  { key: "guests", label: "Guest list" },
  { key: "vendors", label: "Vendors" },
];

export function PeopleDirectorySearch({ entries }: { entries: DirectoryEntry[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PeopleFilter>("all");

  const filtered = useMemo(() => {
    const byFilter = filterDirectoryByKind(entries, filter);
    return filterDirectoryEntries(byFilter, query);
  }, [entries, filter, query]);

  return (
    <section>
      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
        Directory
      </label>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {FILTER_CHIPS.map((chip) => {
          const active = filter === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              className="filter-pill shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold"
              style={{
                borderColor: active ? "var(--accent)" : "var(--line)",
                background: active ? "var(--accent-soft)" : "transparent",
                color: active ? "var(--accent)" : "var(--muted)",
              }}
              onClick={() => setFilter(chip.key)}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search people"
        className="mb-3 w-full rounded-xl border border-line bg-[var(--card)] px-3 py-2.5 text-sm outline-none ring-[var(--accent)] focus:ring-2"
        aria-label="Search people"
      />

      {filtered.length === 0 ? (
        <div className="card px-3 py-4 text-sm text-muted">No matches for this filter.</div>
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
