/**
 * "David and Haley Reconciled Wedding Timeline" (PDF David shared on 9 Oct 2026).
 * Every moment below is that document, line for line. Nothing here is invented.
 *
 * The page and the binder read these rows from the database; this file is the
 * source they are applied from, by seedKey, through the review-and-apply card
 * on the Wedding Day page. Rows the document does not mention are left alone
 * and listed for the owner to decide on.
 */
import { parseDayOfTime, parsedTimeFields } from "@/lib/day-of-time";
import { composeBlockNotes, parseBlockNotes } from "@/lib/day-of-now";
import { REHEARSAL_SCHEDULE_SEED } from "@/lib/rehearsal";

export type TimelinePhase = {
  id: string;
  label: string;
  schedule: "wedding" | "rehearsal";
};

export const TIMELINE_PHASES: TimelinePhase[] = [
  { id: "rehearsal", label: "Thursday · Rehearsal dinner", schedule: "rehearsal" },
  { id: "morning", label: "Morning · Hair, makeup and departure", schedule: "wedding" },
  { id: "photos", label: "Wedding photos", schedule: "wedding" },
  { id: "ceremony", label: "Ceremony and cocktail hour", schedule: "wedding" },
  { id: "evening", label: "Dinner, dances and evening events", schedule: "wedding" },
];

export type ReconciledMoment = {
  seedKey: string;
  schedule: "wedding" | "rehearsal";
  phase: string;
  startAt: string;
  endAt: string | null;
  title: string;
  location?: string;
  lines: string[];
  openItems?: string;
};

export const OPEN_ITEMS_PREFIX = /^open items?:\s*/i;

/** The app's original rehearsal rows, by id, as seeded: an unedited one is safe to fold away. */
const REHEARSAL_LEGACY_NOTES = new Map(REHEARSAL_SCHEDULE_SEED.map((block) => [block.id, block.notes]));

const W = "wedding" as const;
const R = "rehearsal" as const;

export const RECONCILED_TIMELINE: ReconciledMoment[] = [
  // Thursday
  { seedKey: "reh.checkin", schedule: R, phase: "rehearsal", startAt: "1:00 PM", endAt: "2:30 PM", title: "Airbnb check in",
    lines: ["Wedding party arrives and chooses rooms.", "David and Haley plan to arrive around 1:00 PM."],
    openItems: "Confirm the Airbnb address and who has check-in access." },
  { seedKey: "reh.getready", schedule: R, phase: "rehearsal", startAt: "2:30 PM", endAt: "3:45 PM", title: "Get ready",
    lines: ["Hair, makeup, clothing, and final items before departure.", "Victoria meets the group at Hawkshead; Braxton meets the group at the reception/rehearsal."],
    openItems: "Confirm whether anyone else will skip the Airbnb arrival window." },
  { seedKey: "reh.depart-airbnb", schedule: R, phase: "rehearsal", startAt: "3:45 PM", endAt: null, title: "Depart for Hawkshead",
    location: "Hawkshead, 523 Hawks Nest Drive, South Haven", lines: ["Allow 25–30 minutes."] },
  { seedKey: "reh.dinner", schedule: R, phase: "rehearsal", startAt: "4:15 PM", endAt: "5:40 PM", title: "Rehearsal dinner",
    lines: ["Dinner, welcome toasts, reminders, and logistics."] },
  { seedKey: "reh.depart-bss", schedule: R, phase: "rehearsal", startAt: "5:40 PM", endAt: null, title: "Depart for Black Sheep Shelter",
    lines: ["Allow 10–15 minutes."] },
  { seedKey: "reh.ceremony", schedule: R, phase: "rehearsal", startAt: "6:00 PM", endAt: "7:00 PM", title: "Ceremony rehearsal",
    lines: ["Practice processional, ceremony positions, recessional, and immediate marriage-license signing flow."] },
  { seedKey: "reh.return", schedule: R, phase: "rehearsal", startAt: "7:15 PM", endAt: null, title: "Return to the Airbnb",
    lines: ["Steam dresses and suits.", "Dessert and game night."], openItems: "Confirm the dessert plan and final location." },

  // Friday morning
  { seedKey: "wedding_hair_rotation_1", schedule: W, phase: "morning", startAt: "9:00 AM", endAt: "10:00 AM", title: "Wedding party first hair and makeup rotation",
    lines: ["Hair: Braxton in Bathroom 1; Andi in Bathroom 2; Kaylie in Bathroom 3.", "Makeup: Bri and Trinity in Bedroom 1; Victoria and Skila in Bedroom 3."] },
  { seedKey: "wedding_haley_makeup", schedule: W, phase: "morning", startAt: "9:30 AM", endAt: "10:30 AM", title: "Haley makeup",
    lines: ["Haley begins makeup in Bedroom 2."] },
  { seedKey: "wedding_hair_rotation_2", schedule: W, phase: "morning", startAt: "10:00 AM", endAt: "11:00 AM", title: "Wedding party hair and makeup swap",
    lines: ["Makeup: Braxton in Bedroom 1; Andi and Kaylie in Bedroom 3.", "Hair: Bri and Trinity in Bathroom 1; Victoria in Bathroom 2; Skila in Bathroom 3."] },
  { seedKey: "wedding_katie_arrives", schedule: W, phase: "morning", startAt: "10:30 AM", endAt: null, title: "Katie arrives",
    location: "Airbnb, Bedroom 2",
    lines: ["Katie arrives at the Airbnb and works with Haley in Bedroom 2.", "Haley’s makeup should be finished. Haley eats, drinks, and takes a bathroom break before hair."] },
  { seedKey: "wedding_venue_opens", schedule: W, phase: "morning", startAt: "10:30 AM", endAt: "11:00 AM", title: "Set up the venue",
    location: "Black Sheep Shelter",
    lines: ["Black Sheep Shelter access begins at 10:30 AM.", "Wendy and Kurt begin setup.", "Avalon arrives at 10:30 AM and is the main point of contact."],
    openItems: "Confirm how late Avalon stays." },
  { seedKey: "wedding_belle_arrives", schedule: W, phase: "morning", startAt: "11:00 AM", endAt: null, title: "Belle arrives",
    location: "Airbnb",
    lines: ["Belle arrives at the Airbnb and begins wedding-day video coverage."] },
  { seedKey: "wedding_diy_hair", schedule: W, phase: "morning", startAt: "11:00 AM", endAt: "11:30 AM", title: "Haley hair and wedding party final touches",
    lines: ["Wedding party finishes hair and makeup, cleans rooms, and gathers belongings."] },
  { seedKey: "wedding_pack_up", schedule: W, phase: "morning", startAt: "11:30 AM", endAt: "12:00 PM", title: "Clean, pack, eat and load cars",
    lines: ["Pack wedding and personal items.", "Wedding party prepares to leave at noon."] },
  { seedKey: "wedding_party_leaves", schedule: W, phase: "morning", startAt: "12:00 PM", endAt: "12:20 PM", title: "Wedding party leaves and private vows",
    lines: ["Wedding party leaves for Black Sheep Shelter.", "David and Haley remain briefly for private vows with Belle."] },
  { seedKey: "wedding_vendor_arrival", schedule: W, phase: "morning", startAt: "12:15 PM", endAt: "12:30 PM", title: "Wedding party arrives at Black Sheep Shelter",
    lines: ["Remove dresses from bags and complete hair and makeup touch-ups."] },
  { seedKey: "wedding_couple_departs", schedule: W, phase: "morning", startAt: "12:20 PM", endAt: "12:30 PM", title: "David, Haley and Belle depart",
    lines: ["Allow approximately 15 minutes to reach the venue."] },
  { seedKey: "wedding_photographer_arrives", schedule: W, phase: "morning", startAt: "12:30 PM", endAt: null, title: "Barry arrives and photographs the details",
    lines: ["Invitations, jewelry, suit accessories, shoes, flowers, veil, and hanging dresses."],
    openItems: "Ask Barry if he can stay from 12:30 PM–9:00 PM. His contract may cover eight hours, while this schedule needs eight and a half." },
  { seedKey: "wedding_couple_arrives", schedule: W, phase: "morning", startAt: "12:45 PM", endAt: null, title: "David, Haley and Belle arrive",
    lines: ["Haley retouches makeup and prepares for getting-ready photos."] },

  // Wedding photos
  { seedKey: "wedding_david_parents_first_look", schedule: W, phase: "photos", startAt: "1:00 PM", endAt: null, title: "David’s first look with his parents",
    lines: ["David’s parents pin his boutonniere for their first look.", "Photos of David with his parents.", "Afterward, photos move to Haley getting dressed."] },
  { seedKey: "wedding_getting_dressed", schedule: W, phase: "photos", startAt: "1:00 PM", endAt: "1:30 PM", title: "Haley gets dressed",
    lines: ["Haley gets into her dress with MOB and MOH helping.", "Mom buttons the dress; bride-with-veil portrait.", "Children arrive at 1:15 PM."] },
  { seedKey: "wedding_haley_family_photos", schedule: W, phase: "photos", startAt: "1:30 PM", endAt: "1:45 PM", title: "Haley’s family photos",
    lines: ["Haley with parents.", "Haley with mom.", "Haley with dad.", "Haley first look with Dad."] },
  { seedKey: "wedding_david_photos", schedule: W, phase: "photos", startAt: "1:45 PM", endAt: "2:00 PM", title: "David’s photos",
    lines: ["David solo portraits and groom-party candids.", "The children join David for photos.", "Barry positions David and clears the first-look area."] },
  { seedKey: "wedding_first_look", schedule: W, phase: "photos", startAt: "2:00 PM", endAt: "2:15 PM", title: "David and Haley first look",
    lines: ["Private first look followed by immediate couple portraits."] },
  { seedKey: "wedding_couple_parent_photos", schedule: W, phase: "photos", startAt: "2:15 PM", endAt: "2:30 PM", title: "Couple and parent photos",
    lines: ["Couple with parents.", "Couple with mom.", "Couple with dad.", "Additional couple portraits as time permits."] },
  { seedKey: "wedding_party_photos", schedule: W, phase: "photos", startAt: "2:30 PM", endAt: "3:00 PM", title: "Wedding party photos",
    lines: [
      "Bride with wedding party.",
      "Groom with wedding party.",
      ...["Skila", "Trinity", "Victoria", "Bri", "Kaylie", "Braxton", "Andi"].map((name) => `Bride with ${name}.`),
      ...["Skila", "Trinity", "Victoria", "Bri", "Kaylie", "Evan", "Braxton"].map((name) => `Groom with ${name}.`),
    ] },
  { seedKey: "wedding_quiet_time", schedule: W, phase: "photos", startAt: "3:00 PM", endAt: "3:15 PM", title: "Touch-ups and quiet time",
    lines: ["Wedding party moves out of guest view.", "Bathroom, water, touch-ups, and schedule recovery if portraits run long."] },
  { seedKey: "wedding_ring_security", schedule: W, phase: "photos", startAt: "3:00 PM", endAt: "3:30 PM", title: "Harmony on ring security",
    location: "Entry table",
    lines: ["Harmony is on ring security and stands next to the entry table for the half hour before the ceremony starts."] },
  { seedKey: "wedding_pre_ceremony", schedule: W, phase: "photos", startAt: "3:15 PM", endAt: "3:30 PM", title: "Get ready for the ceremony",
    lines: ["Guests arrive and are seated.", "Wedding party lines up.", "Barry photographs ceremony details and guest arrivals.", "No early bar service is planned."] },

  // Ceremony and cocktail hour
  { seedKey: "wedding_ceremony", schedule: W, phase: "ceremony", startAt: "3:30 PM", endAt: "4:00 PM", title: "Ceremony",
    location: "Under the shelter", lines: [] },
  { seedKey: "wedding_license_signing", schedule: W, phase: "ceremony", startAt: "4:00 PM", endAt: null, title: "Sign the marriage license",
    lines: ["Immediately after the recessional.", "David, Haley, Marie, and the witnesses move directly to the signing table.", "Andi (Best Man) and Braxton (Maid of Honor) are the witnesses and are in charge of the license and pen."] },
  { seedKey: "wedding_cocktail_hour", schedule: W, phase: "ceremony", startAt: "4:00 PM", endAt: "5:00 PM", title: "Cocktail hour and bar opening",
    lines: [
      "Bar service begins at 4:00 PM.",
      "Guests receive drinks and appetizers while photography continues.",
    ],
    openItems: "Confirm the bar will be ready at 4:00 PM." },
  { seedKey: "wedding_final_touchups", schedule: W, phase: "ceremony", startAt: "4:45 PM", endAt: "4:50 PM", title: "Final touch-ups",
    lines: ["Bathroom break, touch-ups, and prepare for entrance."] },
  { seedKey: "wedding_entrance_lineup", schedule: W, phase: "ceremony", startAt: "4:50 PM", endAt: "5:00 PM", title: "Wedding party lines up",
    lines: ["Guests move to dinner seating.", "MC confirms names and entrance order."],
    openItems: "Give Wendy the entrance order and make sure she knows how to say every name." },

  // Dinner, dances and evening
  { seedKey: "wedding_dinner", schedule: W, phase: "evening", startAt: "5:00 PM", endAt: null, title: "Grand entrance and dinner begins",
    lines: ["Grand entrance starts at 5:00 PM.", "Immediately after the entrance, David and Haley get their food.", "Once David and Haley have food, tables are called up."],
    openItems: "Choose who calls tables and confirm how Precious Peony will serve dinner." },
  { seedKey: "wedding_dinner_service", schedule: W, phase: "evening", startAt: "5:00 PM", endAt: "6:00 PM", title: "Dinner service",
    lines: ["Guests eat while the couple circulates only as time permits.", "Prepare toast speakers near the end of dinner."] },
  { seedKey: "wedding_toasts_cake", schedule: W, phase: "evening", startAt: "6:00 PM", endAt: "6:15 PM", title: "Toasts",
    lines: ["Best man, MOH, and FOB toasts."], openItems: "Confirm who is giving a toast, the order, and how long each person gets." },
  { seedKey: "wedding_cake_cutting", schedule: W, phase: "evening", startAt: "6:15 PM", endAt: null, title: "Cake cutting",
    lines: ["Cut the cake immediately after toasts.", "Photographer and videographer are cued before cutting begins."],
    openItems: "Confirm when the cake arrives, who receives it, and who has the knife, plates, and serving plan." },
  { seedKey: "wedding_first_dances", schedule: W, phase: "evening", startAt: "6:25 PM", endAt: "6:45 PM", title: "Formal dances",
    lines: ["First dance.", "Father of the bride dance.", "Any additional formal dance must be confirmed before the event."] },
  { seedKey: "wedding_golden_hour", schedule: W, phase: "evening", startAt: "6:23 PM", endAt: "7:18 PM", title: "Golden-hour photos",
    lines: ["Golden hour in South Haven is about 6:23–7:18 PM.", "Sunset is approximately 7:01 PM.", "Plan for outdoor photos from 6:45–6:55 PM."],
    openItems: "Ask Barry to confirm the best 10 minutes for outdoor photos." },
  { seedKey: "wedding_open_dancing", schedule: W, phase: "evening", startAt: "7:00 PM", endAt: "8:00 PM", title: "Open dancing",
    lines: ["Dance floor opens and the couple stays on the floor as much as possible."] },
  { seedKey: "wedding_children_ready", schedule: W, phase: "evening", startAt: "8:00 PM", endAt: null, title: "Children get ready to leave",
    lines: ["Parents gather belongings and prepare children to leave."] },
  { seedKey: "wedding_music_change", schedule: W, phase: "evening", startAt: "8:15 PM", endAt: null, title: "Music change and children’s send-off",
    lines: ["Shift to the later-evening music plan.", "Pause for the children’s farewell/send-off."],
    openItems: "Confirm each child’s ride and whether children leave at 8:00 PM or after the 8:15 PM send-off." },
  { seedKey: "wedding_getaway_arrives", schedule: W, phase: "evening", startAt: "8:20 PM", endAt: "8:35 PM", title: "Getaway vehicle arrives",
    lines: ["MOB or another helper meets San Vandenheede.", "Show San where to park, give him the “Just Married” sign, and tell the groom.", "Keep the vehicle details secret from the bride."],
    openItems: "Confirm MOB will meet San and give her his phone number and arrival time." },
  { seedKey: "wedding_dollar_dance", schedule: W, phase: "evening", startAt: "8:30 PM", endAt: "8:40 PM", title: "Dollar dance",
    lines: ["MC announces the dollar dance.", "Barry photographs the dance."] },
  { seedKey: "wedding_getaway_photos", schedule: W, phase: "evening", startAt: "8:40 PM", endAt: "8:50 PM", title: "Getaway vehicle photos",
    lines: ["David and Haley step outside for a 10-minute portrait set.", "Afterward, the MC may invite guests to view and photograph the vehicle without revealing details early."] },
  { seedKey: "wedding_night_sky_photos", schedule: W, phase: "evening", startAt: "8:50 PM", endAt: "9:00 PM", title: "Night-sky photos and Barry finishes",
    lines: ["Final outdoor portraits with Barry.", "Return to dancing at 9:00 PM."] },
  { seedKey: "wedding_open_dancing_2", schedule: W, phase: "evening", startAt: "9:00 PM", endAt: "9:45 PM", title: "Open dancing",
    lines: ["David and Haley return to the dance floor."] },
  { seedKey: "wedding_last_dance", schedule: W, phase: "evening", startAt: "9:45 PM", endAt: null, title: "Last open dance",
    lines: ["“Moon” by Logan Bowden."], openItems: "Confirm the correct version of “Moon” with the person handling the music." },
  { seedKey: "wedding_private_dance", schedule: W, phase: "evening", startAt: "9:55 PM", endAt: null, title: "Private final dance",
    lines: ["Guests clear the dance floor while David and Haley have a private final dance."] },
  { seedKey: "wedding_reception_ends", schedule: W, phase: "evening", startAt: "10:00 PM", endAt: null, title: "Reception ends",
    lines: ["Guest departure and final send-off if used."] },
  { seedKey: "wedding_teardown", schedule: W, phase: "evening", startAt: "10:00 PM", endAt: "11:00 PM", title: "Tear down and cleanup",
    lines: ["Pack decor, gifts, personal belongings, remaining food, and vendor items."],
    openItems: "Choose who cleans each area and who takes the gifts, decor, food, alcohol, and personal items." },
];

/** Bootstrap rows the document folds into other moments. Removed on apply so they do not show twice. */
export const RECONCILED_RETIRED_SEED_KEYS = [
  "wedding_settle_in",
  "wedding_final_getting_ready",
  // David, 9 Oct 2026: the 4:00–4:30 family photos come off the day.
  "wedding_family_photos_after",
  // David, 9 Oct 2026: no 4:30 break for the couple and no drinks/apps runners.
  "wedding_couple_cocktail",
];

export function reconciledNotes(moment: ReconciledMoment): string {
  const detailLines = [...moment.lines];
  if (moment.openItems) detailLines.push(`Open items: ${moment.openItems}`);
  return composeBlockNotes({ title: moment.title, location: moment.location ?? null, detailLines });
}

export function phaseForSeedKey(seedKey: string | null | undefined): string | null {
  if (!seedKey) return null;
  return RECONCILED_TIMELINE.find((moment) => moment.seedKey === seedKey)?.phase ?? null;
}

/** Section a row belongs to: the document's own section when known, else by its start time. */
export function phaseForBlock(
  block: { seedKey?: string | null; startAt: string },
  schedule: "wedding" | "rehearsal" = "wedding",
): string {
  if (schedule === "rehearsal") return "rehearsal";
  // The document's section holds while the moment keeps the document's time; a moved moment follows its new time.
  const seeded = block.seedKey ? RECONCILED_TIMELINE.find((moment) => moment.seedKey === block.seedKey) : undefined;
  if (seeded && seeded.startAt === block.startAt) return seeded.phase;
  const parsed = parseDayOfTime(block.startAt);
  if (parsed.kind !== "timed") return "untimed";
  const minutes = parsed.dayOffset * 1440 + parsed.minutes;
  if (minutes < 13 * 60) return "morning";
  if (minutes < 15 * 60 + 30) return "photos";
  if (minutes < 17 * 60) return "ceremony";
  return "evening";
}

export type ExistingTimelineRow = {
  id: string;
  seedKey: string | null;
  schedule: string;
  startAt: string;
  endAt: string | null;
  notes: string;
  sortOrder: number;
};

export type ReconciledWrite = {
  seedKey: string;
  schedule: "wedding" | "rehearsal";
  startAt: string;
  endAt: string | null;
  notes: string;
  sortOrder: number;
  startMinutes: number | null;
  endMinutes: number | null;
  dayOffset: number;
};

export type ReconciledPlan = {
  inserts: ReconciledWrite[];
  /**
   * Moments on the page that read differently from the document (usually the
   * owner's own edits). Apply leaves these alone; each can be switched back one at a time.
   */
  updates: Array<ReconciledWrite & { id: string; before: { startAt: string; endAt: string | null; title: string } }>;
  unchanged: string[];
  removals: Array<{ id: string; seedKey: string; title: string }>;
  /** Rows in the database the document does not mention. Left alone. */
  untouched: Array<{ id: string; seedKey: string | null; title: string; startAt: string }>;
};

/**
 * The key a row answers to: its seedKey, or, for the rehearsal rows the app seeded
 * before seed keys existed (their ids are "reh.checkin" and so on), the id itself.
 * Without this, Apply would add the seven rehearsal moments a second time.
 */
export function reconciledKeyForRow(row: { id: string; seedKey: string | null; schedule: string }): string | null {
  if (row.seedKey) return row.seedKey;
  if (row.schedule === "rehearsal" && RECONCILED_TIMELINE.some((moment) => moment.seedKey === row.id)) return row.id;
  return null;
}

export function planReconciledTimeline(existing: ExistingTimelineRow[]): ReconciledPlan {
  const plan: ReconciledPlan = { inserts: [], updates: [], unchanged: [], removals: [], untouched: [] };
  const wanted = new Set(RECONCILED_TIMELINE.map((moment) => moment.seedKey));
  const bySeed = new Map<string, ExistingTimelineRow>();
  for (const row of existing) {
    const key = reconciledKeyForRow(row);
    if (!key) continue;
    // A seeded row wins over a legacy row with the same key (see the duplicate check below).
    const current = bySeed.get(key);
    if (!current || (!current.seedKey && row.seedKey)) bySeed.set(key, row);
  }

  RECONCILED_TIMELINE.forEach((moment, index) => {
    const notes = reconciledNotes(moment);
    const write: ReconciledWrite = {
      seedKey: moment.seedKey,
      schedule: moment.schedule,
      startAt: moment.startAt,
      endAt: moment.endAt,
      notes,
      sortOrder: index,
      ...parsedTimeFields(moment.startAt, moment.endAt),
    };
    const row = bySeed.get(moment.seedKey);
    if (!row) {
      plan.inserts.push(write);
      return;
    }
    // Position is not compared: every save on the page renumbers sortOrder per
    // schedule, which would otherwise bring this card back for unchanged moments.
    if (row.startAt === write.startAt && (row.endAt ?? null) === write.endAt && row.notes === notes) {
      plan.unchanged.push(moment.seedKey);
      return;
    }
    plan.updates.push({
      ...write,
      id: row.id,
      before: { startAt: row.startAt, endAt: row.endAt, title: parseBlockNotes(row.notes).title },
    });
  });

  for (const row of existing) {
    const key = reconciledKeyForRow(row);
    if (key && wanted.has(key)) {
      if (bySeed.get(key) === row) continue;
      // An earlier Apply already added this rehearsal moment next to the legacy row.
      // The untouched legacy copy goes; one that was edited stays for the owner to merge.
      const seeded = REHEARSAL_LEGACY_NOTES.get(row.id);
      if (seeded !== undefined && seeded === row.notes) {
        plan.removals.push({ id: row.id, seedKey: key, title: parseBlockNotes(row.notes).title });
      } else {
        plan.untouched.push({ id: row.id, seedKey: row.seedKey, title: parseBlockNotes(row.notes).title, startAt: row.startAt });
      }
      continue;
    }
    const title = parseBlockNotes(row.notes).title;
    if (row.seedKey && RECONCILED_RETIRED_SEED_KEYS.includes(row.seedKey)) {
      plan.removals.push({ id: row.id, seedKey: row.seedKey, title });
    } else {
      plan.untouched.push({ id: row.id, seedKey: row.seedKey, title, startAt: row.startAt });
    }
  }
  return plan;
}

export function reconciledPlanIsEmpty(plan: ReconciledPlan): boolean {
  return plan.inserts.length === 0 && plan.removals.length === 0;
}
