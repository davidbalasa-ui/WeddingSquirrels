import Link from "next/link";
import { PeopleGroupList } from "@/components/PeopleGroupList";
import { V2PageHeader } from "@/components/V2PageHeader";
import { groupDirectoryEntries } from "@/lib/people-directory";
import { loadPeopleHubData } from "@/lib/people-hub";
import { requirePageSession } from "@/lib/session";

export default async function PeopleVendorsPage() {
  const session = await requirePageSession();
  const data = await loadPeopleHubData(session);
  const entries = groupDirectoryEntries(data.entries, "vendor");

  return (
    <>
      <V2PageHeader
        session={session}
        title="Vendors"
        subtitle="Planners, venue, photo, catering, and day-of pros"
      />
      <PeopleGroupList
        title="Who to call when something needs to happen."
        subtitle="Planners, venue, photo, catering, and day-of pros"
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
