import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBlockNotes } from "./day-of-now";
import { REHEARSAL_SCHEDULE_SEED } from "./rehearsal";
import {
  RECONCILED_RETIRED_SEED_KEYS,
  RECONCILED_TIMELINE,
  doubledMomentToRemove,
  phaseForBlock,
  planReconciledTimeline,
  reconciledNotes,
  reconciledPlanIsEmpty,
  type ExistingTimelineRow,
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

test("Apply on an edited timeline writes only new and retired moments, never the edited ones", () => {
  const applied = planReconciledTimeline([]).inserts.map((row) => ({ ...row, id: row.seedKey }));
  const edited = applied.map((row) =>
    row.seedKey === "wedding_ceremony" ? { ...row, notes: `${row.notes}\nDavid's own note`, startAt: "3:35 PM" } : row,
  );
  const withoutRing: ExistingTimelineRow[] = edited.filter((row) => row.seedKey !== "wedding_ring_security");
  withoutRing.push({ id: "old", seedKey: "wedding_settle_in", schedule: "wedding", startAt: "9:00 AM", endAt: null, notes: "Settle in", sortOrder: 0 });
  const plan = planReconciledTimeline(withoutRing);
  assert.deepEqual(plan.inserts.map((row) => row.seedKey), ["wedding_ring_security"]);
  assert.deepEqual(plan.removals.map((row) => row.seedKey), ["wedding_settle_in"]);
  // Listed so the owner can switch it back by hand, but Apply does not write it.
  assert.deepEqual(plan.updates.map((row) => row.seedKey), ["wedding_ceremony"]);
});

test("the app's original rehearsal rows (id = seed key, no seedKey) are the document's rows, not extras", () => {
  const legacy = REHEARSAL_SCHEDULE_SEED.map((block, index) => ({
    id: block.id,
    seedKey: null,
    schedule: "rehearsal",
    startAt: block.startAt,
    endAt: block.endAt,
    notes: block.notes,
    sortOrder: index,
  }));
  const plan = planReconciledTimeline(legacy);
  assert.equal(plan.inserts.filter((row) => row.schedule === "rehearsal").length, 0);
  assert.equal(plan.untouched.length, 0);
  assert.equal(plan.updates.filter((row) => row.schedule === "rehearsal").length, legacy.length);
  // Applying twice never doubles the rehearsal.
  const applied = [
    ...legacy,
    ...plan.inserts.map((row, index) => ({ ...row, id: `new-${index}`, seedKey: row.seedKey })),
  ];
  const again = planReconciledTimeline(applied);
  assert.equal(again.inserts.length, 0);
  assert.equal(again.removals.length, 0);
});

test("after an Apply that doubled the rehearsal, the untouched legacy copies are folded away and an edited one replaces the document copy", () => {
  const legacy = REHEARSAL_SCHEDULE_SEED.map((block, index) => ({
    id: block.id,
    seedKey: null,
    schedule: "rehearsal",
    startAt: block.startAt,
    endAt: block.endAt,
    notes: index === 0 ? `${block.notes}; David: bring the keys` : block.notes,
    sortOrder: index,
  }));
  const seeded = RECONCILED_TIMELINE.filter((moment) => moment.schedule === "rehearsal").map((moment, index) => ({
    id: `seeded-${index}`,
    seedKey: moment.seedKey,
    schedule: "rehearsal",
    startAt: moment.startAt,
    endAt: moment.endAt,
    notes: reconciledNotes(moment),
    sortOrder: 10 + index,
  }));
  const plan = planReconciledTimeline([...legacy, ...seeded]);
  assert.equal(plan.inserts.filter((row) => row.schedule === "rehearsal").length, 0);
  // David (2026-10-10): no moment twice. His edited 1:00 PM row stays; the unedited document copy beside it goes.
  assert.deepEqual(
    plan.removals.map((row) => row.id).sort(),
    [...legacy.slice(1).map((row) => row.id), "seeded-0"].sort(),
  );
  assert.deepEqual(plan.untouched.filter((row) => row.id.startsWith("reh.") || row.id.startsWith("seeded")), []);
  assert.deepEqual(
    plan.updates.filter((row) => row.schedule === "rehearsal").map((row) => row.id),
    ["reh.checkin"],
  );
});

test("rehearsal rows typed by hand at the document's times are matched, never doubled", () => {
  const typed = [
    { title: "Airbnb Check-in", startAt: "1:00 PM" },
    { title: "Depart Airbnb", startAt: "3:45 PM" },
    { title: "Dinner", startAt: "4:15 PM" },
    { title: "Rehearsal", startAt: "6:00 PM" },
    { title: "Return to Airbnb", startAt: "7:15 PM" },
    { title: "Photos by the lake", startAt: "1:00 PM" },
  ].map((row, index) => ({
    id: `typed-${index}`,
    seedKey: null,
    schedule: "rehearsal",
    startAt: row.startAt,
    endAt: null,
    notes: row.title,
    sortOrder: index,
  }));
  // First Apply: the five that are plainly the same moment are matched; the lake photos are their own row.
  const first = planReconciledTimeline(typed);
  assert.deepEqual(
    first.inserts.filter((row) => row.schedule === "rehearsal").map((row) => row.seedKey),
    ["reh.getready", "reh.depart-bss"],
  );
  assert.equal(first.removals.length, 0);
  assert.ok(first.untouched.some((row) => row.id === "typed-5"));

  // Already doubled by an earlier Apply: each unedited document copy goes, the typed row stays.
  const doubled = [
    ...typed,
    ...RECONCILED_TIMELINE.filter((moment) => moment.schedule === "rehearsal").map((moment, index) => ({
      id: `doc-${index}`,
      seedKey: moment.seedKey,
      schedule: "rehearsal",
      startAt: moment.startAt,
      endAt: moment.endAt,
      notes: index === 3 ? `${reconciledNotes(moment)}\nOwner note` : reconciledNotes(moment),
      sortOrder: 20 + index,
    })),
  ];
  const second = planReconciledTimeline(doubled);
  assert.deepEqual(second.removals.map((row) => row.id).sort(), ["doc-0", "doc-2", "doc-5", "doc-6"]);
  // The dinner copy was edited too: both stay for the owner, nothing of his is removed.
  assert.ok(second.untouched.some((row) => row.id === "typed-2"));
  assert.equal(second.removals.some((row) => row.id.startsWith("typed")), false);
  // Applying again changes nothing more.
  const after = doubled.filter((row) => !second.removals.some((gone) => gone.id === row.id));
  assert.equal(planReconciledTimeline(after).removals.length, 0);
  assert.equal(planReconciledTimeline(after).inserts.filter((row) => row.schedule === "rehearsal").length, 0);

  // David, 2026-10-10: "No apply button" — the edited pair is listed for him to pick one.
  const left = planReconciledTimeline(after);
  assert.deepEqual(left.doubles, [
    { startAt: "4:15 PM", mine: { id: "typed-2", title: "Dinner" }, document: { id: "doc-3", title: parseBlockNotes(doubled.find((row) => row.id === "doc-3")!.notes).title } },
  ]);
  assert.equal(doubledMomentToRemove(left, "typed-2"), "doc-3");
  assert.equal(doubledMomentToRemove(left, "doc-3"), "typed-2");
  assert.equal(doubledMomentToRemove(left, "typed-0"), null);
  // Once one copy goes, nothing is left to pick.
  const picked = after.filter((row) => row.id !== "doc-3");
  assert.deepEqual(planReconciledTimeline(picked).doubles, []);
  assert.equal(planReconciledTimeline(picked).inserts.filter((row) => row.schedule === "rehearsal").length, 0);
});
