import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ContactsPanel } from "@/components/ContactsPanel";
import { GuestList } from "@/components/GuestList";
import { GuestRsvpReport } from "@/components/GuestRsvpReport";
import { GuestRsvpSync } from "@/components/GuestRsvpSync";
import { PeopleHubFilters } from "@/components/PeopleHubFilters";
import { PeopleTabFooterLink } from "@/components/PeopleHubTabs";
import { VendorEntryList } from "@/components/VendorEntryList";
import { V2PageHeader } from "@/components/V2PageHeader";
import { moneyEditable, timelineEditable } from "@/lib/access";
import { parsePeopleSort, parsePeopleTab, type PeopleTab } from "@/lib/people-directory";
import { loadPeopleHubData } from "@/lib/people-hub";
import { requirePageSession } from "@/lib/session";

function defaultFilter(session: {
  canSeeGuests: boolean;
  canSeeTimeline: boolean;
}): PeopleTab {
  if (session.canSeeGuests) return "guests";
  if (session.canSeeTimeline) return "day-of";
  return "vendors";
}

export default async function PeopleHubPage({
  searchParams,
}: {
  searchParams: Promise<{ who?: string; done?: string; tab?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  if (sp.who || sp.done) {
    const next = new URLSearchParams();
    if (sp.who) next.set("who", sp.who);
    if (sp.done) next.set("done", sp.done);
    redirect(`/today?${next.toString()}`);
  }

  const session = await requirePageSession();
  const filter = parsePeopleTab(sp.tab) ?? defaultFilter(session);
  const sort = parsePeopleSort(sp.sort) ?? "name";
  const data = await loadPeopleHubData(session);
  const canEditGuests = session.canSeeGuests;
  const canEditDayOf = timelineEditable(session);
  const canEditMoney = moneyEditable(session);
  const showSort = filter === "guests" || filter === "vendors" || filter === "all";

  return (
    <>
      <V2PageHeader
        session={session}
        title="People"
        subtitle="One master list — filter and sort guests, vendors, and day-of contacts"
      />

      <Suspense fallback={null}>
        <PeopleHubFilters
          activeFilter={filter}
          activeSort={sort}
          counts={data.tabCounts}
          showSort={showSort}
        />
      </Suspense>

      {session.isMaster && session.canSeeGuests ? <GuestRsvpSync /> : null}

      {filter === "all" || filter === "guests" ? (
        session.canSeeGuests ? (
          <div className="flex flex-col gap-3">
            {filter === "all" ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Guests</p>
            ) : null}
            <GuestRsvpReport report={data.guestReport} />
            <GuestList guests={data.guests} canEdit={canEditGuests} sort={sort} />
          </div>
        ) : filter === "guests" ? (
          <div className="card px-3 py-4 text-sm text-muted">Guest list isn’t visible for this PIN.</div>
        ) : null
      ) : null}

      {filter === "all" || filter === "vendors" ? (
        <div className={filter === "all" ? "mt-4 flex flex-col gap-3" : ""}>
          {filter === "all" ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Vendors</p>
          ) : null}
          <VendorEntryList
            entries={data.vendorEntries}
            vendorBudgets={data.vendorBudgets}
            canEditMoney={canEditMoney}
            sort={sort}
            emptyLabel="No vendors yet"
            searchPlaceholder="Search vendors"
          />
        </div>
      ) : null}

      {filter === "all" || filter === "day-of" ? (
        session.canSeeTimeline ? (
          <div className={filter === "all" ? "mt-4 flex flex-col gap-3" : ""}>
            {filter === "all" ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                Day-of contacts
              </p>
            ) : null}
            {filter === "day-of" ? (
              <p className="text-sm text-muted">
                People to call on the big day — add a photo, phone number, and email for each contact.
              </p>
            ) : null}
            <ContactsPanel contacts={data.dayOfContacts} canEdit={canEditDayOf} dayOfMode />
            {filter === "day-of" && canEditDayOf ? (
              <PeopleTabFooterLink
                href="/people/responsibilities"
                label="Day-of responsibilities"
                detail="Who is handling what on the big day"
              />
            ) : null}
          </div>
        ) : filter === "day-of" ? (
          <div className="card px-3 py-4 text-sm text-muted">Day-of contacts aren’t visible for this PIN.</div>
        ) : null
      ) : null}
    </>
  );
}
