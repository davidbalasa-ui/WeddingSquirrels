import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBlockNotes } from "./day-of-now";
import { reviewMoment } from "./day-timeline-view";
import { momentForAudience, packetSchedule, withoutBrideSecrets } from "./print-packets";
import { RECONCILED_TIMELINE, reconciledNotes } from "./reconciled-timeline";

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
  assert.ok(!titles(groom.wedding).includes("Children get ready to leave"));
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
  assert.ok(getaway?.lines.some((line) => /Show San where to park/.test(line)));
});

test("the wedding party's copy has the Thursday departures and the return", () => {
  const party = packetSchedule(moments, "party");
  for (const title of ["Depart for Hawkshead", "Depart for Black Sheep Shelter", "Return to the Airbnb"]) {
    assert.ok(titles(party.rehearsal).includes(title), title);
  }
  assert.equal(titles(packetSchedule(moments, "mc").rehearsal).length, 0);
});
