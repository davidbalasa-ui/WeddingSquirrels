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
import { GETAWAY_DRIVER_CONTACT } from "@/lib/mini-moon";

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
const REHEARSAL_LEGACY_NOTE_SET = new Set(REHEARSAL_SCHEDULE_SEED.map((block) => block.notes));

/** David, 2026-10-10 20:32: "skila and Trinity and bri claimed their bunks make a note of that". */
export const BUNKS_NOTE = "Skila, Trinity and Bri claimed their bunks (David, Oct 10).";

/** David, 2026-10-10 20:40, his one-week check-in to the bridal party. */
export const NO_SIGNAL_NOTE =
  "Black Sheep Shelter has little to no internet or cell service. Save or screenshot the addresses, directions, and schedule before leaving the Airbnb.";

/**
 * David, 2026-10-10 21:08: "Add it" to Hawkshead's published golf dress code as the rehearsal
 * dinner outfit note. Quoted from https://www.hawksheadlinks.com/golf/rates.
 */
export const HAWKSHEAD_DRESS_CODE_NOTE =
  "Hawkshead golf dress code for the wedding party and guests (hawksheadlinks.com/golf/rates). Men: collared shirts with sleeves, slacks, golf shorts, or walking shorts are recommended; blue jeans and t-shirts are discouraged. Women: dresses, skirts, slacks, golf shorts, mid-length shorts, and blouses are recommended; halter tops, t-shirts, sweatpants, blue jeans, tennis dresses, athletic-style shorts, and cut-offs are not permitted.";

/** David, 2026-10-10 20:37: "get ready clothes for the bridal party is black for Friday morning". */
/** David, 2026-10-10 22:27, on "Confirm who has check-in access.": "Its not an open item, haley will be getting the access". */
export const CHECKIN_ACCESS_NOTE = "Haley will be getting the access (David, Oct 10).";
export const BLACK_CLOTHES_NOTE = "Get ready clothes for the bridal party are black (David, Oct 10).";
/** David, 2026-10-11: Dan's phone for the getaway vehicle; the same number the contacts print. */
const GETAWAY_DRIVER_PHONE = GETAWAY_DRIVER_CONTACT.phone;
/** David, 2026-10-11 15:13: "1:30 is the first look with dad, straight into parent photos." */
export const HALEY_DAD_FIRST_LOOK = "Haley’s first look with her dad, then straight into parent photos (David, Oct 11).";
/** David, 2026-10-11 15:13: "Avalon will be releasing tables. she will take care of it ... she is responsible." */
export const AVALON_RELEASES_TABLES = "Avalon releases the tables and is responsible for it (David, Oct 11).";
/** David, 2026-10-11 15:13: "john will be dropping off the car, but its going to be with someone else, we just dont know who." */
/** David, 2026-10-11 15:21: Harmony does not walk in the processional; "she will sit with her mom". */
export const HARMONY_SITS_WITH_MOM = "Harmony does not walk in the processional; she sits with her mom (David, Oct 11).";
export const JOHN_DROPS_OFF_CAR = "John drops off the car with someone else, who is not known yet (David, Oct 11).";

const W = "wedding" as const;
const R = "rehearsal" as const;

export const RECONCILED_TIMELINE: ReconciledMoment[] = [
  // Thursday
  { seedKey: "reh.checkin", schedule: R, phase: "rehearsal", startAt: "1:00 PM", endAt: "2:30 PM", title: "Airbnb check in",
    location: "Airbnb, 10268 51st St, Grand Junction, MI 49056",
    lines: ["Wedding party arrives and chooses rooms.", BUNKS_NOTE, "David and Haley plan to arrive around 1:00 PM.", CHECKIN_ACCESS_NOTE] },
  { seedKey: "reh.getready", schedule: R, phase: "rehearsal", startAt: "2:30 PM", endAt: "3:45 PM", title: "Get ready",
    lines: ["Hair, makeup, clothing, and final items before departure.", "Victoria meets the group at Hawkshead; Braxton meets the group at the reception/rehearsal.", NO_SIGNAL_NOTE],
    openItems: "Confirm whether anyone else will skip the Airbnb arrival window." },
  { seedKey: "reh.depart-airbnb", schedule: R, phase: "rehearsal", startAt: "3:45 PM", endAt: null, title: "Depart for Hawkshead",
    location: "Hawkshead, 523 Hawks Nest Dr, South Haven, MI 49090", lines: ["Allow 25–30 minutes."] },
  { seedKey: "reh.dinner", schedule: R, phase: "rehearsal", startAt: "4:15 PM", endAt: "5:40 PM", title: "Rehearsal dinner",
    lines: ["Dinner, welcome toasts, reminders, and logistics.", HAWKSHEAD_DRESS_CODE_NOTE] },
  { seedKey: "reh.depart-bss", schedule: R, phase: "rehearsal", startAt: "5:40 PM", endAt: null, title: "Depart for Black Sheep Shelter",
    lines: ["Allow 10–15 minutes."] },
  { seedKey: "reh.ceremony", schedule: R, phase: "rehearsal", startAt: "6:00 PM", endAt: "7:00 PM", title: "Ceremony rehearsal",
    lines: ["Practice processional, ceremony positions, recessional, and immediate marriage-license signing flow."] },
  { seedKey: "reh.return", schedule: R, phase: "rehearsal", startAt: "7:15 PM", endAt: null, title: "Return to the Airbnb",
    lines: ["Steam dresses and suits.", "Dessert and game night, most likely back at the Airbnb, although that detail is still being finalized."], openItems: "Confirm the dessert plan and final location." },

  // Friday morning
  { seedKey: "wedding_hair_rotation_1", schedule: W, phase: "morning", startAt: "9:00 AM", endAt: "10:00 AM", title: "Wedding party first hair and makeup rotation",
    lines: ["Hair: Braxton in Bathroom 1; Andi in Bathroom 2; Kaylie in Bathroom 3.", "Makeup: Bri and Trinity in Bedroom 1; Victoria and Skila in Bedroom 3.", BLACK_CLOTHES_NOTE] },
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
  { seedKey: "wedding_party_leaves", schedule: W, phase: "morning", startAt: "12:00 PM", endAt: "12:30 PM", title: "Wedding party leaves and private vows",
    lines: ["Wedding party leaves for Black Sheep Shelter.", NO_SIGNAL_NOTE, "David and Haley remain briefly for private vows with Belle."] },
  { seedKey: "wedding_vendor_arrival", schedule: W, phase: "morning", startAt: "12:15 PM", endAt: "12:30 PM", title: "Wedding party arrives at Black Sheep Shelter",
    lines: ["Remove dresses from bags and complete hair and makeup touch-ups."] },
  { seedKey: "wedding_couple_departs", schedule: W, phase: "morning", startAt: "12:30 PM", endAt: null, title: "David, Haley and Belle depart",
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
    lines: [HALEY_DAD_FIRST_LOOK, "Haley with parents.", "Haley with mom.", "Haley with dad."] },
  // David, 2026-10-11 12:29: "At 1:45 pm, have David's first look with the girls".
  { seedKey: "wedding_david_girls_first_look", schedule: W, phase: "photos", startAt: "1:45 PM", endAt: null, title: "David’s first look with the girls",
    lines: [] },
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
    lines: ["Guests may begin arriving at 3:00 PM.", "Bathroom, water, touch-ups, and schedule recovery if portraits run long."] },
  { seedKey: "wedding_ring_security", schedule: W, phase: "photos", startAt: "3:00 PM", endAt: "3:30 PM", title: "Harmony on ring security",
    location: "Entry table",
    lines: ["Harmony is on ring security and stands next to the entry table for the half hour before the ceremony starts."] },
  { seedKey: "wedding_pre_ceremony", schedule: W, phase: "photos", startAt: "3:15 PM", endAt: "3:30 PM", title: "Get ready for the ceremony",
    lines: ["Wedding party moves out of guest view.", "Guests are seated.", "3:20 PM — wedding party lines up.", "Barry photographs ceremony details and guest arrivals.", "No early bar service is planned."] },

  // Ceremony and cocktail hour
  // David, 2026-10-11 12:31: "Change the ceremony to 3:30 to 3:50 and the signing will be [3:50] to 4:00".
  { seedKey: "wedding_ceremony", schedule: W, phase: "ceremony", startAt: "3:30 PM", endAt: "3:50 PM", title: "Ceremony",
    location: "Under the shelter", lines: [HARMONY_SITS_WITH_MOM] },
  { seedKey: "wedding_license_signing", schedule: W, phase: "ceremony", startAt: "3:50 PM", endAt: "4:00 PM", title: "Sign the marriage license",
    lines: ["Immediately after the recessional.", "David, Haley, Marie, and the witnesses move directly to the signing table.", "Andi (Best Man) and Braxton (Maid of Honor) are the witnesses and are in charge of the license and pen."] },
  // David, 2026-10-11 12:46: "Cocktail hour ends at 5."
  { seedKey: "wedding_cocktail_hour", schedule: W, phase: "ceremony", startAt: "4:00 PM", endAt: "5:00 PM", title: "Cocktail hour and bar opening",
    lines: [
      "Bartender arrives at 3:00 PM (David, Oct 10).",
      "Bar service begins at 4:00 PM.",
      "Guests receive drinks and appetizers while photography continues.",
    ] },
  { seedKey: "wedding_final_touchups", schedule: W, phase: "ceremony", startAt: "4:45 PM", endAt: "4:50 PM", title: "Final touch-ups",
    lines: ["Bathroom break, touch-ups, and prepare for entrance."] },
  // David, 2026-10-11 12:42 and 12:44: "Last cocktail poures ending in 10 min" ... "The last pour announcement needs
  // to be at 10 minutes till the end of cocktail hour" (cocktail hour ends at 5:00).
  { seedKey: "wedding_last_pour", schedule: W, phase: "ceremony", startAt: "4:50 PM", endAt: null, title: "Last cocktail pours",
    lines: ["MC cue 4:50 PM: Last cocktail pours, ending in 10 minutes."] },
  { seedKey: "wedding_entrance_lineup", schedule: W, phase: "ceremony", startAt: "4:50 PM", endAt: "5:00 PM", title: "Wedding party lines up",
    lines: ["Guests move to dinner seating.", "MC confirms names and entrance order."],
    openItems: "Give Wendy the entrance order and make sure she knows how to say every name." },

  // Dinner, dances and evening
  { seedKey: "wedding_dinner", schedule: W, phase: "evening", startAt: "5:00 PM", endAt: null, title: "Grand entrance and dinner begins",
    lines: ["Grand entrance starts at 5:00 PM.", "Immediately after the entrance, David and Haley get their food.", "Once David and Haley have food, tables are called up.", "Precious Peony serves out of the food truck (David, Oct 10).", AVALON_RELEASES_TABLES] },
  { seedKey: "wedding_dinner_service", schedule: W, phase: "evening", startAt: "5:00 PM", endAt: "6:00 PM", title: "Dinner service",
    lines: ["Guests eat while the couple circulates only as time permits.", "Prepare toast speakers near the end of dinner."] },
  // David, 2026-10-11 12:44: "we just need to start toasts 10 minutes earlier ... And then 6:15 will work for the dance announcement."
  { seedKey: "wedding_toasts_cake", schedule: W, phase: "evening", startAt: "5:50 PM", endAt: "6:05 PM", title: "Toasts",
    lines: ["MC cue 5:50 PM: \"As dinner winds down, please return to your seats.\"", "Best man, MOH, and FOB toasts."],
    openItems: "Confirm the toast order and how long each person gets." },
  { seedKey: "wedding_cake_cutting", schedule: W, phase: "evening", startAt: "6:05 PM", endAt: null, title: "Cake cutting",
    lines: [
      "Cut the cake immediately after toasts.",
      "Photographer and videographer are cued before cutting begins.",
      "Cake placed in center and desserts rotated around on the glass plates on small plates (David, Oct 10).",
    ] },
  // David, 2026-10-11 12:37: "we need an announcement from the MC to clear the center area and turn your chairs to the
  // middle of the walk area for the bride and groom's first dance. Followed by the bride and her father." 12:44: at 6:15.
  { seedKey: "wedding_first_dance_announcement", schedule: W, phase: "evening", startAt: "6:15 PM", endAt: null, title: "Clear the center for the first dance",
    lines: ["MC cue 6:15 PM: Clear the center area and turn your chairs to the middle of the walk area for the bride and groom’s first dance, followed by the bride and her father."] },
  { seedKey: "wedding_first_dances", schedule: W, phase: "evening", startAt: "6:20 PM", endAt: "6:45 PM", title: "Formal dances",
    lines: ["First dance.", "Father of the bride dance.", "Any additional formal dance must be confirmed before the event."] },
  { seedKey: "wedding_golden_hour", schedule: W, phase: "evening", startAt: "6:23 PM", endAt: "7:18 PM", title: "Golden-hour photos",
    lines: ["Golden hour in South Haven is about 6:23–7:18 PM.", "Sunset is approximately 7:01 PM.", "Plan for outdoor photos from 6:45–6:55 PM."],
    openItems: "Ask Barry to confirm the best 10 minutes for outdoor photos." },
  // David, 2026-10-11 15:18: "bonfire time start is 7PM".
  // 15:21: "smores are at 7".
  { seedKey: "wedding_bonfire", schedule: W, phase: "evening", startAt: "7:00 PM", endAt: null, title: "Bonfire and s’mores",
    lines: [] },
  { seedKey: "wedding_open_dancing", schedule: W, phase: "evening", startAt: "7:00 PM", endAt: "8:00 PM", title: "Open dancing",
    lines: ["Dance floor opens and the couple stays on the floor as much as possible."] },
  { seedKey: "wedding_children_ready", schedule: W, phase: "evening", startAt: "8:00 PM", endAt: null, title: "Goodbyes to the kids and goodbye song",
    lines: ["We say our goodbyes to the kids and have a goodbye song (David, Oct 10).", "Parents gather belongings and prepare children to leave."] },
  { seedKey: "wedding_music_change", schedule: W, phase: "evening", startAt: "8:15 PM", endAt: null, title: "Music change",
    lines: ["Shift to the later-evening music plan."] },
  // David, 2026-10-11 15:25: Dan arrives at 8:30; the moment reads 8:30 PM ("yes").
  { seedKey: "wedding_getaway_arrives", schedule: W, phase: "evening", startAt: "8:30 PM", endAt: null, title: "Getaway vehicle arrives",
    lines: ["MOB or another helper meets Dan Vandenheede.", "Show Dan where to park, give him the “Just Married” sign, and tell the groom.", "Keep the vehicle details secret from the bride.", `Dan’s phone: ${GETAWAY_DRIVER_PHONE} (David, Oct 11).`, JOHN_DROPS_OFF_CAR],
    openItems: "Confirm MOB will meet Dan." },
  { seedKey: "wedding_dollar_dance", schedule: W, phase: "evening", startAt: "8:30 PM", endAt: "8:40 PM", title: "Dollar dance",
    lines: ["MC announces the dollar dance.", "Barry photographs the dance."] },
  { seedKey: "wedding_getaway_photos", schedule: W, phase: "evening", startAt: "8:40 PM", endAt: "8:50 PM", title: "Getaway vehicle photos",
    lines: ["David and Haley step outside for a 10-minute portrait set.", "Afterward, the MC may invite guests to view and photograph the vehicle without revealing details early."] },
  { seedKey: "wedding_night_sky_photos", schedule: W, phase: "evening", startAt: "8:50 PM", endAt: "9:00 PM", title: "Night-sky photos and Barry finishes",
    lines: ["Final outdoor portraits with Barry.", "Return to dancing at 9:00 PM."] },
  { seedKey: "wedding_open_dancing_2", schedule: W, phase: "evening", startAt: "9:00 PM", endAt: "9:45 PM", title: "Open dancing",
    lines: ["David and Haley return to the dance floor."] },
  { seedKey: "wedding_last_dance", schedule: W, phase: "evening", startAt: "9:45 PM", endAt: null, title: "Last open dance",
    lines: ["“Moon” by Logan Bowden."] },
  { seedKey: "wedding_private_dance", schedule: W, phase: "evening", startAt: "9:55 PM", endAt: null, title: "Private final dance",
    lines: ["Guests clear the dance floor while David and Haley have a private final dance."] },
  { seedKey: "wedding_reception_ends", schedule: W, phase: "evening", startAt: "10:00 PM", endAt: null, title: "Reception ends",
    lines: ["Guest departure and final send-off if used."] },
  { seedKey: "wedding_teardown", schedule: W, phase: "evening", startAt: "10:00 PM", endAt: "11:00 PM", title: "Tear down and cleanup",
    lines: ["Wendy is in charge of teardown.", "Pack decor, gifts, personal belongings, remaining food, and vendor items."] },
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

/**
 * Retired moments exactly as an earlier Apply wrote them. The 4:05 family photos (grandparents,
 * Haley's paternal and maternal sides) came off the day on 9 Oct; David, 2026-10-11 12:31:
 * "I never asked for pictures of grandparents and I keep telling you to remove them."
 */
const RETIRED_AS_THE_APP_WROTE_THEM: Record<string, { startAt: string; endAt: string | null; notes: string; correction: string }> = {
  wedding_family_photos_after: {
    startAt: "4:05 PM",
    endAt: "4:30 PM",
    notes: reconciledNotes({
      seedKey: "wedding_family_photos_after",
      schedule: "wedding",
      phase: "ceremony",
      startAt: "4:05 PM",
      endAt: "4:30 PM",
      title: "Family photos after the ceremony",
      lines: [
        "Haley with Grandma; Haley with Grandpa; Haley with grandparents.",
        "Couple with grandparents.",
        "Couple with Haley’s paternal side of the family.",
        "Couple with Haley’s maternal side of the family.",
      ],
      openItems: "Tell the grandparents and extended family to stay near the ceremony area, and choose someone to gather them.",
    }),
    correction: "no grandparent photos",
  },
};

export function reconciledNotes(moment: ReconciledMoment): string {
  const detailLines = [...moment.lines];
  if (moment.openItems) detailLines.push(`Open items: ${moment.openItems}`);
  return composeBlockNotes({ title: moment.title, location: moment.location ?? null, detailLines });
}

/**
 * Earlier wordings of a moment as the app itself wrote them. A row that still reads
 * exactly like one was never edited, so Apply brings it up to date; any other wording
 * is the owner's and stays.
 */
type EarlierWording = Partial<Pick<ReconciledMoment, "title" | "lines" | "openItems" | "location" | "startAt" | "endAt">> & { correction: string };

const EARLIER_WORDINGS: Record<string, EarlierWording[]> = {
  // David, 2026-10-10: Skila, Trinity and Bri claimed their bunks; his check-in gave the Airbnb address.
  "reh.checkin": [
    {
      lines: ["Wedding party arrives and chooses rooms.", "David and Haley plan to arrive around 1:00 PM."],
      location: undefined,
      openItems: "Confirm the Airbnb address and who has check-in access.",
      correction: "bunks noted, Airbnb address",
    },
    // David, 2026-10-10 22:27: "Its not an open item, haley will be getting the access".
    {
      lines: ["Wedding party arrives and chooses rooms.", BUNKS_NOTE, "David and Haley plan to arrive around 1:00 PM."],
      openItems: "Confirm who has check-in access.",
      correction: "Haley has check-in access",
    },
  ],
  // David's one-week check-in, 2026-10-10 20:40.
  "reh.getready": [
    {
      lines: ["Hair, makeup, clothing, and final items before departure.", "Victoria meets the group at Hawkshead; Braxton meets the group at the reception/rehearsal."],
      correction: "no cell service at Black Sheep",
    },
  ],
  "reh.dinner": [{ lines: ["Dinner, welcome toasts, reminders, and logistics."], correction: "Hawkshead dress code" }],
  // The places source spells it one way (wedding-venue.ts); every printout now matches.
  "reh.depart-airbnb": [
    { location: "Hawkshead, 523 Hawks Nest Drive, South Haven", correction: "one Hawkshead address" },
    // David, 2026-10-11 15:21: "[Hawk's Head's ZIP code] you have this or could look it up." 49090.
    { location: "Hawkshead, 523 Hawks Nest Dr, South Haven, MI", correction: "Hawkshead ZIP 49090" },
  ],
  "reh.return": [{ lines: ["Steam dresses and suits.", "Dessert and game night."], correction: "dessert most likely at the Airbnb" }],
  wedding_party_leaves: [
    {
      endAt: "12:20 PM",
      lines: ["Wedding party leaves for Black Sheep Shelter.", "David and Haley remain briefly for private vows with Belle."],
      correction: "until 12:30 PM, no cell service at Black Sheep",
    },
  ],
  wedding_couple_departs: [{ startAt: "12:20 PM", endAt: "12:30 PM", correction: "leave at 12:30 PM" }],
  // The moment's own line already names who toasts (best man, MOH, FOB); only order and length are open.
  wedding_toasts_cake: [
    {
      startAt: "6:00 PM",
      endAt: "6:15 PM",
      lines: ["Best man, MOH, and FOB toasts."],
      openItems: "Confirm who is giving a toast, the order, and how long each person gets.",
      correction: "toasts: who is set",
    },
    // David, 2026-10-11 12:44 and 12:46: toasts start 10 minutes earlier, with the MC's cue at 5:50.
    { startAt: "6:00 PM", endAt: "6:15 PM", lines: ["Best man, MOH, and FOB toasts."], correction: "toasts 5:50–6:05 PM" },
  ],
  wedding_first_dances: [{ startAt: "6:25 PM", correction: "first dance at 6:20 PM" }],
  // David, 2026-10-10 22:00: "8 Is when we say our good byes to the kids and have a good bye song
  // and then music changes at 8:15. Close the open item".
  wedding_children_ready: [
    { title: "Children get ready to leave", lines: ["Parents gather belongings and prepare children to leave."], correction: "goodbyes to the kids at 8:00" },
  ],
  wedding_music_change: [
    {
      title: "Music change and children’s send-off",
      lines: ["Shift to the later-evening music plan.", "Pause for the children’s farewell/send-off."],
      openItems: "Confirm each child’s ride and whether children leave at 8:00 PM or after the 8:15 PM send-off.",
      correction: "music change only, open item closed",
    },
  ],
  // David, 2026-10-10 22:03: "Close this open item out".
  wedding_last_dance: [{ openItems: "Confirm the correct version of “Moon” with the person handling the music.", correction: "Moon confirmed" }],
  // David, 2026-10-10 22:04: "Wendy is in charge of teardown" / "close it".
  wedding_teardown: [
    {
      lines: ["Pack decor, gifts, personal belongings, remaining food, and vendor items."],
      openItems: "Choose who cleans each area and who takes the gifts, decor, food, alcohol, and personal items.",
      correction: "Wendy on teardown",
    },
  ],
  // David, 2026-10-10 22:05: "bartender arrives at 3 pm, will be ready by 4, close it out".
  wedding_cocktail_hour: [
    {
      lines: ["Bar service begins at 4:00 PM.", "Guests receive drinks and appetizers while photography continues."],
      openItems: "Confirm the bar will be ready at 4:00 PM.",
      correction: "bartender at 3:00 PM, bar ready by 4:00",
    },
    // David, 2026-10-11 12:33: the 3:00 line carries one time, not "ready by 4".
    {
      lines: [
        "Bartender arrives at 3:00 PM and will be ready by 4:00 PM (David, Oct 10).",
        "Bar service begins at 4:00 PM.",
        "Guests receive drinks and appetizers while photography continues.",
      ],
      correction: "bartender line carries only 3:00 PM",
    },
  ],
  // David, 2026-10-11 12:31: ceremony 3:30–3:50 PM, signing 3:50–4:00 PM, cocktail hour at 4:00 PM.
  wedding_ceremony: [
    { endAt: "4:00 PM", lines: [], correction: "ceremony ends 3:50 PM" },
    // David, 2026-10-11 15:21: "[Does Harmony walk in the processional?] no, she will sit with her mom."
    { lines: [], correction: "Harmony sits with her mom" },
  ],
  wedding_license_signing: [{ startAt: "4:00 PM", endAt: null, correction: "signing 3:50–4:00 PM" }],
  // The app's first wording asked about grandparent photos; David never asked for them (2026-10-11 12:31).
  wedding_david_photos: [
    {
      lines: ["David solo portraits and groom-party candids.", "Barry positions David and clears the first-look area."],
      openItems: "Add any photos wanted with David’s parents, grandparents, or extended family.",
      correction: "no grandparent photos",
    },
  ],
  // David, 2026-10-10 22:27: "not sure about the call but precious peony serves out of the food truck".
  wedding_dinner: [
    // David, 2026-10-11 15:13: Avalon releases the tables.
    {
      lines: ["Grand entrance starts at 5:00 PM.", "Immediately after the entrance, David and Haley get their food.", "Once David and Haley have food, tables are called up.", "Precious Peony serves out of the food truck (David, Oct 10)."],
      openItems: "Choose who calls tables.",
      correction: "Avalon releases the tables",
    },
    {
      lines: ["Grand entrance starts at 5:00 PM.", "Immediately after the entrance, David and Haley get their food.", "Once David and Haley have food, tables are called up."],
      openItems: "Choose who calls tables and confirm how Precious Peony will serve dinner.",
      correction: "Precious Peony serves from the food truck",
    },
  ],
  // David, 2026-10-10 22:06: "Add, Cake placed in center and desserts rotated around on the glass plates on small plates".
  wedding_cake_cutting: [
    {
      lines: ["Cut the cake immediately after toasts.", "Photographer and videographer are cued before cutting begins."],
      startAt: "6:15 PM",
      openItems: "Confirm when the cake arrives, who receives it, and who has the knife, plates, and serving plan.",
      correction: "cake and dessert layout",
    },
    // David, 2026-10-10 22:15, of the rest of the cake question: "close it".
    {
      lines: [
        "Cut the cake immediately after toasts.",
        "Photographer and videographer are cued before cutting begins.",
        "Cake placed in center and desserts rotated around on the glass plates on small plates (David, Oct 10).",
      ],
      startAt: "6:15 PM",
      openItems: "Confirm when the cake arrives, who receives it, and who has the knife.",
      correction: "cake question closed",
    },
    // David, 2026-10-11 12:44: desserts move up with the toasts.
    { startAt: "6:15 PM", correction: "cake at 6:05 PM" },
  ],
  wedding_quiet_time: [
    {
      lines: ["Wedding party moves out of guest view.", "Bathroom, water, touch-ups, and schedule recovery if portraits run long."],
      correction: "guests from 3:00 PM",
    },
  ],
  wedding_pre_ceremony: [
    {
      lines: ["Guests arrive and are seated.", "Wedding party lines up.", "Barry photographs ceremony details and guest arrivals.", "No early bar service is planned."],
      correction: "hide away 3:15 PM, line up 3:20 PM",
    },
  ],
  // David, 2026-10-10: the bridal party's get ready clothes are black.
  wedding_hair_rotation_1: [
    {
      lines: ["Hair: Braxton in Bathroom 1; Andi in Bathroom 2; Kaylie in Bathroom 3.", "Makeup: Bri and Trinity in Bedroom 1; Victoria and Skila in Bedroom 3."],
      correction: "black get ready clothes",
    },
  ],
  // David, 2026-10-11 15:13: Haley's first look with her dad opens the 1:30 parent photos.
  wedding_haley_family_photos: [
    {
      lines: ["Haley with parents.", "Haley with mom.", "Haley with dad.", "Haley first look with Dad."],
      correction: "first look with dad at 1:30 PM",
    },
  ],
  // David, 2026-10-10: the driver is Dan, not San (the document had it wrong).
  wedding_getaway_arrives: [
    {
      lines: ["MOB or another helper meets San Vandenheede.", "Show San where to park, give him the “Just Married” sign, and tell the groom.", "Keep the vehicle details secret from the bride."],
      openItems: "Confirm MOB will meet San and give her his phone number and arrival time.",
      startAt: "8:20 PM",
      endAt: "8:35 PM",
      correction: "San → Dan",
    },
    // David, 2026-10-11: "269-635-8458 is dans phone number for the get away vehicle".
    {
      lines: ["MOB or another helper meets Dan Vandenheede.", "Show Dan where to park, give him the “Just Married” sign, and tell the groom.", "Keep the vehicle details secret from the bride."],
      openItems: "Confirm MOB will meet Dan and give her his phone number and arrival time.",
      startAt: "8:20 PM",
      endAt: "8:35 PM",
      correction: "Dan’s phone, arrives 8:30 PM",
    },
  ],
};

/** The correction for a row that still reads, and is timed, exactly as the app wrote it earlier. */
function earlierWording(moment: ReconciledMoment, row: { notes: string; startAt: string; endAt: string | null }): string | null {
  const match = (EARLIER_WORDINGS[moment.seedKey] ?? []).find((wording) => {
    const earlier = { ...moment, ...wording };
    return reconciledNotes(earlier) === row.notes && earlier.startAt === row.startAt && (earlier.endAt ?? null) === (row.endAt ?? null);
  });
  return match ? match.correction : null;
}

/**
 * Whether Thursday's check-in moment has, or will be given, the bunks note: it reads as the
 * document, or still as the app first wrote it. A moment David reworded himself does not.
 */
export function checkinCarriesBunksNote(notes: string): boolean {
  const moment = RECONCILED_TIMELINE.find((row) => row.seedKey === "reh.checkin")!;
  return notes === reconciledNotes(moment) || earlierWording(moment, { notes, startAt: moment.startAt, endAt: moment.endAt }) !== null;
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
  /**
   * Retired moments David asked to have taken off, still reading exactly as the app wrote
   * them: removed without a tap. One he edited himself stays in `removals` for his tap.
   */
  drops?: Array<{ id: string; seedKey: string; title: string; notes: string; correction: string }>;
  /** Moments still worded exactly as the app first wrote them, brought up to the document's corrected wording. */
  rewords: Array<ReconciledWrite & { id: string; correction: string; before: { startAt: string; endAt: string | null; title: string } }>;
  /** Rows in the database the document does not mention. Left alone. */
  untouched: Array<{ id: string; seedKey: string | null; title: string; startAt: string }>;
  /**
   * A rehearsal moment on the page twice where both copies were edited: Apply removes
   * neither, and the owner picks which one stays.
   */
  doubles: Array<{
    startAt: string;
    mine: { id: string; title: string };
    document: { id: string; title: string };
  }>;
};

/**
 * The key a row answers to: its seedKey, or, for the rehearsal rows the app seeded
 * before seed keys existed (their ids are "reh.checkin" and so on), the id itself.
 * Without this, Apply would add the seven rehearsal moments a second time.
 */
export function reconciledKeyForRow(row: {
  id: string;
  seedKey: string | null;
  schedule: string;
  notes?: string;
}): string | null {
  if (row.seedKey) return row.seedKey;
  if (row.schedule !== "rehearsal") return null;
  if (RECONCILED_TIMELINE.some((moment) => moment.seedKey === row.id)) return row.id;
  // The same original rehearsal row saved under another id still answers to its moment.
  const seeded = row.notes === undefined ? undefined : REHEARSAL_SCHEDULE_SEED.find((block) => block.notes === row.notes);
  return seeded ? seeded.id : null;
}

const TITLE_STOPWORDS = new Set(["with", "from", "into", "the", "and", "for"]);

function titleWords(notes: string): Set<string> {
  const first = parseBlockNotes(notes).title.split(";")[0] ?? "";
  return new Set(
    first
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((word) => word.length >= 4 && !TITLE_STOPWORDS.has(word)),
  );
}

/**
 * A rehearsal row with no key, typed or saved before keys existed, that is plainly the
 * same moment as a document one: same start time and a shared title word ("Dinner" and
 * "Rehearsal dinner", "Return to Airbnb" and "Return to the Airbnb").
 */
function sameRehearsalMoment(row: ExistingTimelineRow, moment: ReconciledMoment): boolean {
  if (row.schedule !== "rehearsal" || moment.schedule !== "rehearsal") return false;
  if (row.startAt !== moment.startAt) return false;
  const words = titleWords(row.notes);
  return [...titleWords(moment.title)].some((word) => words.has(word));
}

function plainWords(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Whether a short rehearsal row adds nothing to the full moment beside it: every line and
 * place it gives, past its title, is already in the full moment's words.
 */
function saysNothingMore(shortNotes: string, fullNotes: string): boolean {
  const parsed = parseBlockNotes(shortNotes);
  const full = plainWords(fullNotes);
  const pieces = [
    ...parsed.title.split(";").slice(1),
    ...parsed.detailLines.flatMap((line) => line.split(";")),
    ...(parsed.location ? [parsed.location] : []),
  ]
    .map((piece) => plainWords(piece.replace(/^\s*[-–•]\s*/, "")))
    .filter(Boolean);
  return pieces.every((piece) => full.includes(piece));
}

export function planReconciledTimeline(existing: ExistingTimelineRow[]): ReconciledPlan {
  const plan: ReconciledPlan = { inserts: [], updates: [], rewords: [], unchanged: [], removals: [], drops: [], untouched: [], doubles: [] };
  const wanted = new Set(RECONCILED_TIMELINE.map((moment) => moment.seedKey));
  const bySeed = new Map<string, ExistingTimelineRow>();
  for (const row of existing) {
    const key = reconciledKeyForRow(row);
    if (!key) continue;
    // A seeded row wins over a legacy row with the same key (see the duplicate check below).
    const current = bySeed.get(key);
    if (!current || (!current.seedKey && row.seedKey)) bySeed.set(key, row);
  }

  // Rehearsal rows with no key at a document moment's time: the same moment, never a second copy.
  const removedIds = new Set<string>();
  for (const moment of RECONCILED_TIMELINE) {
    if (moment.schedule !== "rehearsal") continue;
    const keyed = bySeed.get(moment.seedKey);
    // The owner's own copy: a row with no key at this moment's time, or the original row
    // for this moment (no seed key) once its wording was changed.
    const twin = existing.find(
      (row) =>
        row !== keyed &&
        !row.seedKey &&
        !REHEARSAL_LEGACY_NOTE_SET.has(row.notes) &&
        (reconciledKeyForRow(row) === moment.seedKey || (!reconciledKeyForRow(row) && sameRehearsalMoment(row, moment))),
    );
    if (!twin) continue;
    if (!keyed) {
      // Apply matches it instead of adding the document's copy beside it.
      bySeed.set(moment.seedKey, twin);
      continue;
    }
    if (!keyed.seedKey) continue;
    // Both are on the page. The document's copy nobody edited carries every correction he has
    // sent since (David, 2026-10-10: keep the full moments). His older short row goes on his
    // Apply tap only when it says nothing the full copy does not; otherwise he picks.
    const docNotes = reconciledNotes(moment);
    const docUnchanged =
      keyed.startAt === moment.startAt && (keyed.endAt ?? null) === moment.endAt && keyed.notes === docNotes;
    if (docUnchanged && saysNothingMore(twin.notes, docNotes)) {
      plan.removals.push({ id: twin.id, seedKey: moment.seedKey, title: parseBlockNotes(twin.notes).title });
      removedIds.add(twin.id);
    } else {
      plan.doubles.push({
        startAt: twin.startAt,
        mine: { id: twin.id, title: parseBlockNotes(twin.notes).title },
        document: { id: keyed.id, title: parseBlockNotes(keyed.notes).title },
      });
    }
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
    const change = {
      ...write,
      id: row.id,
      before: { startAt: row.startAt, endAt: row.endAt, title: parseBlockNotes(row.notes).title },
    };
    const correction = earlierWording(moment, row);
    if (correction) plan.rewords.push({ ...change, correction });
    else plan.updates.push(change);
  });

  const claimed = new Set([...bySeed.values()].map((row) => row.id));
  for (const row of existing) {
    if (removedIds.has(row.id)) continue;
    if (claimed.has(row.id) && !row.seedKey && [...bySeed.values()].includes(row)) continue;
    const key = reconciledKeyForRow(row);
    if (key && wanted.has(key)) {
      if (bySeed.get(key) === row) continue;
      // An earlier Apply already added this rehearsal moment next to the legacy row.
      // The untouched legacy copy goes; one that was edited stays for the owner to merge.
      if (REHEARSAL_LEGACY_NOTE_SET.has(row.notes) && !row.seedKey) {
        plan.removals.push({ id: row.id, seedKey: key, title: parseBlockNotes(row.notes).title });
      } else {
        plan.untouched.push({ id: row.id, seedKey: row.seedKey, title: parseBlockNotes(row.notes).title, startAt: row.startAt });
      }
      continue;
    }
    const title = parseBlockNotes(row.notes).title;
    if (row.seedKey && RECONCILED_RETIRED_SEED_KEYS.includes(row.seedKey)) {
      const asWritten = RETIRED_AS_THE_APP_WROTE_THEM[row.seedKey];
      if (asWritten && asWritten.notes === row.notes && asWritten.startAt === row.startAt && asWritten.endAt === (row.endAt ?? null)) {
        plan.drops!.push({ id: row.id, seedKey: row.seedKey, title, notes: row.notes, correction: asWritten.correction });
      } else {
        plan.removals.push({ id: row.id, seedKey: row.seedKey, title });
      }
    } else {
      plan.untouched.push({ id: row.id, seedKey: row.seedKey, title, startAt: row.startAt });
    }
  }
  return plan;
}

/**
 * The Thursday rows a printout shows: a row Apply would fold into another moment (his older
 * short copy beside the document's full one, or an untouched first-seed copy) prints once,
 * as the moment that stays, before he has tapped Apply.
 */
export function rehearsalRowsToPrint<T extends ExistingTimelineRow>(rows: T[]): T[] {
  const plan = planReconciledTimeline(rows);
  const folded = new Set([...plan.removals, ...(plan.drops ?? [])].map((row) => row.id));
  return rows.filter((row) => !folded.has(row.id));
}

/** Friday's rows a printout shows: a moment David took off the day never prints, tapped or not. */
export const weddingRowsToPrint = rehearsalRowsToPrint;

export function reconciledPlanIsEmpty(plan: ReconciledPlan): boolean {
  return plan.inserts.length === 0 && plan.removals.length === 0 && (plan.drops ?? []).length === 0 && (plan.rewords ?? []).length === 0;
}

/** The other copy of a doubled moment, when `keepId` is one of a pair the owner can choose between. */
export function doubledMomentToRemove(plan: ReconciledPlan, keepId: string): string | null {
  for (const pair of plan.doubles) {
    if (pair.mine.id === keepId) return pair.document.id;
    if (pair.document.id === keepId) return pair.mine.id;
  }
  return null;
}
