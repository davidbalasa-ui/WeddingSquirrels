import { PeopleEntryList } from "@/components/PeopleEntryList";
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
      <p className="mb-4 text-base text-muted">{subtitle}</p>
      <PeopleEntryList
        entries={entries}
        emptyLabel="No one is listed here yet."
        searchPlaceholder="Search people"
      />
      <p className="mt-4 text-sm text-muted">{title}</p>
    </>
  );
}
