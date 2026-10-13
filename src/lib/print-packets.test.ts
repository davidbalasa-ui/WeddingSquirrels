import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBlockNotes } from "./day-of-now";
import { reviewMoment } from "./day-timeline-view";
import { SCHEDULE_DAY_JOBS } from "./day-job-corrections";
import { momentForAudience, momentPrintRow, packetSchedule, runSheetWithJobs, withoutBrideSecrets } from "./print-packets";
import { RECONCILED_TIMELINE, reconciledNotes } from "./reconciled-timeline";
import { REHEARSAL_SCHEDULE_SEED } from "./rehearsal";

const ctx = { party: ["Skila", "Braxton"], mc: ["Kurt", "Wendy"], photo: ["Barry"] };
const moments = {
  rehearsal: RECONCILED_TIMELINE.filter((m) => m.schedule === "rehearsal").map((m) =>
    reviewMoment({ startAt: m.startAt, endAt: m.endAt, notes: reconciledNotes(m) }, ctx),
  ),
  wedding: RECONCILED_TIMELINE.filter((m) => m.schedule === "wedding").map((m) =>
    reviewMoment({ startAt: m.startAt, endAt: m.endAt, notes: reconciledNotes(m) }, ctx),
  ),
};
const titles = (rows: Array<{ title: string }>) => rows.map((row) => row.title);

test("wedding party schedule: their moments plus the shared ones, no open questions or MC cues", () => {
  const schedule = packetSchedule(moments, "party");
  const wedding = titles(schedule.wedding);
  assert.ok(wedding.includes("Wedding party first hair and makeup rotation"));
  assert.ok(wedding.includes("Ceremony"));
  assert.ok(wedding.includes("Toasts"));
  assert.ok(!wedding.includes("Haley makeup"));
  assert.ok(!wedding.includes("Dollar dance"));
  assert.ok(titles(schedule.rehearsal).includes("Ceremony rehearsal"));
  const all = [...schedule.rehearsal, ...schedule.wedding].flatMap((row) => row.lines);
  assert.equal(all.some((line) => /^open items?:|confirm the/i.test(line)), false);
});

test("MC and photographer schedules skip the rehearsal and keep their own lines", () => {
  const mc = packetSchedule(moments, "mc");
  assert.equal(mc.rehearsal.length, 0);
  const dollar = mc.wedding.find((row) => row.title === "Dollar dance");
  assert.deepEqual(dollar?.lines, ["MC announces the dollar dance."]);
  const photo = packetSchedule(moments, "photo");
  assert.ok(titles(photo.wedding).includes("Golden-hour photos"));
});

test("parents' schedules split by side: father-daughter dance for the bride's, couple photos for both", () => {
  const bride = packetSchedule(moments, "brideParents");
  const groom = packetSchedule(moments, "groomParents");
  assert.ok(titles(bride.wedding).includes("Haley’s family photos"));
  assert.ok(!titles(groom.wedding).includes("Haley’s family photos"));
  assert.deepEqual(bride.wedding.find((row) => row.title === "Formal dances")?.lines, ["Father of the bride dance."]);
  assert.deepEqual(groom.wedding.find((row) => row.title === "Formal dances")?.lines, []);
  assert.ok(groom.wedding.find((row) => row.title === "Couple and parent photos")?.lines.includes("Couple with dad."));
  assert.ok(titles(bride.wedding).includes("Getaway vehicle arrives"));
  assert.ok(!titles(groom.wedding).includes("Goodbyes to the kids and goodbye song"));
  assert.equal(momentForAudience(moments.wedding.find((m) => m.title === "Haley makeup")!, "groomParents", "wedding"), null);
});

test("bride's copy keeps the getaway moments as time and title only", () => {
  for (const title of ["Getaway vehicle arrives", "Getaway vehicle photos"]) {
    const moment = RECONCILED_TIMELINE.find((m) => m.title === title)!;
    const parsed = parseBlockNotes(withoutBrideSecrets({ notes: reconciledNotes(moment) }).notes);
    assert.equal(parsed.title, title);
    assert.deepEqual(parsed.detailLines, []);
  }
  const plain = { notes: reconciledNotes(RECONCILED_TIMELINE[0]!) };
  assert.equal(withoutBrideSecrets(plain), plain);
});

test("David's first look with his parents goes to the groom's parents only", () => {
  const groom = packetSchedule(moments, "groomParents");
  const bride = packetSchedule(moments, "brideParents");
  assert.ok(titles(groom.wedding).includes("David’s first look with his parents"));
  assert.ok(!titles(bride.wedding).includes("David’s first look with his parents"));
});

test("Parents of the Bride get the instruction that follows the MOB's getaway line", () => {
  const bride = packetSchedule(moments, "brideParents");
  const getaway = bride.wedding.find((row) => row.title === "Getaway vehicle arrives");
  assert.ok(getaway?.lines.some((line) => /Show Dan where to park/.test(line)));
});

test("the wedding party's copy has the Thursday departures and the return", () => {
  const party = packetSchedule(moments, "party");
  for (const title of ["Depart for Hawkshead SHARP", "Depart for Black Sheep Shelter", "Return to the Airbnb"]) {
    assert.ok(titles(party.rehearsal).includes(title), title);
  }
  assert.equal(titles(packetSchedule(moments, "mc").rehearsal).length, 0);
});

test("nothing in the bride's copy of the whole timeline mentions Dan, the sign or the secret", () => {
  for (const moment of RECONCILED_TIMELINE) {
    const notes = withoutBrideSecrets({ notes: reconciledNotes(moment) }).notes;
    assert.doesNotMatch(notes, /\b[DS]an\b|Just Married|secret from the bride/i, moment.title);
  }
});

test("packets for each group keep the moments they had before, plus only the intended additions", () => {
  // Every group still gets the ceremony and the dances; MC and photographer have no rehearsal.
  for (const audience of ["party", "mc", "photo", "brideParents", "groomParents"] as const) {
    const schedule = packetSchedule(moments, audience);
    assert.ok(titles(schedule.wedding).includes("Ceremony"), audience);
    assert.ok(titles(schedule.wedding).includes("Formal dances"), audience);
  }
  assert.equal(packetSchedule(moments, "photo").rehearsal.length, 0);
  // The follow-on rule only adds a line that names the same person, so the
  // bride's parents do not pick up the planning note under Formal dances.
  const dances = packetSchedule(moments, "brideParents").wedding.find((row) => row.title === "Formal dances");
  assert.deepEqual(dances?.lines, ["Father of the bride dance."]);
});

test("the father-daughter song is the bride's parents' line, the mother-son song the groom's", () => {
  const moment = reviewMoment({
    startAt: "6:30 PM",
    endAt: "7:00 PM",
    notes: "First dances\nFather-daughter: My Girl by The Temptations\nMother-son: What a Wonderful World",
  });
  assert.deepEqual(momentForAudience(moment, "brideParents", "wedding")?.lines, ["Father-daughter: My Girl by The Temptations"]);
  assert.deepEqual(momentForAudience(moment, "groomParents", "wedding")?.lines, ["Mother-son: What a Wonderful World"]);
});

test("the app's earlier one-line rehearsal rows still reach the party and the parents", () => {
  const legacy = {
    rehearsal: REHEARSAL_SCHEDULE_SEED.map((row) => reviewMoment({ startAt: row.startAt, endAt: row.endAt, notes: row.notes }, ctx)),
    wedding: [],
  };
  const party = titles(packetSchedule(legacy, "party").rehearsal);
  for (const title of [
    "Airbnb Check-in; Wedding party arrives; Rooms are picked",
    "Depart Airbnb; Drive time 25-30 minutes; Location: Hawkshead 523 Hawks Nest Dr, South Haven",
    "Dinner; Welcome toasts; Reminders & logistics",
    "Depart for BSS; Drive time 10-15 minutes",
    "Rehearsal; Ceremony rehearsal at BSS",
    "Return to Airbnb; Game night!",
  ]) {
    assert.ok(party.includes(title), title);
  }
  const parents = titles(packetSchedule(legacy, "brideParents").rehearsal);
  assert.ok(parents.includes("Dinner; Welcome toasts; Reminders & logistics"));
  assert.ok(parents.includes("Rehearsal; Ceremony rehearsal at BSS"));
  assert.ok(!parents.includes("Return to Airbnb; Game night!"));
});

test("a getaway line inside another moment is left out of the bride's copy", () => {
  const block = {
    notes: "Reception ends\nGuest departure and final send-off if used.\nOvernight check: guests line the path to the getaway car with the Just Married sign.",
  };
  const parsed = parseBlockNotes(withoutBrideSecrets(block).notes);
  assert.equal(parsed.title, "Reception ends");
  assert.deepEqual(parsed.detailLines, ["Guest departure and final send-off if used."]);
});

test("the binder prints each page moment with the page's own lines, in the page's order", () => {
  const page = reviewMoment(
    {
      startAt: "10:30 AM",
      endAt: "12:30 PM",
      notes:
        "Venue opens\nAvalon (coordinator) arrives 10:30 or 11:00 AM\nKatie does Haley's hair — confirmed, not DIY\nChildren arrive at 1:15 PM.\nMC cue 4:55: \"Honored guests, cocktail hour is nearing its end.\"\nOpen items: Confirm MOB will meet Dan.",
    },
    ctx,
  );
  const printed = momentPrintRow(page);
  assert.equal(printed.time, page.timeLabel);
  assert.equal(printed.title, "Venue opens");
  // Nothing reworded, re-timed or moved: the words David sees on the page.
  assert.deepEqual(printed.lines, [
    "Avalon’s time frame is 11:00 AM to 7:00 PM (David, Oct 13). She is the main point of contact.",
    "Katie does Haley's hair — confirmed, not DIY",
    "Children arrive at 1:15 PM.",
    "Open: Confirm MOB will meet Dan.",
  ]);
});

test("every line the binder prints for the reconciled day is a line of that page moment", () => {
  for (const moment of [...moments.rehearsal, ...moments.wedding]) {
    const page = new Set(moment.details.map((detail) => detail.text));
    for (const line of momentPrintRow(moment).lines) {
      const text = line.replace(/^(?:MC cue|Music|Open): /, "");
      assert.ok(page.has(text) || line === "Bridal party photos", `${moment.title}: ${line}`);
    }
  }
  const getaway = moments.wedding.find((moment) => moment.title === "Getaway vehicle arrives")!;
  assert.deepEqual(momentPrintRow(getaway).lines, [
    "MOB or another helper meets Dan Vandenheede.",
    "Show Dan where to park, give him the “Just Married” sign, and tell the groom.",
    "Keep the vehicle details secret from the bride.",
    "Dan’s phone: (269) 635-8458 (David, Oct 11).",
    "John drops off the car with someone else, who is not known yet (David, Oct 11).",
    "Open: Confirm MOB will meet Dan.",
  ]);
});

// David, 2026-10-10 21:08: add Hawkshead's golf dress code to Thursday's rehearsal dinner.
test("the wedding party schedule prints the Hawkshead dress code under the rehearsal dinner", () => {
  const dinner = packetSchedule(moments, "party").rehearsal.find((row) => row.title === "Rehearsal dinner");
  assert.ok(dinner);
  assert.ok(dinner.lines.some((line) => line.includes("Hawkshead golf dress code") && line.includes("cut-offs are not permitted")));
});

// David, 2026-10-11 12:29: "At 1:45 pm, have David's first look with the girls".
// David, 2026-10-13 22:27: "Let's push kids first look to 2:15 and it will be first look with Dad and Haley."
test("the kids' 2:15 PM first look with David and Haley is on the timeline and in the photographer's packet", () => {
  const moment = RECONCILED_TIMELINE.find((m) => m.seedKey === "wedding_david_girls_first_look");
  assert.equal(moment?.startAt, "2:15 PM");
  assert.equal(moment?.title, "Kids’ first look with David and Haley");
  assert.ok(titles(packetSchedule(moments, "photo").wedding).includes("Kids’ first look with David and Haley"));
});

// David, 2026-10-11 12:37: the 6:55 PM MC announcement before the first dance.
test("the 6:55 PM clear-the-center announcement is the MC's cue and on every evening schedule", () => {
  for (const audience of ["party", "mc", "photo", "brideParents", "groomParents"] as const) {
    assert.ok(titles(packetSchedule(moments, audience).wedding).includes("Clear the center for the first dance"), audience);
  }
  const mc = packetSchedule(moments, "mc").wedding.find((row) => row.title === "Clear the center for the first dance");
  assert.ok(mc?.lines.some((line) => /turn your chairs to the middle of the walk area/.test(line)));
});

// David, 2026-10-11: "the jobs should be on the master run list", by time.
test("the run sheet prints each day-of job under its moment, and lists jobs with no time after the day", () => {
  const rows = moments.wedding.map(momentPrintRow);
  const sheet = runSheetWithJobs(rows, [
    { title: "Andi (Best Man) and Braxton (Maid of Honor) are the witnesses and are in charge of the license and pen.", notes: "3:50 PM · Sign the marriage license", assignees: ["Andi", "Braxton"] },
    { title: "Wendy is in charge of teardown.", notes: "10:00 PM · Tear down and cleanup", assignees: [] },
    { title: "Bring the cooler", notes: null, assignees: ["Pam Balasa"] },
  ]);
  const signing = sheet.rows.find((row) => row.title === "Sign the marriage license")!;
  assert.ok(signing.lines.includes("Job: Andi (Best Man) and Braxton (Maid of Honor) are the witnesses and are in charge of the license and pen. (Andi · Braxton)"));
  const teardown = sheet.rows.find((row) => row.title === "Tear down and cleanup")!;
  assert.ok(teardown.lines.includes("Job: Wendy is in charge of teardown. (Unassigned)"));
  assert.deepEqual(sheet.unplaced, [{ title: "Bring the cooler", notes: null, owner: "Pam Balasa" }]);
  // The rows themselves are left as they were.
  assert.equal(rows.find((row) => row.title === "Sign the marriage license")!.lines.some((line) => line.startsWith("Job:")), false);
});

test("every job the Day-of card adds lands under a moment on the run sheet", () => {
  const rows = moments.wedding.map(momentPrintRow);
  const sheet = runSheetWithJobs(rows, SCHEDULE_DAY_JOBS.map((job) => ({ ...job, assignees: [] })));
  assert.deepEqual(sheet.unplaced.map((job) => job.title), []);
});
