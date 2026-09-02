"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PersonAvatar } from "@/components/PersonAvatar";
import {
  filterDirectoryEntries,
  sourceListLabel,
  type DirectoryEntry,
} from "@/lib/people-directory";

export function PeopleEntryList({
  entries,
  emptyLabel,
  searchPlaceholder,
}: {
  entries: DirectoryEntry[];
  emptyLabel: string;
  searchPlaceholder: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => filterDirectoryEntries(entries, query), [entries, query]);

  return (
    <section>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={searchPlaceholder}
        className="mb-3 w-full rounded-xl border border-line bg-[var(--card)] px-3 py-2.5 text-sm outline-none ring-[var(--accent)] focus:ring-2"
        aria-label="Search people"
      />

      {filtered.length === 0 ? (
        <div className="card px-3 py-4 text-sm text-muted">
          {emptyLabel}
          {query ? " matching your search" : ""}.
        </div>
      ) : (
        <div className="card divide-y divide-[var(--line)] overflow-hidden">
          {filtered.map((entry) => {
            const source = sourceListLabel(entry.primaryList);
            const contactLine = [entry.phone, entry.email].filter(Boolean).join(" · ");
            const details = [
              source,
              entry.subtitle && entry.subtitle !== entry.name ? entry.subtitle : null,
              contactLine || null,
              entry.address,
              entry.rsvpLabel ? `RSVP · ${entry.rsvpLabel}` : null,
              entry.tableLabel,
            ].filter((line, index, lines): line is string => Boolean(line) && lines.indexOf(line) === index);

            return (
              <Link
                key={entry.profileId}
                href={`/people/${encodeURIComponent(entry.profileId)}`}
                className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-[var(--accent-soft)]/30"
              >
                <PersonAvatar name={entry.name} photoSrc={entry.photoSrc} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-snug">{entry.name}</span>
                  {details.map((line) => (
                    <span key={line} className="mt-0.5 block truncate text-xs text-muted">
                      {line}
                    </span>
                  ))}
                </span>
                <span className="shrink-0 text-sm text-muted" aria-hidden>
                  ›
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
