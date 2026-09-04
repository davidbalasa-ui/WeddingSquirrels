"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PersonAvatar } from "@/components/PersonAvatar";
import {
  peopleSearchEmptyLabel,
  presentDirectoryRow,
  searchDirectoryEntries,
} from "@/lib/people-experience";
import type { DirectoryEntry, PeopleTab } from "@/lib/people-directory";

export function PeopleEntryList({
  entries,
  emptyLabel,
  searchPlaceholder,
  tab = "all",
}: {
  entries: DirectoryEntry[];
  emptyLabel: string;
  searchPlaceholder: string;
  tab?: PeopleTab;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => searchDirectoryEntries(entries, query), [entries, query]);

  return (
    <section>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={searchPlaceholder}
        className="mb-4 min-h-12 w-full rounded-2xl border border-line bg-[var(--bg-elevated)] px-4 text-base outline-none ring-[var(--accent)] focus:ring-2"
        aria-label="Search people"
      />

      {filtered.length === 0 ? (
        <p className="py-6 text-base text-muted">{query ? peopleSearchEmptyLabel(tab) : emptyLabel}</p>
      ) : (
        <div className="divide-y divide-[var(--line)] border-b border-t border-[var(--line)]">
          {filtered.map((entry) => {
            const row = presentDirectoryRow(entry);
            return (
              <Link
                key={entry.profileId}
                href={`/people/${encodeURIComponent(entry.profileId)}`}
                className="flex min-h-[4.25rem] items-center gap-3 py-3.5 transition-colors hover:bg-[var(--accent-soft)]/25"
              >
                <PersonAvatar name={row.name} photoSrc={row.photoSrc} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[1.05rem] font-semibold leading-snug">{row.name}</span>
                  {row.roleContext ? (
                    <span className="mt-0.5 block truncate text-sm text-muted">{row.roleContext}</span>
                  ) : null}
                  {row.secondary ? (
                    <span className="mt-0.5 block truncate text-sm text-[var(--accent)]">{row.secondary}</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-lg text-muted" aria-hidden>
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
