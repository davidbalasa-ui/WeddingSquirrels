import Link from "next/link";
import { PersonAvatar } from "@/components/PersonAvatar";
import type { DirectoryEntry } from "@/lib/people-directory";

export function PeopleGroupList({
  title,
  subtitle,
  entries,
}: {
  title: string;
  subtitle: string;
  entries: DirectoryEntry[];
}) {
  return (
    <>
      <p className="mb-4 text-sm text-muted">{subtitle}</p>
      {entries.length === 0 ? (
        <div className="card p-5 text-sm text-muted">No one is listed here yet.</div>
      ) : (
        <div className="divide-y divide-[var(--line)] border-y border-line">
          {entries.map((entry) => (
            <Link
              key={entry.profileId}
              href={`/people/${encodeURIComponent(entry.profileId)}`}
              className="flex min-h-[4.75rem] items-center gap-3 py-3 transition-colors hover:bg-[var(--accent-soft)]/30"
            >
              <PersonAvatar name={entry.name} photoSrc={entry.photoSrc} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block font-[family-name:var(--font-display)] text-lg leading-tight">
                  {entry.name}
                </span>
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
      <p className="mt-4 text-xs text-muted">{title}</p>
    </>
  );
}
