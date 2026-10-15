import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBlockNotes } from "./day-of-now";
import { SCHEDULE_DAY_JOBS, planDayJobRewords } from "./day-job-corrections";
import { CAKE_CUE, CAKE_CUE_OCT14, TOASTS_CUE, TOASTS_CUE_OCT14 } from "./evening-cues";
import { withLineCorrections } from "./line-corrections";
import { planPlaybookRewords } from "./playbook-corrections";
import { projectHairMakeup } from "./print-projection";
import { AVALON_TIME_FRAME, RECONCILED_TIMELINE, ROTATION_PRACTICE, WENDY_MEETS_AVALON, planReconciledTimeline, reconciledNotes } from "./reconciled-timeline";

// David, 2026-10-13 22:01: "Avalon is now planning on 11 am to 7 pm for her time frame".
const OLD_VENUE = [
  "Set up the venue",
  "location: Black Sheep Shelter",
  "Black Sheep Shelter access begins at 10:30 AM.",
  "Wendy and Kurt begin setup.",
  "Avalon arrives at 10:30 AM and is the main point of contact.",
  "Open items: Confirm how late Avalon stays.",
].join("\n");

test("Avalon's time frame is 11:00 AM to 7:00 PM on the venue moment, with no open item left", () => {
  const venue = RECONCILED_TIMELINE.find((moment) => moment.seedKey === "wedding_venue_opens")!;
  assert.ok(venue.lines.includes(AVALON_TIME_FRAME));
  assert.equal(venue.openItems, undefined);
  assert.equal(AVALON_TIME_FRAME, "Avalon’s time frame is 11:00 AM to 7:00 PM (David, Oct 13). She is the main point of contact.");
});

test("an older saved venue moment shows her 11 to 7, never 10:30 or how late she stays", () => {
  const lines = parseBlockNotes(OLD_VENUE).detailLines;
  assert.ok(lines.includes(AVALON_TIME_FRAME));
  assert.equal(lines.some((line) => /10:30 AM and is the main|how late Avalon/i.test(line)), false);
  assert.deepEqual(withLineCorrections(["Avalon (coordinator) arrives 10:30 or 11:00 AM", "Avalon arrives at 10:30 AM and is the main point of contact."]), [AVALON_TIME_FRAME]);
  assert.deepEqual(withLineCorrections(["Avalon arrives at 10:45 AM"]), ["Avalon arrives at 10:45 AM"]);
});

test("the venue moment as the app wrote it is brought up to date; the Day-of job too", () => {
  const plan = planReconciledTimeline([
    { id: "v", seedKey: "wedding_venue_opens", schedule: "wedding", startAt: "10:30 AM", endAt: "11:00 AM", notes: OLD_VENUE, sortOrder: 1 },
  ]);
  const venue = plan.rewords.find((row) => row.seedKey === "wedding_venue_opens");
  assert.ok(venue, "venue moment reworded");
  assert.ok(venue.notes.includes(AVALON_TIME_FRAME));
  const job = SCHEDULE_DAY_JOBS.find((row) => row.title === "Wendy and Kurt begin setup.")!;
  assert.match(job.notes, /11:00 AM to 7:00 PM/);
  const rewords = planDayJobRewords([{ id: "j", title: "Wendy and Kurt begin setup.", notes: "10:30 AM · Set up the venue. Avalon arrives at 10:30 AM and is the main point of contact." }]);
  assert.deepEqual(rewords.map((row) => [row.notes, row.correction]), [[job.notes, "Avalon 11:00 AM–7:00 PM"]]);
});

// David, 2026-10-13 22:13: "Update the clean up note say that Wendy needs to meet with Avalon to say before 7 pm."
test("the cleanup note says Wendy needs to meet with Avalon before 7:00 PM, on the moment and on Wendy's job", () => {
  const teardown = RECONCILED_TIMELINE.find((moment) => moment.seedKey === "wedding_teardown")!;
  assert.deepEqual(teardown.lines, ["Wendy is in charge of teardown.", "Wendy needs to meet with Avalon before 7:00 PM.", "Pack decor, gifts, personal belongings, remaining food, and vendor items."]);
  assert.equal(teardown.lines[1], WENDY_MEETS_AVALON);
  const oldNotes = ["Tear down and cleanup", "Wendy is in charge of teardown.", "Pack decor, gifts, personal belongings, remaining food, and vendor items."].join("\n");
  const plan = planReconciledTimeline([
    { id: "t", seedKey: "wedding_teardown", schedule: "wedding", startAt: "10:00 PM", endAt: "11:00 PM", notes: oldNotes, sortOrder: 1 },
  ]);
  const reworded = plan.rewords.find((row) => row.seedKey === "wedding_teardown");
  assert.ok(reworded, "teardown moment reworded");
  assert.ok(reworded.notes.includes(WENDY_MEETS_AVALON));
  const rewords = planDayJobRewords([{ id: "w", title: "Wendy is in charge of teardown.", notes: "10:00 PM · Tear down and cleanup" }]);
  assert.deepEqual(rewords.map((row) => [row.notes, row.correction]), [["10:00 PM · Tear down and cleanup. Wendy needs to meet with Avalon before 7:00 PM.", "Wendy meets Avalon before 7:00 PM"]]);
});

// David, 2026-10-13 22:37: "Thursday night we need to do rotations like the same way as makeup rotations. It will be like a practice run."
test("Thursday's 7:15 PM return to the Airbnb carries the rotation practice run, worded as the Master", () => {
  const back = RECONCILED_TIMELINE.find((moment) => moment.seedKey === "reh.return")!;
  assert.equal(back.startAt, "7:15 PM");
  assert.deepEqual(back.lines.slice(0, 4), [
    "Steam dresses and suits.",
    "Practice run: do the rotations the same way as the makeup rotations.",
    "First round. Hair: Braxton in Bathroom 1; Andi in Bathroom 2; Kaylie in Bathroom 3. Makeup: Bri and Trinity in Bedroom 1; Victoria and Skila in Bedroom 3.",
    "Swap. Makeup: Braxton in Bedroom 1; Andi and Kaylie in Bedroom 3. Hair: Bri and Trinity in Bathroom 1; Victoria in Bathroom 2; Skila in Bathroom 3.",
  ]);
  const oldLines = back.lines.filter((line) => !ROTATION_PRACTICE.includes(line));
  const plan = planReconciledTimeline([
    { id: "r", seedKey: "reh.return", schedule: "rehearsal", startAt: "7:15 PM", endAt: null, notes: reconciledNotes({ ...back, lines: oldLines }), sortOrder: 1 },
  ]);
  const reworded = plan.rewords.find((row) => row.seedKey === "reh.return");
  assert.ok(reworded, "return row reworded");
  assert.equal(reworded.correction, "Thursday night rotation practice run");
});

// David, 2026-10-13 22:37–22:44: "push up leaving the air bnb" ... "15 min not 30!" ... "on Friday for both groups."
test("both Friday groups leave the Airbnb 15 minutes earlier, with their arrivals, as the Master has them", () => {
  const at = (key: string) => RECONCILED_TIMELINE.find((moment) => moment.seedKey === key)!;
  assert.deepEqual([at("wedding_pack_up").endAt, at("wedding_pack_up").lines[1]], ["11:45 AM", "Wedding party prepares to leave at 11:45 AM."]);
  assert.deepEqual([at("wedding_party_leaves").startAt, at("wedding_party_leaves").endAt], ["11:45 AM", "12:15 PM"]);
  assert.deepEqual([at("wedding_vendor_arrival").startAt, at("wedding_vendor_arrival").endAt], ["12:00 PM", "12:15 PM"]);
  assert.equal(at("wedding_couple_departs").startAt, "12:15 PM");
  assert.equal(at("wedding_couple_arrives").startAt, "12:30 PM");
  assert.equal(at("wedding_photographer_arrives").startAt, "12:30 PM");
  const was: Record<string, { startAt: string; endAt: string | null; lines?: string[] }> = {
    wedding_pack_up: { startAt: "11:30 AM", endAt: "12:00 PM", lines: ["Pack wedding and personal items.", "Wedding party prepares to leave at noon."] },
    wedding_party_leaves: { startAt: "12:00 PM", endAt: "12:30 PM" },
    wedding_vendor_arrival: { startAt: "12:15 PM", endAt: "12:30 PM" },
    wedding_couple_departs: { startAt: "12:30 PM", endAt: null },
    wedding_couple_arrives: { startAt: "12:45 PM", endAt: null },
  };
  const rows = Object.entries(was).map(([key, row], index) => ({
    id: key, seedKey: key, schedule: "wedding" as const, startAt: row.startAt, endAt: row.endAt, sortOrder: index,
    notes: reconciledNotes({ ...at(key), lines: row.lines ?? at(key).lines }),
  }));
  assert.deepEqual(planReconciledTimeline(rows).rewords.map((row) => [row.id, row.startAt, row.endAt]).sort(), [
    ["wedding_couple_arrives", "12:30 PM", null],
    ["wedding_couple_departs", "12:15 PM", null],
    ["wedding_pack_up", "11:30 AM", "11:45 AM"],
    ["wedding_party_leaves", "11:45 AM", "12:15 PM"],
    ["wedding_vendor_arrival", "12:00 PM", "12:15 PM"],
  ]);
});

test("the hair and makeup schedule prints Friday's new leave and arrival times", () => {
  const item = (sortOrder: number, startAt: string, title: string, notes: string | null = null) => ({ section: "Schedule", startAt, title, location: null, notes, detail: null, sortOrder });
  const { rows } = projectHairMakeup([
    item(80, "12:00 PM", "Bridal party leaves the Airbnb"),
    item(90, "12:15 PM", "Bridal party arrives at Black Sheep Shelter"),
    item(100, "12:30 PM", "Photographer arrives · Haley, David, and Belle leave Airbnb", "Bridal party brings Haley's dress, shoes, accessories, and the detail box."),
    item(110, "12:45 PM", "Haley retouch + get-ready photos"),
  ]);
  assert.deepEqual(rows.map((row) => row.timeLabel), ["11:45 AM", "12:00 PM", "12:15 PM", "12:30 PM", "12:30 PM"]);
  assert.equal(rows.some((row) => /12:45/.test(row.timeLabel)), false);
  // One he retimed himself prints as he has it.
  assert.equal(projectHairMakeup([item(80, "12:05 PM", "Bridal party leaves the Airbnb")]).rows[0]!.timeLabel, "12:05 PM");
});

// David, 2026-10-14 14:53: the dances are back at 6:30–6:45 PM and open dancing starts at 6:45 PM.
// David, 2026-10-14 16:57, his edit of the Master, and 19:00: "The kids playlist is just starting at 7 now."
test("saved evening lines show the Master's times: cake at 6:10, dances 6:50, dancing and the kids playlist 7:00, once", () => {
  const now = 'MC cue 6:50: "Please turn your attention to the center of the space."';
  for (const was of ['MC cue 6:40: "Please turn your attention to the center of the space."', 'MC cue 6:30: "Please turn your attention to the center of the space."']) {
    assert.deepEqual(withLineCorrections([was]), [now]);
    assert.deepEqual(withLineCorrections([was, now]), [now]);
    assert.deepEqual(withLineCorrections([now, was]), [now]);
  }
  assert.deepEqual(
    withLineCorrections(['MC cue 6:45: "The dance floor is officially open in the glass house."', "Playlist: Wedding - Kids Section 6:45–8:15", "Dance floor opens at 6:45 PM in the glass house (not the older 7:45 PDF time)"]),
    ['MC cue 7:00: "The dance floor is officially open in the glass house."', "Playlist: Wedding - Kids Section 7:00–8:15", "Dance floor opens at 7:00 PM in the glass house (not the older 7:45 PDF time)"],
  );
  // The Master of Oct 15: the app's older cake-moment cues show as his 6:10 PM cake line, once; the toasts line and the
  // speakers belong to the 6:35 PM speeches.
  assert.deepEqual(
    withLineCorrections(['MC cue 6:00 PM: "As dinner winds down, please return to your seats."', "Best man, MOH, and FOB toasts.", 'MC cue 6:00: "As dinner winds down, please return to your seats."', 'MC cue 6:15: "With the toasts complete, gather near the cake table."', "Speeches: Braxton, Andi, John", "Cake cutting uses the dagger"]),
    [CAKE_CUE, "Cake cutting uses the dagger"],
  );
  assert.deepEqual(withLineCorrections([CAKE_CUE_OCT14, TOASTS_CUE_OCT14, "The cake is cut with the dagger."]), [CAKE_CUE, "The cake is cut with the dagger."]);
  assert.deepEqual(withLineCorrections([TOASTS_CUE, "Braxton, Andi and John."]), [TOASTS_CUE, "Braxton, Andi and John."]);
  // The Master of Oct 15's photo times over the app's older timed lines.
  assert.deepEqual(
    withLineCorrections(["1:15 PM — Haley first look with Dad", "1:30 PM — bridal portraits", "1:45 PM — groom portraits", "2:30 PM — immediate family portraits", "4:05 PM — family photos; Wendy to help", "Marriage license signing time still TBD (before ceremony vs 4:00 PM)"]),
    ["1:30 PM — Haley first look with Dad", "1:45 PM — bridal portraits", "1:15 PM — groom portraits", "2:35 PM — couple with parents and girls portraits", "4:10 PM — family photos; Wendy to help"],
  );
  assert.deepEqual(withLineCorrections(["Avalon releases tables around 5:20 PM — Haley and David first", "5:45 PM — sunset photos", "Cake cutting stays at 6:15 with toasts (not the 5:15 if-by-the-bar maybe)"]), ["Avalon releases tables around 5:20 PM — Haley and David first", "6:15 PM — sunset photos"]);
  assert.deepEqual(withLineCorrections(["Open items: Ask Barry to confirm the best 10 minutes for outdoor photos."]), []);
});

// David, 2026-10-13 22:27: "Kids must remain hidden from Haley and dad during this time." The Master's 1:45 row is David's photos only.
test("David's photos are the Master's 1:15 PM groom portraits, without the children", () => {
  const moment = RECONCILED_TIMELINE.find((m) => m.seedKey === "wedding_david_photos")!;
  assert.deepEqual([moment.startAt, moment.endAt, moment.title, moment.lines], ["1:15 PM", null, "Groom portraits", ["David solo portraits and groom-party candids."]]);
  const was = reconciledNotes({ ...moment, title: "David’s photos", lines: ["David solo portraits and groom-party candids.", "The children join David for photos.", "Barry positions David and clears the first-look area."] });
  const plan = planReconciledTimeline([{ id: "dp", seedKey: moment.seedKey, schedule: "wedding", startAt: "1:45 PM", endAt: "2:00 PM", notes: was, sortOrder: 0 }]);
  assert.deepEqual(plan.rewords.map((row) => [row.id, row.correction, row.startAt, row.notes]), [["dp", "the Master of Oct 15", "1:15 PM", reconciledNotes(moment)]]);
});

// David, 2026-10-14 15:09: "On our schedule, we do need to update trash to being Tracy and Victor."
test("trash is Tracy and Victor: the saved line, the playbook row as the app wrote it, and the setup page", () => {
  assert.deepEqual(withLineCorrections(["Trash: Haley's parents", "Decor goes with Haley's parents and anyone staying with them"]), ["Trash: Tracy and Victor", "Decor goes with Haley's parents and anyone staying with them"]);
  assert.deepEqual(withLineCorrections(["Trash: Haley's parents", "Trash: Tracy and Victor"]), ["Trash: Tracy and Victor"]);
  const rewords = planPlaybookRewords([
    { id: "t", sourceKey: "decor-trash", title: "Trash", notes: "Haley's parents take trash." },
    { id: "a", sourceKey: "avalon-breakdown", title: "Décor breakdown for the point person", notes: "Full décor clean-up/breakdown for the client's point person. That is not Avalon personally owning removal or transport of all decor. Haley's parents take trash and take decor home." },
    { id: "own", sourceKey: "decor-trash", title: "Trash", notes: "Mom has it." },
  ]);
  assert.deepEqual(rewords.map((row) => [row.id, row.notes, row.detail ?? null]), [
    ["t", "Tracy and Victor take trash.", { before: "Haley's parents", now: "Tracy and Victor" }],
    ["a", "Full décor clean-up/breakdown for the client's point person. That is not Avalon personally owning removal or transport of all decor. Tracy and Victor take trash. Haley's parents take decor home.", null],
  ]);
});
