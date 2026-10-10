import { DayTabs } from "@/components/DayTabs";
import { McRunOfShowView } from "@/components/McRunOfShow";
import { PlanChapterHeader } from "@/components/PlanChapterHeader";
import { loadWeddingTimelineBlocks } from "@/lib/day-of-page";
import { prisma } from "@/lib/db";
import { buildMcRunOfShow } from "@/lib/mc-run-of-show";
import { loadPlaybookItems } from "@/lib/playbook-data";
import { requirePageSession } from "@/lib/session";
import { ceremonyLineUpTime } from "@/lib/schedule-consistency";

export default async function McRunOfShowPage() {
  await requirePageSession({ need: "canSeeTimeline" });
  const [blocks, people, lineup] = await Promise.all([
    loadWeddingTimelineBlocks(),
    prisma.person.findMany({
      select: { name: true, directoryLabel: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    loadPlaybookItems("lineup"),
  ]);
  const show = buildMcRunOfShow(blocks, people);
  const lineUpTime = ceremonyLineUpTime(blocks) ?? lineup.find((row) => row.startAt)?.startAt ?? null;

  return (
    <>
      <PlanChapterHeader
        title="MC Run of Show"
        subtitle="Spoken cues, music, and the next announcement — without the rest of the wedding schedule."
        backHref="/day"
        backLabel="Day-of"
      />
      <DayTabs />
      <McRunOfShowView show={show} lineup={lineup} lineUpTime={lineUpTime} />
    </>
  );
}
