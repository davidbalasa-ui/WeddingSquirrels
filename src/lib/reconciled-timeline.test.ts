import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBlockNotes } from "./day-of-now";
import {
  RECONCILED_TIMELINE,
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
