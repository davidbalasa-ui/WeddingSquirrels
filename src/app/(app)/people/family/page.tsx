import Link from "next/link";
import { PeopleGroupList } from "@/components/PeopleGroupList";
import { V2PageHeader } from "@/components/V2PageHeader";
import { groupDirectoryEntries } from "@/lib/people-directory";
import { loadPeopleHubData } from "@/lib/people-hub";
import { requirePageSession } from "@/lib/session";

export default async function PeopleFamilyPage() {
  const session = await requirePageSession();
  const data = await loadPeopleHubData(session);
  const entries = groupDirectoryEntries(data.entries, "family");

  return (
    <>
      <V2PageHeader
        session={session}
        title="Family & guests"
        subtitle="Parents, siblings, and invited guests"
      />
      <PeopleGroupList
        title="The people traveling, staying, and celebrating with you."
        subtitle="Parents, siblings, and invited guests"
        entries={entries}
      />
      <div className="mt-6">
        <Link href="/people" className="text-sm font-semibold text-[var(--accent)]">
          ← Back to People
        </Link>
      </div>
    </>
  );
}
