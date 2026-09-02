import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ContactsPanel } from "@/components/ContactsPanel";
import { GuestList } from "@/components/GuestList";
import { GuestRsvpReport } from "@/components/GuestRsvpReport";
import { GuestRsvpSync } from "@/components/GuestRsvpSync";
import { PeopleEntryList } from "@/components/PeopleEntryList";
import { PeopleHubTabs, PeopleTabFooterLink } from "@/components/PeopleHubTabs";
import { V2PageHeader } from "@/components/V2PageHeader";
import { timelineEditable } from "@/lib/access";
import { parsePeopleTab, type PeopleTab } from "@/lib/people-directory";
import { loadPeopleHubData } from "@/lib/people-hub";
import { requirePageSession } from "@/lib/session";

function defaultTab(session: {
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
  searchParams: Promise<{ who?: string; done?: string; tab?: string }>;
}) {
  const sp = await searchParams;
  if (sp.who || sp.done) {
    const next = new URLSearchParams();
    if (sp.who) next.set("who", sp.who);
    if (sp.done) next.set("done", sp.done);
    redirect(`/today?${next.toString()}`);
  }

  const session = await requirePageSession();
  const tab = parsePeopleTab(sp.tab) ?? defaultTab(session);
  const data = await loadPeopleHubData(session);
  const canEditGuests = session.canSeeGuests;
  const canEditDayOf = timelineEditable(session);

  return (
    <>
      <V2PageHeader
        session={session}
        title="People"
        subtitle="Guest list, vendors, and day-of call list in one place"
      />

      <Suspense fallback={null}>
        <PeopleHubTabs activeTab={tab} counts={data.tabCounts} />
      </Suspense>

      {tab === "guests" ? (
        session.canSeeGuests ? (
          <div className="flex flex-col gap-3">
            <GuestRsvpReport report={data.guestReport} />
            {session.isMaster ? <GuestRsvpSync /> : null}
            <GuestList guests={data.guests} canEdit={canEditGuests} />
          </div>
        ) : (
          <div className="card px-3 py-4 text-sm text-muted">Guest list isn’t visible for this PIN.</div>
        )
      ) : null}

      {tab === "vendors" ? (
        <PeopleEntryList
          entries={data.vendorEntries}
          emptyLabel="No vendors yet"
          searchPlaceholder="Search vendors"
        />
      ) : null}

      {tab === "day-of" ? (
        session.canSeeTimeline ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              People to call on the big day — add a photo, phone number, and email for each contact.
            </p>
            <ContactsPanel contacts={data.dayOfContacts} canEdit={canEditDayOf} dayOfMode />
            {canEditDayOf ? (
              <PeopleTabFooterLink
                href="/people/responsibilities"
                label="Day-of responsibilities"
                detail="Who is handling what on the big day"
              />
            ) : null}
          </div>
        ) : (
          <div className="card px-3 py-4 text-sm text-muted">Day-of contacts aren’t visible for this PIN.</div>
        )
      ) : null}
    </>
  );
}
