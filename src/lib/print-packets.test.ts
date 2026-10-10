import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBlockNotes } from "./day-of-now";
import { reviewMoment } from "./day-timeline-view";
import { momentForAudience, packetSchedule, withoutBrideSecrets } from "./print-packets";
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

test("nothing in the bride's copy of the whole timeline mentions San, the sign or the secret", () => {
  for (const moment of RECONCILED_TIMELINE) {
    const notes = withoutBrideSecrets({ notes: reconciledNotes(moment) }).notes;
    assert.doesNotMatch(notes, /\bSan\b|Just Married|secret from the bride/i, moment.title);
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

