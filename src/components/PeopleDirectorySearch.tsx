"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PersonAvatar } from "@/components/PersonAvatar";
import { filterDirectoryEntries, type DirectoryEntry } from "@/lib/people-directory";

export function PeopleDirectorySearch({ entries }: { entries: DirectoryEntry[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => filterDirectoryEntries(entries, query), [entries, query]);

  return (
    <section>
      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
        Directory
      </label>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search people and vendors"
        className="mb-3 w-full rounded-xl border border-line bg-[var(--card)] px-4 py-3 text-sm outline-none ring-[var(--accent)] focus:ring-2"
        aria-label="Search people and vendors"
      />
      {filtered.length === 0 ? (
        <div className="card p-5 text-sm text-muted">No matches for that search.</div>
      ) : (
        <div className="divide-y divide-[var(--line)] border-y border-line">
          {filtered.map((entry) => (
            <Link
              key={entry.profileId}
              href={`/people/${encodeURIComponent(entry.profileId)}`}
              className="flex min-h-[4.5rem] items-center gap-3 py-3 transition-colors hover:bg-[var(--accent-soft)]/30"
            >
              <PersonAvatar name={entry.name} photoSrc={entry.photoSrc} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold leading-tight">{entry.name}</span>
                <span className="mt-0.5 block truncate text-sm text-muted">
                  {entry.subtitle ?? entry.roles.join(" · ")}
                </span>
              </span>
              <span className="text-lg text-muted" aria-hidden>
                ›
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
