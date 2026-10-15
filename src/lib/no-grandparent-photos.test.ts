import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { reviewMoment } from "./day-timeline-view";
import { isGrandparentPhoto, isRemovedCakePickup, withoutRemovedJobs } from "./no-grandparent-photos";
import { CANONICAL_PLAYBOOK } from "./playbook";
import { momentPrintRow, packetSchedule } from "./print-packets";
import { professionalizePrintLine } from "./print-projection";
import { planReconciledTimeline, RECONCILED_TIMELINE, reconciledNotes, weddingRowsToPrint, type ExistingTimelineRow } from "./reconciled-timeline";

// David, 2026-10-11 12:31: "I never asked for pictures of grandparents and I keep telling you to remove them."
const OLD_FAMILY_PHOTOS = [
  "Family photos after the ceremony",
  "Haley with Grandma; Haley with Grandpa; Haley with grandparents.",
  "Couple with grandparents.",
  "Couple with Haley’s paternal side of the family.",
  "Couple with Haley’s maternal side of the family.",
  "Open items: Tell the grandparents and extended family to stay near the ceremony area, and choose someone to gather them.",
].join("\n");

test("no shot and no moment in the app's own data mentions grandparents", () => {
  for (const item of CANONICAL_PLAYBOOK) {
    assert.equal(isGrandparentPhoto(`${item.title} ${item.notes ?? ""}`), false, item.title);
  }
  for (const moment of RECONCILED_TIMELINE) {
    assert.doesNotMatch(reconciledNotes(moment), /grand ?(?:ma|pa|parent|mother|father)/i, moment.title);
  }
});

test("no source file the app ships adds a grandparent photo back", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(path);
    }
  };
  walk(join(process.cwd(), "src"));
  for (const file of files) {
    // This file names what it guards against, and the retired row it removes.
    if (/no-grandparent-photos\.ts$|reconciled-timeline\.ts$/.test(file)) continue;
    assert.doesNotMatch(readFileSync(file, "utf8").replaceAll("no-grandparent-photos", ""), /grand ?(?:ma|pa|parents?|mother|father)\b/i, file);
  }
});

// David, 2026-10-11 19:27: "Add from 4:05 to 4:30, family photos." The row the app once wrote with the
// grandparents becomes his "Family photos"; none of the grandparent lines print.
test("the 4:05 family photos the app once wrote become David's family photos, with no grandparent line", () => {
  const rows: ExistingTimelineRow[] = RECONCILED_TIMELINE.filter((m) => m.schedule === "wedding" && m.seedKey !== "wedding_family_photos_after").map((m, index) => ({
    id: m.seedKey,
    seedKey: m.seedKey,
    schedule: m.schedule,
    startAt: m.startAt,
    endAt: m.endAt,
    notes: reconciledNotes(m),
    sortOrder: index,
  }));
  const old = { id: "fam", seedKey: "wedding_family_photos_after", schedule: "wedding", startAt: "4:05 PM", endAt: "4:30 PM", notes: OLD_FAMILY_PHOTOS, sortOrder: 99 };
  const plan = planReconciledTimeline([...rows, old]);
  // The Master of Oct 15 takes it straight to its 4:10 PM family photos.
  const now = RECONCILED_TIMELINE.find((m) => m.seedKey === "wedding_family_photos_after")!;
  assert.deepEqual(plan.rewords.map((row) => [row.id, row.notes, row.startAt, row.correction]), [["fam", reconciledNotes(now), "4:10 PM", "the Master of Oct 15"]]);
  assert.doesNotMatch(reconciledNotes(now), /grand|paternal|maternal|extended/i);
  assert.equal(plan.removals.length, 0);
  assert.equal(plan.drops?.length ?? 0, 0);
  // One he edited himself stays his; its grandparent lines still never print.
  const edited = { ...old, notes: `${OLD_FAMILY_PHOTOS}\nAsk Mom` };
  const printed = weddingRowsToPrint([...rows, edited]).find((row) => row.id === "fam");
  assert.ok(printed);
  const moment = reviewMoment(printed, { party: [], mc: [], photo: ["Barry"] });
  assert.doesNotMatch(momentPrintRow(moment).lines.join("\n"), /grand|paternal|maternal|extended/i);
});

test("David's photos lose the old grandparents question while the row reads as the app wrote it", () => {
  const moment = RECONCILED_TIMELINE.find((m) => m.seedKey === "wedding_david_photos")!;
  const was = reconciledNotes({
    ...moment,
    title: "David’s photos",
    lines: ["David solo portraits and groom-party candids.", "Barry positions David and clears the first-look area."],
    openItems: "Add any photos wanted with David’s parents, grandparents, or extended family.",
  });
  const row = { id: "dp", seedKey: moment.seedKey, schedule: "wedding", startAt: "1:45 PM", endAt: "2:00 PM", notes: was, sortOrder: 0 };
  const plan = planReconciledTimeline([row]);
  assert.deepEqual(plan.rewords.map((r) => [r.id, r.correction, r.notes]), [["dp", "the Master of Oct 15", reconciledNotes(moment)]]);
  assert.doesNotMatch(reconciledNotes(moment), /grand|extended/i);
});

test("a grandparent photo line saved on an older row never prints, in any packet or the binder", () => {
  const moment = reviewMoment({ startAt: "1:45 PM", endAt: "2:00 PM", notes: OLD_FAMILY_PHOTOS }, { party: [], mc: [], photo: ["Barry"] });
  const printed = momentPrintRow(moment).lines.join("\n");
  assert.doesNotMatch(printed, /grand|paternal|maternal|extended/i);
  for (const audience of ["party", "mc", "photo", "brideParents", "groomParents"] as const) {
    const rows = packetSchedule({ rehearsal: [], wedding: [moment] }, audience).wedding;
    assert.doesNotMatch(rows.flatMap((r) => r.lines).join("\n"), /grand|paternal|maternal|extended/i, audience);
  }
  assert.equal(professionalizePrintLine("Bride with Grandma"), null);
  // A line that only mentions family without photos is his, and stays.
  assert.equal(isGrandparentPhoto("Mom sits in the front row."), false);
});

// David, 2026-10-11 16:01 and 16:03: no cake pickup by Denise and Lisa, nothing about the cake at 2:00–2:30.
test("the Friday cake pickup never shows as a line or a job; Braxton's Thursday cake line does", () => {
  assert.equal(isRemovedCakePickup("2:00 PM — Denise and Lisa pick up cake at Airbnb; 2:30 PM arrive at BSS (fridge by suites)"), true);
  assert.equal(isRemovedCakePickup("2:00 PM — Denise and Lisa pick up cake at Airbnb"), true);
  assert.equal(isRemovedCakePickup("2:30 PM arrive at BSS (fridge by suites)"), true);
  assert.equal(isRemovedCakePickup("Braxton brings the cake from the Airbnb to Black Sheep Shelter (David, Oct 11)."), false);
  assert.equal(isRemovedCakePickup("Cake placed in center and desserts rotated around on the glass plates on small plates (David, Oct 10)."), false);
  assert.equal(isRemovedCakePickup("12:00 PM — cake topper"), false);
  const jobs = [
    { title: "Denise and Lisa pick up the cake from the Airbnb", notes: "2:00 PM · Cake pickup" },
    { title: "Cake arrives at BSS; fridge by the suites", notes: "2:30 PM · Cake arrival" },
    { title: "Wendy is in charge of teardown.", notes: "10:00 PM · Tear down and cleanup" },
  ];
  assert.deepEqual(withoutRemovedJobs(jobs).map((job) => job.title), ["Wendy is in charge of teardown."]);
});
