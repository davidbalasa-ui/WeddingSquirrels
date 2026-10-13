import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBlockNotes } from "./day-of-now";
import { SCHEDULE_DAY_JOBS, planDayJobRewords } from "./day-job-corrections";
import { withLineCorrections } from "./line-corrections";
import { AVALON_TIME_FRAME, RECONCILED_TIMELINE, WENDY_MEETS_AVALON, planReconciledTimeline } from "./reconciled-timeline";

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
