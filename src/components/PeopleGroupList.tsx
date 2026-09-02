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
      <p className="mb-3 text-sm text-muted">{subtitle}</p>
      {entries.length === 0 ? (
        <div className="card px-3 py-4 text-sm text-muted">No one is listed here yet.</div>
      ) : (
        <div className="card divide-y divide-[var(--line)] overflow-hidden">
          {entries.map((entry) => (
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
      <p className="mt-3 text-xs text-muted">{title}</p>
    </>
  );
}
