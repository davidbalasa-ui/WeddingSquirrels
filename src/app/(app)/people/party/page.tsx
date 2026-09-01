import Link from "next/link";
import { PeopleGroupList } from "@/components/PeopleGroupList";
import { V2PageHeader } from "@/components/V2PageHeader";
import { groupDirectoryEntries } from "@/lib/people-directory";
import { loadPeopleHubData } from "@/lib/people-hub";
import { requirePageSession } from "@/lib/session";

export default async function PeoplePartyPage() {
  const session = await requirePageSession();
  const data = await loadPeopleHubData(session);
  const entries = groupDirectoryEntries(data.entries, "party");

  return (
    <>
      <V2PageHeader
        session={session}
        title="Wedding party"
        subtitle="Bridal party, officiant, and ceremony roles"
      />
      <PeopleGroupList
        title="Everyone standing with you on the wedding day."
        subtitle="Bridal party, officiant, and ceremony roles"
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
