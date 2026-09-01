import { Suspense } from "react";
import { InboxBoard } from "@/components/InboxBoard";
import { OfflineSetupCard } from "@/components/OfflineSetupCard";
import { TodayComingUpList } from "@/components/TodayComingUpList";
import { TodayHero } from "@/components/TodayHero";
import { TodayPrioritySections } from "@/components/TodayPrioritySections";
import { TodayPulseStrip } from "@/components/TodayPulseStrip";
import { TodayWeddingWeek } from "@/components/TodayWeddingWeek";
import { loadTodayPageData } from "@/lib/today";
import { requireHomeSession } from "@/lib/session";

export default async function TodayPage() {
  const session = await requireHomeSession();
  const data = await loadTodayPageData(session);

  return (
    <>
      <TodayHero session={session} hero={data.hero} />
      <OfflineSetupCard />
      <Suspense>
        <TodayPrioritySections
          session={session}
          attention={data.attention}
          waiting={data.waiting}
          tasks={data.inbox.tasks}
        />
      </Suspense>
      <TodayWeddingWeek items={data.weddingWeek} />
      <TodayPulseStrip stats={data.pulse} />
      <TodayComingUpList items={data.comingUp} />
      <section>
        <p className="pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">All items</p>
        <Suspense>
          <InboxBoard
            session={session}
            sections={data.inbox.sections}
            accounts={data.inbox.accounts}
            people={data.inbox.people}
            tasks={data.inbox.tasks}
            whoChips={data.inbox.whoChips}
            hidePrioritySections
          />
        </Suspense>
      </section>
    </>
  );
}
