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
import { loadTodayPageData } from "@/lib/today";
import { requireHomeSession } from "@/lib/session";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await requireHomeSession();
  const data = await loadTodayPageData(session);
  const params = await searchParams;
  const filter = typeof params.filter === "string" ? params.filter : null;
  const showInbox =
    filter === "needs-me" ||
    filter === "waiting" ||
    filter === "asks" ||
    filter === "tasks" ||
    filter === "buy";

  return (
    <>
      <OfflineSetupCard />
      <TodayHero session={session} hero={data.hero} />
      <TodayAttentionQueue
        session={session}
        attention={data.attention}
        tasks={data.inbox.tasks}
      />
      <TodayWaitingSection session={session} waiting={data.waiting} tasks={data.inbox.tasks} />
      <TodayContext items={data.todayContext} />
      <TodayPulseStrip stats={data.pulse} />
      <TodayComingUpList items={data.comingUp} />
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
