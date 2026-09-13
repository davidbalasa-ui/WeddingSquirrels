import { Suspense } from "react";
import { InboxBoard } from "@/components/InboxBoard";
import { OfflineSetupCard } from "@/components/OfflineSetupCard";
import { TodayAttentionQueue } from "@/components/TodayAttentionQueue";
import { TodayComingUpList } from "@/components/TodayComingUpList";
import { TodayContext } from "@/components/TodayContext";
import { TodayHero } from "@/components/TodayHero";
import { TodayInboxAddBar } from "@/components/TodayInboxAddBar";
import { TodayPulseStrip } from "@/components/TodayPulseStrip";
import { TodayWaitingSection } from "@/components/TodayWaitingSection";
import { timelineEditable } from "@/lib/access";
import { loadTodayPageData } from "@/lib/today";
import { usesExecutionLayout } from "@/lib/wedding-phase";
import { requireHomeSession } from "@/lib/session";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await requireHomeSession();
  const params = await searchParams;
  const asOf = typeof params.asOf === "string" ? params.asOf : undefined;
  const data = await loadTodayPageData(session, { asOfDateKey: asOf });
  const filter = typeof params.filter === "string" ? params.filter : null;
  const showInbox =
    filter === "needs-me" ||
    filter === "waiting" ||
    filter === "asks" ||
    filter === "tasks" ||
    filter === "buy";
  const execution = usesExecutionLayout(data.phase.phase);
  const tomorrowContext = data.tomorrow.map((row) => ({
    id: row.id,
    timeLabel: row.timeLabel ?? null,
    title: row.title,
    context: row.subtitle,
    href: row.href,
  }));

  return (
    <>
      <OfflineSetupCard />
      <TodayHero
        session={session}
        hero={data.hero}
        canEditVenue={timelineEditable(session) && session.canSeeTimeline}
      />
      {execution ? (
        <>
          <Suspense>
            <TodayContext
              title="Today"
              items={data.todayContext}
              empty={data.todayEmpty}
            />
          </Suspense>
          <Suspense>
            <TodayAttentionQueue
              session={session}
              attention={data.attention}
              tasks={data.inbox.tasks}
            />
          </Suspense>
          {data.phase.phase !== "wedding_day" ? (
            <Suspense>
              <TodayContext title="Tomorrow" items={tomorrowContext} empty={data.tomorrowEmpty} />
            </Suspense>
          ) : null}
          <Suspense>
            <TodayWaitingSection session={session} waiting={data.waiting} tasks={data.inbox.tasks} />
          </Suspense>
          <TodayPulseStrip stats={data.pulse} compact={data.pulseCompact} />
          {data.phase.phase !== "wedding_day" ? (
            <TodayComingUpList items={data.comingUp} title="Later this week" />
          ) : null}
        </>
      ) : (
        <>
          <Suspense>
            <TodayAttentionQueue
              session={session}
              attention={data.attention}
              tasks={data.inbox.tasks}
            />
          </Suspense>
          <Suspense>
            <TodayWaitingSection session={session} waiting={data.waiting} tasks={data.inbox.tasks} />
          </Suspense>
          <Suspense>
            <TodayContext items={data.todayContext} />
          </Suspense>
          <TodayPulseStrip stats={data.pulse} compact={data.pulseCompact} />
          <Suspense>
            <TodayComingUpList items={data.comingUp} />
          </Suspense>
        </>
      )}
      {showInbox ? (
        <section className="mb-8">
          <p className="pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            All items
          </p>
          <Suspense>
            <InboxBoard
              session={session}
              sections={data.inbox.sections}
              accounts={data.inbox.accounts}
              people={data.inbox.people}
              tasks={data.inbox.tasks}
              whoChips={data.inbox.whoChips}
              hidePrioritySections
              hideAddBar
            />
          </Suspense>
        </section>
      ) : null}
      <Suspense>
        <TodayInboxAddBar
          session={session}
          accounts={data.inbox.accounts}
          people={data.inbox.people}
          tasks={data.inbox.tasks}
        />
      </Suspense>
    </>
  );
}
