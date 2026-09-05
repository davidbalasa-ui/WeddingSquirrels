import type { PrismaClient } from "@prisma/client";
import { parsedTimeFields } from "@/lib/day-of-time";

function isNeonHostUrl(databaseUrl: string | undefined): boolean {
  if (!databaseUrl) return false;
  try {
    const hostname = new URL(databaseUrl).hostname.toLowerCase();
    return hostname === "neon.tech" || hostname.endsWith(".neon.tech");
  } catch {
    return false;
  }
}

export type RehearsalSeedBlock = {
  id: string;
  startAt: string;
  endAt: string | null;
  notes: string;
};

/** Thursday rehearsal itinerary (night before Oct 16, 2026). */
export const REHEARSAL_SCHEDULE_SEED: RehearsalSeedBlock[] = [
  {
    id: "reh.checkin",
    startAt: "1:00 PM",
    endAt: null,
    notes: "Airbnb Check-in; Wedding party arrives; Rooms are picked",
  },
  {
    id: "reh.getready",
    startAt: "2:30 PM",
    endAt: null,
    notes: "Get ready; Hair and makeup",
  },
  {
    id: "reh.depart-airbnb",
    startAt: "3:45 PM",
    endAt: null,
    notes: "Depart Airbnb; Drive time 25-30 minutes; Location: Hawkshead 523 Hawks Nest Dr, South Haven",
  },
  {
    id: "reh.dinner",
    startAt: "4:15 PM",
    endAt: "5:40 PM",
    notes: "Dinner; Welcome toasts; Reminders & logistics",
  },
  {
    id: "reh.depart-bss",
    startAt: "5:40 PM",
    endAt: null,
    notes: "Depart for BSS; Drive time 10-15 minutes",
  },
  {
    id: "reh.ceremony",
    startAt: "6:00 PM",
    endAt: "7:00 PM",
    notes: "Rehearsal; Ceremony rehearsal at BSS",
  },
  {
    id: "reh.return",
    startAt: "7:15 PM",
    endAt: null,
    notes: "Return to Airbnb; Game night!",
  },
];

/** Local/dev convenience only. Production Neon must not silently create rehearsal rows. */
export function shouldAutoBootstrapRehearsal(
  databaseUrl: string | undefined = process.env.DATABASE_URL,
): boolean {
  return !isNeonHostUrl(databaseUrl);
}

export async function ensureRehearsalSchedule(client: PrismaClient) {
  if (!shouldAutoBootstrapRehearsal()) return;

  const existing = await client.timelineBlock.count({ where: { schedule: "rehearsal" } });
  if (existing > 0) return;

  await client.timelineBlock.createMany({
    data: REHEARSAL_SCHEDULE_SEED.map((block, index) => ({
      id: block.id,
      startAt: block.startAt,
      endAt: block.endAt,
      notes: block.notes,
      sortOrder: index,
      schedule: "rehearsal",
      ...parsedTimeFields(block.startAt, block.endAt),
    })),
  });
}
