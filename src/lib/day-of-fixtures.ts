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

/**
 * Times and titles of the 19 imported production wedding TimelineBlocks.
 * Fixture only — never write these rows. Used to prove the helper against
 * the real schedule shape, including Venue Opens (open-ended at 10:30).
 */
export function productionWeddingTimelineFixtureBlocks(): DayOfBlock[] {
  return [
    block("wedding_settle_in", "9:00 AM", "11:00 AM", "Settle in at Airbnb", 0),
    block("wedding_venue_opens", "10:30 AM", null, "Venue Opens", 1),
    block("wedding_vendor_arrival", "10:30 AM", "12:30 PM", "Vendor + Wedding Party Arrival", 2),
    block("wedding_diy_hair", "11:00 AM", "11:45 AM", "Wedding party DIY hair & makeup", 3),
    block("wedding_pack_up", "11:45 AM", null, "Wedding party packs up", 4),
    block("wedding_party_leaves", "12:00 PM", null, "Wedding party leaves Airbnb", 5),
    block("wedding_quiet_time", "12:00 PM", "12:20 PM", "Quiet time at the Airbnb", 6),
    block("wedding_photographer_arrives", "12:30 PM", "1:00 PM", "Photographer arrives", 7),
    block("wedding_final_getting_ready", "1:00 PM", "2:15 PM", "Final getting ready", 8),
    block("wedding_getting_dressed", "2:15 PM", "2:45 PM", "Getting dressed", 9),
    block("wedding_first_look", "2:45 PM", "3:15 PM", "First Look + Portraits", 10),
    block("wedding_pre_ceremony", "3:15 PM", "3:30 PM", "Pre-Ceremony Transition", 11),
    block("wedding_ceremony", "3:30 PM", "4:00 PM", "Ceremony", 12),
    block("wedding_cocktail_hour", "4:00 PM", "5:00 PM", "Cocktail Hour", 13),
    block("wedding_dinner", "5:00 PM", "6:00 PM", "Dinner begins", 14),
    block("wedding_toasts_cake", "6:00 PM", "6:30 PM", "Toasts + Cake cutting", 15),
    block("wedding_first_dances", "6:30 PM", "7:00 PM", "First dances", 16),
    block("wedding_open_dancing", "7:00 PM", "10:00 PM", "Open Dancing", 17),
    block("wedding_teardown", "10:00 PM", "11:00 PM", "Tear down / Clean up", 18),
  ];
}

export type DayOfUiFixture = "morning-overlap" | "linear" | "production-wedding";

export function resolveDayOfUiFixture(
  raw: string | undefined,
  env: string = process.env.NODE_ENV ?? "development",
): DayOfUiFixture | undefined {
  if (!raw || env === "production") return undefined;
  if (raw === "morning-overlap" || raw === "linear" || raw === "production-wedding") return raw;
  return undefined;
}

export function blocksForDayOfUiFixture(fixture: DayOfUiFixture | undefined): DayOfBlock[] | null {
  if (fixture === "morning-overlap") return morningOverlapFixtureBlocks();
  if (fixture === "linear") return linearDayOfFixtureBlocks();
  if (fixture === "production-wedding") return productionWeddingTimelineFixtureBlocks();
  return null;
}
