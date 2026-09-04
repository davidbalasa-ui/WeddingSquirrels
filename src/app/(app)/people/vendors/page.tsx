import Link from "next/link";
import { PeopleEntryList } from "@/components/PeopleEntryList";
import { peopleHubEmptyLabel } from "@/lib/people-experience";
import { loadPeopleHubData } from "@/lib/people-hub";
import { requirePageSession } from "@/lib/session";

export default async function PeopleVendorsPage() {
  const session = await requirePageSession();
  const data = await loadPeopleHubData(session);

  return (
    <>
      <header className="mb-6 pt-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">People</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-[2.15rem] leading-[1.05] tracking-tight">
          Vendors
        </h1>
      </header>
      <PeopleEntryList
        entries={data.vendorEntries}
        emptyLabel={peopleHubEmptyLabel("vendors")}
        searchPlaceholder="Search vendors"
        tab="vendors"
      />
      <div className="mt-6">
        <Link href="/people" className="text-sm font-semibold text-[var(--accent)]">
          ← Back to People
        </Link>
      </div>
    </>
  );
}
