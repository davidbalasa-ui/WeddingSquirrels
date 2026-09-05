/**
 * Isolated Day-of UI/test fixtures.
 * Never persist these rows. Never write them to Neon or local Postgres.
 */
import { toDayOfBlock, type DayOfBlock } from "@/lib/day-of";

function block(
  id: string,
  startAt: string,
  endAt: string | null,
  notes: string,
  sortOrder: number,
): DayOfBlock {
  return toDayOfBlock({ id, startAt, endAt, notes, sortOrder });
}

/** Linear schedule used by existing Day-of tests — for non-production UI checks. */
export function linearDayOfFixtureBlocks(): DayOfBlock[] {
  return [
    block("photos", "10:30 AM", "11:15 AM", "Bridal party photos\nLocation: Garden Terrace", 0),
    block("portraits", "11:30 AM", "11:50 AM", "Family portraits", 1),
    block("hideaway", "11:55 AM", "12:45 PM", "Hide away for ceremony", 2),
    block("ceremony", "1:00 PM", "1:45 PM", "Ceremony", 3),
    block("cocktails", "1:45 PM", "3:00 PM", "Cocktail hour", 4),
    block("dinner", "3:00 PM", "5:00 PM", "Dinner", 5),
    block("after", "12:30 AM", "2:00 AM", "After party", 6),
  ];
}

/**
 * Candidate-authoritative morning overlap from the production Day-of proposal.
 * Test/demo fixture only. Do not insert these 19 wedding blocks.
 */
export function morningOverlapFixtureBlocks(): DayOfBlock[] {
  return [
    block("settle", "9:00 AM", "11:00 AM", "Settle in at Airbnb", 0),
    block("vendor", "10:30 AM", "12:30 PM", "Vendor + Wedding Party Arrival", 1),
    block("diy", "11:00 AM", "11:45 AM", "Wedding party DIY hair & makeup", 2),
    block("pack", "11:45 AM", null, "Wedding party packs up", 3),
  ];
}

export type DayOfUiFixture = "morning-overlap" | "linear";

export function resolveDayOfUiFixture(
  raw: string | undefined,
  env: string = process.env.NODE_ENV ?? "development",
): DayOfUiFixture | undefined {
  if (!raw || env === "production") return undefined;
  if (raw === "morning-overlap" || raw === "linear") return raw;
  return undefined;
}

export function blocksForDayOfUiFixture(fixture: DayOfUiFixture | undefined): DayOfBlock[] | null {
  if (fixture === "morning-overlap") return morningOverlapFixtureBlocks();
  if (fixture === "linear") return linearDayOfFixtureBlocks();
  return null;
}
