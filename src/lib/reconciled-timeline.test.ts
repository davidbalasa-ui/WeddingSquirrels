import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBlockNotes } from "./day-of-now";
import {
  RECONCILED_RETIRED_SEED_KEYS,
  RECONCILED_TIMELINE,
  phaseForBlock,
  planReconciledTimeline,
  reconciledNotes,
  reconciledPlanIsEmpty,
} from "./reconciled-timeline";

test("every reconciled moment has a unique seedKey and a title", () => {
  const keys = new Set<string>();
  for (const moment of RECONCILED_TIMELINE) {
    assert.ok(!keys.has(moment.seedKey), `duplicate seedKey ${moment.seedKey}`);
    keys.add(moment.seedKey);
    assert.ok(moment.title.trim());
    assert.equal(parseBlockNotes(reconciledNotes(moment)).title, moment.title);
  }
});

test("reconciledNotes keeps location on its own line and open items last", () => {
  const notes = reconciledNotes({
    seedKey: "x", schedule: "wedding", phase: "morning", startAt: "9:00 AM", endAt: null,
    title: "Set up", location: "Shelter", lines: ["One", "Two"], openItems: "Who?",
  });
  assert.equal(notes, "Set up\nlocation: Shelter\nOne\nTwo\nOpen items: Who?");
});

test("planReconciledTimeline inserts missing, updates changed, retires folded rows, leaves the rest", () => {
  const ceremony = RECONCILED_TIMELINE.find((m) => m.seedKey === "wedding_ceremony")!;
  const plan = planReconciledTimeline([
    { id: "a", seedKey: "wedding_ceremony", schedule: "wedding", startAt: ceremony.startAt, endAt: ceremony.endAt, notes: reconciledNotes(ceremony), sortOrder: RECONCILED_TIMELINE.indexOf(ceremony) },
    { id: "b", seedKey: "wedding_venue_opens", schedule: "wedding", startAt: "10:30 AM", endAt: null, notes: "Venue Opens\nVendors", sortOrder: 1 },
    { id: "c", seedKey: "wedding_settle_in", schedule: "wedding", startAt: "9:00 AM", endAt: "11:00 AM", notes: "Settle in at Airbnb", sortOrder: 0 },
    { id: "d", seedKey: null, schedule: "wedding", startAt: "TBD", endAt: null, notes: "Something David added", sortOrder: 50 },
  ]);
  assert.deepEqual(plan.unchanged, ["wedding_ceremony"]);
  assert.equal(plan.updates.length, 1);
  assert.equal(plan.updates[0]!.before.title, "Venue Opens");
  assert.equal(plan.inserts.length, RECONCILED_TIMELINE.length - 2);
  assert.deepEqual(plan.removals.map((r) => r.seedKey), ["wedding_settle_in"]);
  assert.deepEqual(plan.untouched.map((r) => r.title), ["Something David added"]);
  assert.equal(reconciledPlanIsEmpty(plan), false);
});

test("a moment edited on the page alone never brings the Apply card back", () => {
  const applied = planReconciledTimeline([]).inserts.map((row) => ({ ...row, id: row.seedKey }));
  applied[3] = { ...applied[3]!, notes: `${applied[3]!.notes}\nDavid's own note` };
  const plan = planReconciledTimeline(applied);
  assert.equal(plan.updates.length, 1);
  assert.equal(reconciledPlanIsEmpty(plan), true);
});

test("David's 9 Oct edits: boutonniere first look with his parents, named party shots, family photos retired", () => {
  const plan = planReconciledTimeline([
    { id: "fam", seedKey: "wedding_family_photos_after", schedule: "wedding", startAt: "4:05 PM", endAt: "4:30 PM", notes: "Family photos after the ceremony", sortOrder: 0 },
  ]);
  assert.deepEqual(plan.removals.map((row) => row.seedKey), ["wedding_family_photos_after"]);
  const firstLook = RECONCILED_TIMELINE.find((m) => m.seedKey === "wedding_david_parents_first_look");
  assert.equal(firstLook?.startAt, "1:00 PM");
  const dressed = RECONCILED_TIMELINE.find((m) => m.seedKey === "wedding_getting_dressed");
  assert.equal(dressed?.lines.some((line) => /boutonniere/i.test(line)), false);
  const party = RECONCILED_TIMELINE.find((m) => m.seedKey === "wedding_party_photos");
  assert.equal(party?.lines.filter((line) => /^(Bride|Groom) with [A-Z][a-z]+\.$/.test(line)).length, 14);
  assert.equal(party?.openItems, undefined);
});

test("Harmony is on ring security at the entry table the half hour before the ceremony", () => {
  const ring = RECONCILED_TIMELINE.find((moment) => moment.seedKey === "wedding_ring_security");
  const ceremony = RECONCILED_TIMELINE.find((moment) => moment.seedKey === "wedding_ceremony");
  assert.equal(ring?.startAt, "3:00 PM");
  assert.equal(ring?.endAt, ceremony?.startAt);
  assert.equal(ring?.location, "Entry table");
});

test("the couple's 4:30 cocktail break and the drinks/apps runners are off the day", () => {
  assert.equal(RECONCILED_TIMELINE.some((moment) => moment.seedKey === "wedding_couple_cocktail"), false);
  assert.ok(RECONCILED_RETIRED_SEED_KEYS.includes("wedding_couple_cocktail"));
  const cocktail = RECONCILED_TIMELINE.find((moment) => moment.seedKey === "wedding_cocktail_hour");
  assert.equal(cocktail?.lines.some((line) => /bring David and Haley/i.test(line)), false);
});

test("renumbering the page (sortOrder) does not bring the update card back", () => {
  const applied = planReconciledTimeline([]).inserts.map((row, index) => ({
    id: row.seedKey,
    seedKey: row.seedKey,
    schedule: row.schedule,
    startAt: row.startAt,
    endAt: row.endAt,
    notes: row.notes,
    sortOrder: 500 - index,
  }));
  const plan = planReconciledTimeline(applied);
  assert.equal(plan.updates.length, 0);
  assert.equal(plan.inserts.length, 0);
});

test("a seeded moment moved to a new time follows its new time into the right section", () => {
  assert.equal(phaseForBlock({ seedKey: "wedding_katie_arrives", startAt: "10:30 AM" }), "morning");
  assert.equal(phaseForBlock({ seedKey: "wedding_katie_arrives", startAt: "1:30 PM" }), "photos");
  assert.equal(phaseForBlock({ seedKey: "wedding_teardown", startAt: "10:00 PM" }), "evening");
});
