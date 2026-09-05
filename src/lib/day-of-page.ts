import { prisma } from "@/lib/db";
import {
  parseDayOfAsOf,
  toDayOfBlock,
  viewFromExperienceSource,
  type DayOfExperienceSource,
  type DayOfView,
} from "@/lib/day-of";
import { blocksForDayOfUiFixture, resolveDayOfUiFixture } from "@/lib/day-of-fixtures";
import {
  buildDayNowNextSnapshot,
  shouldShowDayNowTab,
  type DayNowNextSnapshot,
  type TimelineBlockInput,
} from "@/lib/day-of-now";
import { sortTimelineBlocks } from "@/lib/day-of-time";
import { buildTodayHero, formatWeddingDateLabel } from "@/lib/today";
import type { SessionAccount } from "@/lib/types";
import { getWeddingPhase, type WeddingPhaseInfo } from "@/lib/wedding-phase";

export type DayOfPageContext = {
  daysToGo: number | null;
  weddingDateLabel: string | null;
  showNowTab: boolean;
};

/** Live wedding rows from the database. Never reads candidate bootstrap constants. */
export async function loadWeddingTimelineBlocks() {
  return sortTimelineBlocks(
    await prisma.timelineBlock.findMany({ where: { schedule: "wedding" } }),
  );
}

export async function loadDayOfContext(): Promise<DayOfPageContext> {
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  const timezone = settings?.timezone ?? "America/Detroit";
  const phase = getWeddingPhase({
    weddingDate: settings?.weddingDate ?? null,
    timezone,
  });

  return {
    daysToGo: phase.daysUntilWedding,
    weddingDateLabel: settings?.weddingDate
      ? formatWeddingDateLabel(settings.weddingDate, timezone)
      : null,
    showNowTab: shouldShowDayNowTab(phase.daysUntilWedding),
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

export type DayOfExperienceData = {
  source: DayOfExperienceSource;
  view: DayOfView;
  phase: WeddingPhaseInfo;
  canEdit: boolean;
};

export async function loadDayOfExperience(
  session: SessionAccount,
  opts?: { now?: Date; asOf?: string; fixture?: string },
): Promise<DayOfExperienceData> {
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  const timezone = settings?.timezone ?? "America/Detroit";
  const asOf = parseDayOfAsOf(opts?.asOf, timezone);
  const now = opts?.now ?? asOf ?? new Date();
  const uiFixture = resolveDayOfUiFixture(opts?.fixture);
  const phase = getWeddingPhase({
    weddingDate: settings?.weddingDate ?? null,
    timezone,
    now,
  });

  const canSeeContacts = Boolean(session.isMaster || session.canSeeTimeline);
  const [blocks, contacts, assignments] = await Promise.all([
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
    canSeeContacts
      ? prisma.contact.findMany({
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            directoryLabel: true,
            phone: true,
            email: true,
            photoData: true,
            sortOrder: true,
            isDayOfContact: true,
            personId: true,
            person: { select: { id: true, name: true } },
          },
        })
      : Promise.resolve([]),
    prisma.dayAssignment.findMany({
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        notes: true,
        sortOrder: true,
        assignees: { select: { personId: true } },
      },
    }),
  ]);

  const source: DayOfExperienceSource = {
    generatedAt: now.toISOString(),
    freezeClock: Boolean(asOf),
    timezone,
    weddingDateIso: settings?.weddingDate?.toISOString() ?? null,
    coupleNames: settings?.coupleNames?.trim() || null,
    weddingDateLabel: settings?.weddingDate
      ? formatWeddingDateLabel(settings.weddingDate, timezone)
      : null,
    blocks: blocksForDayOfUiFixture(uiFixture) ?? blocks.map(toDayOfBlock),
    contacts: contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      personName: contact.person?.name ?? null,
      directoryLabel: contact.directoryLabel,
      phone: contact.phone,
      email: contact.email,
      photoData: contact.photoData,
      sortOrder: contact.sortOrder,
      isDayOfContact: contact.isDayOfContact,
      personId: contact.personId,
    })),
    assignments,
    linkedPersonId: session.linkedPersonId,
    canSeeContacts,
  };

  return {
    source,
    view: viewFromExperienceSource(source, now),
    phase,
    canEdit: session.isMaster || session.canEditTimeline,
  };
}

export { buildTodayHero };
