import { differenceInCalendarDays, startOfDay } from "date-fns";
import { prisma } from "@/lib/db";
import {
  buildDayNowNextSnapshot,
  shouldShowDayNowTab,
  type DayNowNextSnapshot,
  type TimelineBlockInput,
} from "@/lib/day-of-now";
import { sortTimelineBlocks } from "@/lib/day-of-time";
import { buildTodayHero, formatWeddingDateLabel } from "@/lib/today";
import type { SessionAccount } from "@/lib/types";

export type DayOfPageContext = {
  daysToGo: number | null;
  weddingDateLabel: string | null;
  showNowTab: boolean;
};

export async function loadDayOfContext(): Promise<DayOfPageContext> {
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  const now = new Date();
  const daysToGo = settings?.weddingDate
    ? differenceInCalendarDays(settings.weddingDate, startOfDay(now))
    : null;
  const timezone = settings?.timezone ?? "America/Detroit";

  return {
    daysToGo,
    weddingDateLabel: settings?.weddingDate
      ? formatWeddingDateLabel(settings.weddingDate, timezone)
      : null,
    showNowTab: shouldShowDayNowTab(daysToGo),
  };
}

export type DayNowLiveSource = {
  blocks: TimelineBlockInput[];
  contacts: Array<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    photoData: string | null;
  }>;
  people: Array<{ id: string; name: string }>;
  daysToGo: number | null;
};

export async function loadDayNowPageData(session: SessionAccount): Promise<{
  snapshot: DayNowNextSnapshot;
  liveSource: DayNowLiveSource;
  context: DayOfPageContext;
  canEdit: boolean;
}> {
  const [context, blocks, contacts, people] = await Promise.all([
    loadDayOfContext(),
    prisma.timelineBlock.findMany({
      where: { schedule: "wedding" },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        notes: true,
        startMinutes: true,
        endMinutes: true,
        dayOffset: true,
        sortOrder: true,
      },
    }),
    prisma.contact.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        photoData: true,
      },
    }),
    prisma.person.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  const sortedBlocks = sortTimelineBlocks(blocks);
  const snapshot = buildDayNowNextSnapshot(sortedBlocks, contacts, people, {
    daysToGo: context.daysToGo,
  });

  return {
    snapshot,
    liveSource: {
      blocks: sortedBlocks,
      contacts,
      people,
      daysToGo: context.daysToGo,
    },
    context,
    canEdit: session.isMaster || session.canEditTimeline,
  };
}

export { buildTodayHero };
