import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ContactsPanel } from "@/components/ContactsPanel";
import { GuestList } from "@/components/GuestList";
import { PeopleEntryList } from "@/components/PeopleEntryList";
import { PeopleHero } from "@/components/PeopleHero";
import { PeopleHubFilters } from "@/components/PeopleHubFilters";
import { PeopleTabFooterLink } from "@/components/PeopleHubTabs";
import { PeopleRsvpPulse } from "@/components/PeopleRsvpPulse";
import { moneyEditable, timelineEditable } from "@/lib/access";
import {
  filterDirectoryByAttendance,
  peopleHubEmptyLabel,
} from "@/lib/people-experience";
import {
  parsePeopleAttendanceFilter,
  parsePeopleTab,
  type PeopleTab,
} from "@/lib/people-directory";
import { collectUploadedPhotos } from "@/lib/people-sort";
import { loadPeopleHubData } from "@/lib/people-hub";
import { requirePageSession } from "@/lib/session";

function defaultFilter(): PeopleTab {
  return "all";
}

function visibleTabs(session: { canSeeGuests: boolean; canSeeTimeline: boolean }): PeopleTab[] {
  const tabs: PeopleTab[] = ["all"];
  if (session.canSeeGuests) tabs.push("guests");
  tabs.push("vendors");
  if (session.canSeeTimeline) tabs.push("day-of");
  return tabs;
}

export default async function PeopleHubPage({
  searchParams,
}: {
  searchParams: Promise<{
    who?: string;
    done?: string;
    tab?: string;
    role?: string;
    rsvp?: string;
    view?: string;
    manage?: string;
  }>;
}) {
  const sp = await searchParams;
  if (sp.who || sp.done) {
    const next = new URLSearchParams();
    if (sp.who) next.set("who", sp.who);
    if (sp.done) next.set("done", sp.done);
    redirect(`/today?${next.toString()}`);
  }

  const session = await requirePageSession();
  const allowed = visibleTabs(session);
  const requested = parsePeopleTab(sp.tab) ?? defaultFilter();
  const filter = allowed.includes(requested) ? requested : allowed[0] ?? "all";
  const attendance = parsePeopleAttendanceFilter(sp.rsvp) ?? "all";
  const data = await loadPeopleHubData(session);
  const canEditGuests = session.canSeeGuests;
  const canEditDayOf = timelineEditable(session);
  const showManageGuests = sp.manage === "1" || sp.view === "table";

  const guestEntries = filterDirectoryByAttendance(data.guestEntries, attendance);
  const listEntries =
    filter === "guests"
      ? guestEntries
      : filter === "vendors"
        ? data.vendorEntries
        : filter === "day-of"
          ? data.dayOfEntries
          : data.entries;

  const searchPlaceholder =
    filter === "vendors"
      ? "Search vendors"
      : filter === "day-of"
        ? "Search day-of contacts"
        : filter === "guests"
          ? "Search guests"
          : "Search people";

  return (
    <>
      <PeopleHero session={session} />
      <Suspense fallback={null}>
        <PeopleHubFilters
          activeFilter={filter}
          counts={data.tabCounts}
          activeAttendance={attendance}
          showGuestFilters={filter === "guests"}
          visibleTabs={allowed}
        />
      </Suspense>

      {filter === "guests" && session.canSeeGuests ? <PeopleRsvpPulse report={data.guestReport} /> : null}

      {filter === "guests" && !session.canSeeGuests ? (
        <p className="py-6 text-base text-muted">Guest list isn’t visible for this PIN.</p>
      ) : filter === "day-of" && !session.canSeeTimeline ? (
        <p className="py-6 text-base text-muted">Day-of contacts aren’t visible for this PIN.</p>
      ) : (
        <PeopleEntryList
          entries={listEntries}
          emptyLabel={peopleHubEmptyLabel(filter)}
          searchPlaceholder={searchPlaceholder}
          tab={filter}
        />
      )}

      {filter === "guests" && session.canSeeGuests ? (
        <div className="mt-8">
          {showManageGuests ? (
            <GuestList
              guests={data.guests}
              canEdit={canEditGuests}
              attendance={attendance}
              view={sp.view === "table" ? "table" : "list"}
              photos={collectUploadedPhotos({
                guests: data.guests,
                extraPhotos: [
                  ...data.dayOfContacts.map((c) => ({ src: c.photoData, label: c.name })),
                  ...data.vendorEntries.map((e) => ({ src: e.photoSrc, label: e.name })),
                ],
              })}
            />
          ) : (
            <PeopleTabFooterLink
              href="/people?tab=guests&manage=1"
              label="Manage guest list"
              detail="Households, RSVPs, and seating"
            />
          )}
        </div>
      ) : null}

      {filter === "day-of" && session.canSeeTimeline ? (
        <div className="mt-8 flex flex-col gap-4">
          {canEditDayOf ? (
            <details>
              <summary className="cursor-pointer list-none py-2 text-sm font-semibold text-[var(--accent)] [&::-webkit-details-marker]:hidden">
                Add or edit day-of contacts
              </summary>
              <div className="mt-3">
                <ContactsPanel contacts={data.dayOfContacts} canEdit={canEditDayOf} dayOfMode />
              </div>
            </details>
          ) : null}
          <PeopleTabFooterLink
            href="/people/responsibilities"
            label="Day-of responsibilities"
            detail="Who is handling what on the big day"
          />
        </div>
      ) : null}

      {filter === "vendors" && moneyEditable(session) ? (
        <div className="mt-8">
          <PeopleTabFooterLink href="/money" label="Money" detail="Vendor contracts and balances" />
        </div>
      ) : null}
    </>
  );
}
