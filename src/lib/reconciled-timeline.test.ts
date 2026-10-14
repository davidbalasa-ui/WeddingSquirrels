import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBlockNotes } from "./day-of-now";
import { REHEARSAL_SCHEDULE_SEED } from "./rehearsal";
import { scheduleLines } from "./schedule-consistency";
import {
  RECONCILED_RETIRED_SEED_KEYS,
  RECONCILED_TIMELINE,
  checkinCarriesBunksNote,
  doubledMomentToRemove,
  phaseForBlock,
  planReconciledTimeline,
  reconciledNotes,
  reconciledPlanIsEmpty,
  rehearsalRowsToPrint,
  type ExistingTimelineRow,
  type ReconciledMoment,
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

test("David's 9 Oct edits: boutonniere first look with his parents, named party shots; family photos back at 4:05 (Oct 11)", () => {
  // David, 2026-10-11 19:27: "Add from 4:05 to 4:30, family photos."
  const family = RECONCILED_TIMELINE.find((m) => m.seedKey === "wedding_family_photos_after")!;
  assert.deepEqual([family.startAt, family.endAt, family.title, family.lines], ["4:05 PM", "4:30 PM", "Family photos", []]);
  assert.equal(RECONCILED_RETIRED_SEED_KEYS.includes("wedding_family_photos_after"), false);
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
  // Only Thursday's 7:00 PM cake arrival (David, Oct 11 16:01) is new; it was never an app row.
  assert.deepEqual(plan.inserts.filter((row) => row.schedule === "rehearsal").map((row) => row.seedKey), ["reh.cake-arrives"]);
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

test("after an Apply that doubled the rehearsal, the untouched legacy copies are folded away and an edited one that adds a note is his to pick", () => {
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
  // David (2026-10-10): no moment twice. His edited 1:00 PM row carries a note the full moment
  // lacks ("bring the keys"), so neither copy is removed for him: both are listed to keep either.
  assert.deepEqual(plan.removals.map((row) => row.id).sort(), legacy.slice(1).map((row) => row.id).sort());
  assert.deepEqual(plan.doubles.map((pair) => [pair.mine.id, pair.document.id]), [["reh.checkin", "seeded-0"]]);
  assert.deepEqual(plan.updates.filter((row) => row.schedule === "rehearsal"), []);
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
    ["reh.getready", "reh.depart-bss", "reh.cake-arrives"],
  );
  assert.equal(first.removals.length, 0);
  assert.ok(first.untouched.some((row) => row.id === "typed-5"));

  // Already doubled by an earlier Apply. David, 2026-10-10: keep the full moments. A typed row
  // that says nothing the full moment does not goes on his Apply tap; the full copy stays.
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
  assert.deepEqual(second.removals.map((row) => row.id).sort(), ["typed-0", "typed-1", "typed-3", "typed-4"]);
  // The dinner copy was edited too: both stay for the owner to pick between.
  assert.deepEqual(second.doubles.map((pair) => [pair.mine.id, pair.document.id]), [["typed-2", "doc-3"]]);
  assert.equal(second.removals.some((row) => row.id.startsWith("doc")), false);
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

// David, 2026-10-11: "269-635-8458 is dans phone number for the get away vehicle".
test("the getaway moment as the app wrote it on Oct 10 gains Dan’s phone; the open item keeps only meeting him", () => {
  const moment = RECONCILED_TIMELINE.find((m) => m.seedKey === "wedding_getaway_arrives")!;
  assert.ok(moment.lines.includes("Dan’s phone: (269) 635-8458 (David, Oct 11)."));
  assert.equal(moment.openItems, "Confirm MOB will meet Dan.");
  const written = reconciledNotes({
    ...moment,
    lines: moment.lines.filter((line) => !line.startsWith("Dan’s phone") && !line.startsWith("John drops off")),
    openItems: "Confirm MOB will meet Dan and give her his phone number and arrival time.",
  });
  const rows: ExistingTimelineRow[] = RECONCILED_TIMELINE.map((m, index) => ({
    id: m.seedKey,
    seedKey: m.seedKey,
    schedule: m.schedule,
    // The app wrote it at 8:20–8:35 PM; David moved it to 8:30 PM on Oct 11.
    startAt: m === moment ? "8:20 PM" : m.startAt,
    endAt: m === moment ? "8:35 PM" : m.endAt,
    notes: m === moment ? written : reconciledNotes(m),
    sortOrder: index,
  }));
  const plan = planReconciledTimeline(rows);
  assert.equal(plan.rewords.length, 1);
  assert.equal(plan.rewords[0]!.correction, "Dan’s phone, arrives 8:30 PM");
  assert.equal(plan.rewords[0]!.startAt, "8:30 PM");
  assert.equal(plan.rewords[0]!.notes, reconciledNotes(moment));
});

// David, 2026-10-10: the getaway driver is Dan; the document said San.
test("a getaway moment still worded as the app wrote it is corrected to Dan by Apply; an edited one stays his", () => {
  const moment = RECONCILED_TIMELINE.find((m) => m.seedKey === "wedding_getaway_arrives")!;
  assert.doesNotMatch(reconciledNotes(moment), /\bSan\b/);
  const written = reconciledNotes({
    ...moment,
    lines: ["MOB or another helper meets San Vandenheede.", "Show San where to park, give him the “Just Married” sign, and tell the groom.", "Keep the vehicle details secret from the bride."],
    openItems: "Confirm MOB will meet San and give her his phone number and arrival time.",
  });
  const rows: ExistingTimelineRow[] = RECONCILED_TIMELINE.map((m, index) => ({
    id: m.seedKey,
    seedKey: m.seedKey,
    schedule: m.schedule,
    // The app wrote it at 8:20–8:35 PM; David moved it to 8:30 PM on Oct 11.
    startAt: m === moment ? "8:20 PM" : m.startAt,
    endAt: m === moment ? "8:35 PM" : m.endAt,
    notes: m === moment ? written : reconciledNotes(m),
    sortOrder: index,
  }));
  const plan = planReconciledTimeline(rows);
  assert.equal(plan.rewords.length, 1);
  assert.equal(plan.rewords[0]!.id, moment.seedKey);
  assert.equal(plan.rewords[0]!.correction, "San → Dan");
  assert.equal(plan.rewords[0]!.notes, reconciledNotes(moment));
  assert.equal(plan.updates.length, 0);
  assert.equal(reconciledPlanIsEmpty(plan), false);

  const edited = rows.map((row) => (row.id === moment.seedKey ? { ...row, notes: `${written}\nHe parks by the barn` } : row));
  const kept = planReconciledTimeline(edited);
  assert.equal(kept.rewords.length, 0);
  assert.equal(kept.updates.length, 1);
  assert.equal(reconciledPlanIsEmpty(kept), true);
});

// David, 2026-10-10 20:32: "skila and Trinity and bri claimed their bunks make a note of that".
test("Thursday's check-in moment gains the bunks note while it reads as the app wrote it; an edited one stays his", () => {
  const moment = RECONCILED_TIMELINE.find((m) => m.seedKey === "reh.checkin")!;
  assert.ok(moment.lines.includes("Skila, Trinity and Bri claimed their bunks (David, Oct 10)."));
  const written = reconciledNotes({
    ...moment,
    location: undefined,
    openItems: "Confirm the Airbnb address and who has check-in access.",
    lines: moment.lines.filter((line) => !/bunks|getting the access/.test(line)),
  });
  assert.equal(checkinCarriesBunksNote(written), true);
  assert.equal(checkinCarriesBunksNote(reconciledNotes(moment)), true);
  const rows: ExistingTimelineRow[] = RECONCILED_TIMELINE.map((m, index) => ({
    id: m.seedKey,
    seedKey: m.seedKey,
    schedule: m.schedule,
    startAt: m.startAt,
    endAt: m.endAt,
    notes: m === moment ? written : reconciledNotes(m),
    sortOrder: index,
  }));
  const plan = planReconciledTimeline(rows);
  assert.deepEqual(plan.rewords.map((row) => [row.id, row.correction]), [["reh.checkin", "bunks noted, Airbnb address"]]);
  assert.equal(plan.rewords[0]!.notes, reconciledNotes(moment));

  // David, 22:27: "haley will be getting the access" closes the check-in access line.
  assert.ok(moment.lines.includes("Haley will be getting the access (David, Oct 10)."));
  assert.equal(moment.openItems, undefined);
  const at154 = reconciledNotes({ ...moment, openItems: "Confirm who has check-in access.", lines: moment.lines.filter((line) => !/getting the access/.test(line)) });
  assert.equal(checkinCarriesBunksNote(at154), true);
  const closed = planReconciledTimeline(rows.map((row) => (row.id === moment.seedKey ? { ...row, notes: at154 } : row)));
  assert.deepEqual(closed.rewords.map((row) => [row.id, row.correction, row.notes]), [["reh.checkin", "Haley has check-in access", reconciledNotes(moment)]]);

  const edited = `${written}\nBring the air mattress`;
  assert.equal(checkinCarriesBunksNote(edited), false);
  const kept = planReconciledTimeline(rows.map((row) => (row.id === moment.seedKey ? { ...row, notes: edited } : row)));
  assert.equal(kept.rewords.length, 0);
});

// David, 2026-10-10 20:37: "get ready clothes for the bridal party is black for Friday morning".
test("Friday's first hair and makeup rotation gains the black clothes note while it reads as the app wrote it", () => {
  const moment = RECONCILED_TIMELINE.find((m) => m.seedKey === "wedding_hair_rotation_1")!;
  assert.ok(moment.lines.includes("Get ready clothes for the bridal party are black (David, Oct 10)."));
  const written = reconciledNotes({ ...moment, lines: moment.lines.filter((line) => !/black/.test(line)) });
  const rows: ExistingTimelineRow[] = RECONCILED_TIMELINE.map((m, index) => ({
    id: m.seedKey,
    seedKey: m.seedKey,
    schedule: m.schedule,
    startAt: m.startAt,
    endAt: m.endAt,
    notes: m === moment ? written : reconciledNotes(m),
    sortOrder: index,
  }));
  const plan = planReconciledTimeline(rows);
  assert.deepEqual(plan.rewords.map((row) => [row.id, row.correction]), [["wedding_hair_rotation_1", "black get ready clothes"]]);
  const kept = planReconciledTimeline(rows.map((row) => (row.id === moment.seedKey ? { ...row, notes: `${written}\nBring robes` } : row)));
  assert.equal(kept.rewords.length, 0);
});

// David's one-week check-in to the bridal party, 2026-10-10 20:40.
test("his one-week check-in retimes and rewords the moments the app wrote, and leaves edited ones alone", () => {
  const earlier: Record<string, Partial<ReconciledMoment>> = {
    wedding_party_leaves: { startAt: "12:00 PM", endAt: "12:20 PM", lines: ["Wedding party leaves for Black Sheep Shelter.", "David and Haley remain briefly for private vows with Belle."] },
    wedding_couple_departs: { startAt: "12:20 PM", endAt: "12:30 PM" },
    wedding_pre_ceremony: { lines: ["Guests arrive and are seated.", "Wedding party lines up.", "Barry photographs ceremony details and guest arrivals.", "No early bar service is planned."] },
  };
  const rows: ExistingTimelineRow[] = RECONCILED_TIMELINE.map((m, index) => {
    const was = { ...m, ...(earlier[m.seedKey] ?? {}) };
    return { id: m.seedKey, seedKey: m.seedKey, schedule: m.schedule, startAt: was.startAt, endAt: was.endAt, notes: reconciledNotes(was), sortOrder: index };
  });
  const plan = planReconciledTimeline(rows);
  assert.deepEqual(plan.updates, []);
  assert.deepEqual(plan.rewords.map((row) => [row.id, row.startAt, row.endAt]).sort(), [
    // David, 2026-10-13: both Friday groups leave the Airbnb 15 minutes earlier.
    ["wedding_couple_departs", "12:15 PM", null],
    ["wedding_party_leaves", "11:45 AM", "12:15 PM"],
    ["wedding_pre_ceremony", "3:15 PM", "3:30 PM"],
  ]);
  // A time he changed himself is his: nothing is reworded over it.
  const edited = planReconciledTimeline(rows.map((row) => (row.id === "wedding_couple_departs" ? { ...row, startAt: "12:25 PM" } : row)));
  assert.equal(edited.rewords.some((row) => row.id === "wedding_couple_departs"), false);
  assert.equal(edited.updates.some((row) => row.id === "wedding_couple_departs"), true);
});

// David, 2026-10-10 21:08: add Hawkshead's golf dress code to Thursday's rehearsal dinner.
test("Thursday's rehearsal dinner gains the Hawkshead dress code only while it reads as the app wrote it", () => {
  const moment = RECONCILED_TIMELINE.find((m) => m.seedKey === "reh.dinner")!;
  const written = reconciledNotes({ ...moment, lines: moment.lines.filter((line) => !/dress code/.test(line)) });
  const rows: ExistingTimelineRow[] = RECONCILED_TIMELINE.map((m, index) => ({
    id: m.seedKey,
    seedKey: m.seedKey,
    schedule: m.schedule,
    startAt: m.startAt,
    endAt: m.endAt,
    notes: m === moment ? written : reconciledNotes(m),
    sortOrder: index,
  }));
  assert.deepEqual(planReconciledTimeline(rows).rewords.map((row) => [row.id, row.correction]), [["reh.dinner", "Hawkshead dress code"]]);
  const edited = planReconciledTimeline(rows.map((row) => (row.id === "reh.dinner" ? { ...row, notes: `${written}\nBring a jacket` } : row)));
  assert.equal(edited.rewords.length, 0);
});

// David, 2026-10-10 21:46, of his wedding party packet's Thursday: "tons of issues" (every moment twice).
test("his short Thursday rows beside the full moments print once, as the full moments, and Apply folds his short rows away", () => {
  const own = [
    { startAt: "1:00 PM", notes: "Airbnb Check-in\n- Wedding party arrives" },
    { startAt: "3:45 PM", notes: "Depart Airbnb" },
    { startAt: "4:15 PM", endAt: "5:40 PM", notes: "Dinner\nLocation: Hawkshead" },
    { startAt: "5:40 PM", notes: "Depart for Black Sheep Shelter" },
    { startAt: "6:00 PM", endAt: "7:00 PM", notes: "Rehearsal" },
    { startAt: "7:15 PM", notes: "Return to Airbnb" },
  ].map((row, index) => ({ id: `own-${index}`, seedKey: null, schedule: "rehearsal", endAt: null, sortOrder: index, ...row }));
  const full = RECONCILED_TIMELINE.filter((m) => m.schedule === "rehearsal").map((m, index) => ({
    id: `doc-${index}`,
    seedKey: m.seedKey,
    schedule: "rehearsal",
    startAt: m.startAt,
    endAt: m.endAt,
    notes: reconciledNotes(m),
    sortOrder: 20 + index,
  }));
  const rows = [...own, ...full];
  assert.deepEqual(planReconciledTimeline(rows).removals.map((row) => row.id).sort(), own.map((row) => row.id).sort());
  const printed = rehearsalRowsToPrint(rows);
  assert.deepEqual(printed.map((row) => row.id), full.map((row) => row.id));
  // A short row with something of his own in it still prints, and nothing of his is folded away.
  const withNote = rows.map((row) => (row.id === "own-1" ? { ...row, notes: "Depart Airbnb\nBring the cooler" } : row));
  assert.ok(rehearsalRowsToPrint(withNote).some((row) => row.id === "own-1"));
  assert.equal(planReconciledTimeline(withNote).removals.some((row) => row.id === "own-1"), false);
});

// David, 2026-10-10 22:00 and 22:03: the 8:00 goodbyes, the 8:15 music change, and two open items closed.
test("his evening closures reword the moments the app wrote and close their open lines", () => {
  const earlier: Record<string, Partial<ReconciledMoment>> = {
    wedding_children_ready: { title: "Children get ready to leave", lines: ["Parents gather belongings and prepare children to leave."] },
    wedding_music_change: {
      title: "Music change and children’s send-off",
      lines: ["Shift to the later-evening music plan.", "Pause for the children’s farewell/send-off."],
      openItems: "Confirm each child’s ride and whether children leave at 8:00 PM or after the 8:15 PM send-off.",
    },
    wedding_last_dance: { openItems: "Confirm the correct version of “Moon” with the person handling the music." },
    wedding_toasts_cake: {
      title: "Toasts",
      startAt: "6:00 PM",
      endAt: "6:15 PM",
      lines: ["Best man, MOH, and FOB toasts."],
      openItems: "Confirm who is giving a toast, the order, and how long each person gets.",
    },
    wedding_cocktail_hour: {
      lines: ["Bar service begins at 4:00 PM.", "Guests receive drinks and appetizers while photography continues."],
      openItems: "Confirm the bar will be ready at 4:00 PM.",
    },
    wedding_teardown: {
      lines: ["Pack decor, gifts, personal belongings, remaining food, and vendor items."],
      openItems: "Choose who cleans each area and who takes the gifts, decor, food, alcohol, and personal items.",
    },
  };
  const rows: ExistingTimelineRow[] = RECONCILED_TIMELINE.map((m, index) => {
    const was = { ...m, ...(earlier[m.seedKey] ?? {}) };
    return { id: m.seedKey, seedKey: m.seedKey, schedule: m.schedule, startAt: was.startAt, endAt: was.endAt, notes: reconciledNotes(was), sortOrder: index };
  });
  const plan = planReconciledTimeline(rows);
  assert.deepEqual(plan.updates, []);
  assert.deepEqual(plan.rewords.map((row) => row.id).sort(), Object.keys(earlier).sort());
  const stillOpen = ["wedding_children_ready"];
  for (const row of plan.rewords.filter((r) => !stillOpen.includes(r.id))) {
    assert.equal(/Open items:/.test(row.notes), false, row.id);
  }
});

// David, 2026-10-10 22:27: "not sure about the call but precious peony serves out of the food truck".
test("the grand entrance is at 5:00 PM and dinner begins at 5:15 PM, when Avalon releases the tables", () => {
  const entrance = RECONCILED_TIMELINE.find((m) => m.seedKey === "wedding_dinner")!;
  const dinner = RECONCILED_TIMELINE.find((m) => m.seedKey === "wedding_dinner_service")!;
  assert.equal(entrance.title, "Grand entrance");
  assert.ok(entrance.lines.includes("Precious Peony serves out of the food truck (David, Oct 10)."));
  assert.equal(entrance.openItems, undefined);
  // David, 2026-10-11 15:50: "dinner begins at 5:15, avalon is releasing then".
  assert.equal(dinner.title, "Dinner begins");
  assert.equal(dinner.startAt, "5:15 PM");
  assert.equal(dinner.lines[0], "Avalon releases the tables and is responsible for it (David, Oct 11).");
  const rowsWith = (notes: Record<string, { notes: string; startAt: string; endAt: string | null }>): ExistingTimelineRow[] =>
    RECONCILED_TIMELINE.map((m, index) => ({
      id: m.seedKey,
      seedKey: m.seedKey,
      schedule: m.schedule,
      startAt: notes[m.seedKey]?.startAt ?? m.startAt,
      endAt: notes[m.seedKey] ? notes[m.seedKey]!.endAt : m.endAt,
      notes: notes[m.seedKey]?.notes ?? reconciledNotes(m),
      sortOrder: index,
    }));
  const oldEntrance = (lines: string[], openItems?: string) => ({
    notes: reconciledNotes({ ...entrance, title: "Grand entrance and dinner begins", lines, openItems }),
    startAt: "5:00 PM",
    endAt: null,
  });
  const base = ["Grand entrance starts at 5:00 PM.", "Immediately after the entrance, David and Haley get their food.", "Once David and Haley have food, tables are called up."];
  const oldService = {
    notes: reconciledNotes({ ...dinner, title: "Dinner service", lines: ["Guests eat while the couple circulates only as time permits.", "Prepare toast speakers near the end of dinner."] }),
    startAt: "5:00 PM",
    endAt: "6:00 PM",
  };
  // Every wording the app wrote comes up to date: Oct 10 (food truck), 15:13 (Avalon), and the 5:00 PM dinner service.
  for (const [entranceRow, correction] of [
    [oldEntrance(base, "Choose who calls tables and confirm how Precious Peony will serve dinner."), "Precious Peony serves from the food truck"],
    [oldEntrance([...base, "Precious Peony serves out of the food truck (David, Oct 10)."], "Choose who calls tables."), "Avalon releases the tables"],
    [oldEntrance([...base, "Precious Peony serves out of the food truck (David, Oct 10).", "Avalon releases the tables and is responsible for it (David, Oct 11)."]), "dinner begins 5:15 PM"],
  ] as const) {
    const plan = planReconciledTimeline(rowsWith({ wedding_dinner: entranceRow, wedding_dinner_service: oldService }));
    assert.deepEqual(
      plan.rewords.map((row) => [row.id, row.correction]).sort(),
      [["wedding_dinner", correction], ["wedding_dinner_service", "dinner begins 5:15 PM"]].sort(),
    );
    assert.equal(plan.rewords.find((row) => row.id === "wedding_dinner_service")!.startAt, "5:15 PM");
  }
  // A dinner moment David edited himself stays his.
  const edited = { ...oldService, notes: `${oldService.notes}\nAsk Wendy` };
  assert.equal(planReconciledTimeline(rowsWith({ wedding_dinner_service: edited })).rewords.length, 0);
});

// David, 2026-10-11 12:33 and 12:46: the bartender line carries one time; cocktail hour ends at 5:00, last pours at 4:50.
test("cocktail hour runs 4:00–5:00 PM, the last-pour cue is at 4:50, and 4:45 has no announcement", () => {
  const moment = RECONCILED_TIMELINE.find((m) => m.seedKey === "wedding_cocktail_hour")!;
  assert.equal(moment.endAt, "5:00 PM");
  // David, 2026-10-14 14:53: "We do want the bartender arriving at 2:30." It rides the 2:30 PM wedding party photos.
  assert.equal(moment.lines.some((line) => /bartender/i.test(line)), false);
  const party = RECONCILED_TIMELINE.find((m) => m.seedKey === "wedding_party_photos")!;
  assert.ok(party.lines.includes("The bartender arrives at Black Sheep Shelter at 2:30 PM (David, Oct 14)."));
  assert.equal(moment.lines.some((line) => /ready by/.test(line)), false);
  const touchups = RECONCILED_TIMELINE.find((m) => m.seedKey === "wedding_final_touchups")!;
  assert.equal(touchups.startAt, "4:45 PM");
  assert.equal(touchups.lines.some((line) => /MC cue/i.test(line)), false);
  const pour = RECONCILED_TIMELINE.find((m) => m.seedKey === "wedding_last_pour")!;
  assert.deepEqual([pour.startAt, pour.lines], ["4:50 PM", ["MC cue 4:50 PM: Last cocktail pours, ending in 10 minutes."]]);
  assert.equal(RECONCILED_TIMELINE.some((m) => m.lines.some((line) => /4:35/.test(line))), false);
  // His row as #155 left it comes up to date on the next page load.
  const was = reconciledNotes({
    ...moment,
    lines: ["Bartender arrives at 3:00 PM and will be ready by 4:00 PM (David, Oct 10).", ...moment.lines],
  });
  const plan = planReconciledTimeline([{ id: "c", seedKey: moment.seedKey, schedule: "wedding", startAt: "4:00 PM", endAt: "5:00 PM", notes: was, sortOrder: 0 }]);
  assert.deepEqual(plan.rewords.map((r) => [r.id, r.endAt, r.correction]), [["c", "5:00 PM", "bartender line carries only 3:00 PM"]]);
  const at3 = reconciledNotes({ ...moment, lines: ["Bartender arrives at 3:00 PM (David, Oct 10).", ...moment.lines] });
  const plan3 = planReconciledTimeline([{ id: "c", seedKey: moment.seedKey, schedule: "wedding", startAt: "4:00 PM", endAt: "5:00 PM", notes: at3, sortOrder: 0 }]);
  assert.deepEqual(plan3.rewords.map((r) => [r.id, r.correction]), [["c", "bartender arrives 2:30 PM"]]);
});

// David, 2026-10-11 16:15: "toasts will be 6-6:15, cake cutting is :15 to 6:30, dance announcement at 6:25.
// formal dances are 6:30 to 6:45".
// David, 2026-10-13 22:57: "move golden hour photos to 6:25 and push the dances back 10 minutes".
// David, 2026-10-14 14:53–14:55: cake cutting and golden hour can't overlap; golden hour photos 5:45; dances back at 6:30–6:45.
// David, 2026-10-14 16:57, his own edit of the Master, and 19:00: the clear-the-center line goes directly before the dances.
test("the evening matches his Master: sunset 6:15, cake and toasts 6:30, dances 6:50 with the clear-the-center line, dancing 7:00", () => {
  const at = (key: string) => RECONCILED_TIMELINE.find((m) => m.seedKey === key)!;
  assert.deepEqual([at("wedding_golden_hour").startAt, at("wedding_golden_hour").endAt, at("wedding_golden_hour").title], ["6:15 PM", "6:30 PM", "Sunset photos"]);
  const cake = at("wedding_toasts_cake");
  assert.deepEqual([cake.startAt, cake.endAt, cake.title], ["6:30 PM", "6:45 PM", "Cake cutting and toasts"]);
  assert.match(cake.lines[0]!, /^MC cue 6:30 PM: "Gather near the cake table/);
  assert.match(cake.lines[1]!, /^MC cue: "Please return to your seats\. Our storytellers/);
  assert.equal(cake.openItems, undefined);
  const dances = at("wedding_first_dances");
  assert.deepEqual([dances.startAt, dances.endAt], ["6:50 PM", "7:00 PM"]);
  assert.match(dances.lines[0]!, /^MC cue 6:50 PM: Clear the center area and turn your chairs/);
  assert.deepEqual([at("wedding_open_dancing").startAt, at("wedding_open_dancing").endAt], ["7:00 PM", "8:00 PM"]);
  assert.equal(at("wedding_bonfire").startAt, "7:00 PM");
  assert.equal(RECONCILED_TIMELINE.some((m) => m.seedKey === "wedding_cake_cutting" || m.seedKey === "wedding_first_dance_announcement"), false);
  assert.equal(RECONCILED_TIMELINE.some((m) => m.lines.some((line) => /golden.hour|toasts? 6:00|MC cue 6:00/i.test(line))), false);

  // His rows as corrections 28 wrote them move to the Master's times.
  const announce = "MC cue 6:30 PM: Clear the center area and turn your chairs to the middle of the walk area for the bride and groom’s first dance, followed by the bride and her father.";
  const cakeLines = [
    "Cut the cake immediately after toasts.",
    "Photographer and videographer are cued before cutting begins.",
    "Cake placed in center and desserts rotated around on the glass plates on small plates (David, Oct 10).",
  ];
  const before: ExistingTimelineRow[] = [
    { id: "g", seedKey: "wedding_golden_hour", schedule: "wedding", startAt: "5:45 PM", endAt: "5:55 PM", sortOrder: 1,
      notes: reconciledNotes({ ...at("wedding_golden_hour"), title: "Outdoor golden-hour photos", lines: ["Outdoor portraits with Barry."] }) },
    { id: "t", seedKey: "wedding_toasts_cake", schedule: "wedding", startAt: "6:00 PM", endAt: "6:15 PM", sortOrder: 2,
      notes: reconciledNotes({ ...cake, title: "Toasts", lines: ['MC cue 6:00 PM: "As dinner winds down, please return to your seats."', "Best man, MOH, and FOB toasts."], openItems: "Confirm the toast order and how long each person gets." }) },
    { id: "c", seedKey: "wedding_cake_cutting", schedule: "wedding", startAt: "6:15 PM", endAt: "6:30 PM", sortOrder: 3,
      notes: reconciledNotes({ ...cake, title: "Cake cutting", lines: cakeLines, openItems: undefined }) },
    { id: "a", seedKey: "wedding_first_dance_announcement", schedule: "wedding", startAt: "6:30 PM", endAt: null, sortOrder: 4,
      notes: reconciledNotes({ ...cake, title: "Clear the center for the first dance", lines: [announce], openItems: undefined }) },
    { id: "d", seedKey: "wedding_first_dances", schedule: "wedding", startAt: "6:30 PM", endAt: "6:45 PM", sortOrder: 5,
      notes: reconciledNotes({ ...dances, lines: dances.lines.slice(1) }) },
    { id: "o", seedKey: "wedding_open_dancing", schedule: "wedding", startAt: "6:45 PM", endAt: "8:00 PM", sortOrder: 6, notes: reconciledNotes(at("wedding_open_dancing")) },
  ];
  const plan = planReconciledTimeline(before);
  assert.deepEqual(plan.rewords.map((r) => [r.id, r.startAt, r.endAt, r.correction]).sort(), [
    ["d", "6:50 PM", "7:00 PM", "formal dances 6:50–7:00 PM"],
    ["g", "6:15 PM", "6:30 PM", "sunset photos 6:15–6:30 PM"],
    ["o", "7:00 PM", "8:00 PM", "open dancing 7:00 PM"],
    ["t", "6:30 PM", "6:45 PM", "cake cutting and toasts 6:30–6:45 PM"],
  ]);
  // The cake and announcement moments, as the app wrote them, go without a tap; their words live on in the moments above.
  assert.deepEqual(plan.drops!.map((r) => r.id).sort(), ["a", "c"]);
  assert.deepEqual(plan.removals, []);
  // An older wording of either (the 6:35 announcement, the 6:05 cake) goes too.
  const older: ExistingTimelineRow[] = [
    { id: "a2", seedKey: "wedding_first_dance_announcement", schedule: "wedding", startAt: "6:35 PM", endAt: null, sortOrder: 1,
      notes: reconciledNotes({ ...cake, title: "Clear the center for the first dance", lines: [announce.replace("6:30 PM", "6:35 PM")], openItems: undefined }) },
    { id: "c2", seedKey: "wedding_cake_cutting", schedule: "wedding", startAt: "6:05 PM", endAt: null, sortOrder: 2,
      notes: reconciledNotes({ ...cake, title: "Cake cutting", lines: cakeLines, openItems: undefined }) },
  ];
  assert.deepEqual(planReconciledTimeline(older).drops!.map((r) => r.id).sort(), ["a2", "c2"]);
  // One he edited himself waits for his tap.
  const edited = planReconciledTimeline([{ ...before[2]!, notes: before[2]!.notes + "\nBring the dagger." }]);
  assert.deepEqual(edited.removals.map((r) => r.id), ["c"]);
  assert.deepEqual(edited.drops, []);
});

// David, 2026-10-11 15:13: "1:30 is the first look with dad, straight into parent photos."
test("Haley's first look with her dad opens the 1:30 PM parent photos, and the old 1:15 PM line never prints", () => {
  const moment = RECONCILED_TIMELINE.find((m) => m.seedKey === "wedding_haley_family_photos")!;
  // David, 2026-10-14 14:53: "1:15 should be fine for the first look with her dad."
  assert.deepEqual([moment.startAt, moment.endAt], ["1:15 PM", "1:45 PM"]);
  // David, 2026-10-13 22:27: "Haley and dad first look in the field."
  assert.equal(moment.lines[0], "Haley’s first look with her dad is in the field, then straight into parent photos (David, Oct 11 and Oct 13).");
  const oct10 = reconciledNotes({ ...moment, lines: ["Haley with parents.", "Haley with mom.", "Haley with dad.", "Haley first look with Dad."] });
  const rows: ExistingTimelineRow[] = RECONCILED_TIMELINE.map((m, index) => ({
    id: m.seedKey,
    seedKey: m.seedKey,
    schedule: m.schedule,
    startAt: m.startAt,
    endAt: m.endAt,
    notes: m === moment ? oct10 : reconciledNotes(m),
    sortOrder: index,
  })).map((row) => (row.id === moment.seedKey ? { ...row, startAt: "1:30 PM" } : row));
  assert.deepEqual(planReconciledTimeline(rows).rewords.map((row) => [row.id, row.correction]), [["wedding_haley_family_photos", "first look with dad at 1:30 PM"]]);
  const at130 = rows.map((row) => (row.id === moment.seedKey ? { ...row, notes: reconciledNotes(moment) } : row));
  assert.deepEqual(planReconciledTimeline(at130).rewords.map((row) => [row.id, row.startAt, row.correction]), [["wedding_haley_family_photos", "1:15 PM", "first look with dad at 1:15 PM"]]);
  const oct11 = reconciledNotes({ ...moment, lines: ["Haley’s first look with her dad, then straight into parent photos (David, Oct 11).", ...moment.lines.slice(1)] });
  const oct11Rows = rows.map((row) => (row.id === moment.seedKey ? { ...row, notes: oct11 } : row));
  assert.deepEqual(planReconciledTimeline(oct11Rows).rewords.map((row) => [row.id, row.correction]), [["wedding_haley_family_photos", "first look with dad in the field"]]);
  assert.deepEqual(scheduleLines(["1:15 PM — Haley first look with Dad", "1:30 PM — bridal portraits"]), ["1:30 PM — bridal portraits"]);
});

// David, 2026-10-11 15:18: "bonfire time start is 7PM".
test("the bonfire starts at 7:00 PM on the wedding timeline", () => {
  const moment = RECONCILED_TIMELINE.find((m) => m.seedKey === "wedding_bonfire")!;
  assert.equal(moment.startAt, "7:00 PM");
  assert.equal(moment.title, "Bonfire and s’mores");
});

// David, 2026-10-11 15:57: "change bride with veil portriats to bride with tiara".
test("the bride's portrait while Haley gets dressed is with her tiara, not a veil", () => {
  const moment = RECONCILED_TIMELINE.find((m) => m.seedKey === "wedding_getting_dressed")!;
  assert.ok(moment.lines.includes("Mom buttons the dress; bride-with-tiara portrait."));
  const old = reconciledNotes({ ...moment, lines: ["Haley gets into her dress with MOB and MOH helping.", "Mom buttons the dress; bride-with-veil portrait.", "Children arrive at 1:15 PM."] });
  const rows: ExistingTimelineRow[] = RECONCILED_TIMELINE.map((m, index) => ({
    id: m.seedKey,
    seedKey: m.seedKey,
    schedule: m.schedule,
    startAt: m.startAt,
    endAt: m.endAt,
    notes: m === moment ? old : reconciledNotes(m),
    sortOrder: index,
  }));
  assert.deepEqual(planReconciledTimeline(rows).rewords.map((row) => [row.id, row.correction]), [["wedding_getting_dressed", "bride with tiara"]]);
});

// David, 2026-10-11 16:00: "David will give the gifts to the girls at 1:45 during first look with the girls".
// David, 2026-10-13 22:27: "Let's push kids first look to 2:15 and it will be first look with Dad and Haley. Kids must remain
// hidden from Haley and dad during this time. ... And kids brought to where ever we are."
// David, 2026-10-14 14:59: "For the girls, first look, 225 should be fine."
test("the kids' first look is at 2:25 with David and Haley, and David gives the girls their gifts during it", () => {
  const moment = RECONCILED_TIMELINE.find((m) => m.seedKey === "wedding_david_girls_first_look")!;
  assert.equal(moment.startAt, "2:25 PM");
  assert.equal(moment.title, "Kids’ first look with David and Haley");
  assert.deepEqual(moment.lines, [
    "The kids must remain hidden from Haley and David until then, and are brought to wherever David and Haley are (David, Oct 13).",
    "David gives the girls their gifts during the first look (David, Oct 11).",
  ]);
  const earlier = { ...moment, startAt: "1:45 PM", title: "David’s first look with the girls" };
  const rows: ExistingTimelineRow[] = RECONCILED_TIMELINE.map((m, index) => ({
    id: m.seedKey,
    seedKey: m.seedKey,
    schedule: m.schedule,
    startAt: m.startAt,
    endAt: m.endAt,
    notes: m === moment ? reconciledNotes({ ...earlier, lines: [] }) : reconciledNotes(m),
    sortOrder: index,
  })).map((row) => (row.id === moment.seedKey ? { ...row, startAt: "1:45 PM" } : row));
  const plan = planReconciledTimeline(rows);
  assert.deepEqual(plan.rewords.map((row) => [row.id, row.correction]), [["wedding_david_girls_first_look", "girls' gifts at 1:45 PM"]]);
  assert.equal(plan.rewords[0].startAt, "2:25 PM");
  const oct11 = rows.map((row) => (row.id === moment.seedKey ? { ...row, notes: reconciledNotes({ ...earlier, lines: ["David gives the girls their gifts during the first look (David, Oct 11)."] }) } : row));
  assert.deepEqual(planReconciledTimeline(oct11).rewords.map((row) => [row.id, row.correction]), [["wedding_david_girls_first_look", "kids' first look 2:15 PM with David and Haley"]]);
  const at215 = rows.map((row) => (row.id === moment.seedKey ? { ...row, startAt: "2:15 PM", notes: reconciledNotes(moment) } : row));
  assert.deepEqual(planReconciledTimeline(at215).rewords.map((row) => [row.id, row.startAt, row.correction]), [["wedding_david_girls_first_look", "2:25 PM", "kids' first look 2:25 PM"]]);
});

// David, 2026-10-13 22:27: "David and Haley first look to be first look at viniard fence."
test("David and Haley's first look is at the vineyard fence, at its same time", () => {
  const moment = RECONCILED_TIMELINE.find((m) => m.seedKey === "wedding_first_look")!;
  assert.equal(moment.startAt, "2:00 PM");
  assert.deepEqual(moment.lines, ["Private first look at the vineyard fence, followed by immediate couple portraits (David, Oct 13)."]);
  const rows: ExistingTimelineRow[] = RECONCILED_TIMELINE.map((m, index) => ({
    id: m.seedKey, seedKey: m.seedKey, schedule: m.schedule, startAt: m.startAt, endAt: m.endAt,
    notes: m === moment ? reconciledNotes({ ...moment, lines: ["Private first look followed by immediate couple portraits."] }) : reconciledNotes(m),
    sortOrder: index,
  }));
  assert.deepEqual(planReconciledTimeline(rows).rewords.map((row) => [row.id, row.correction]), [["wedding_first_look", "first look at the vineyard fence"]]);
});

// David, 2026-10-11 16:01 and 16:03: the cake comes Thursday at 7:00 PM with Braxton; Friday 2:00–2:30 has no cake.
test("the cake arrives at Black Sheep Thursday at 7:00 PM with Braxton, and Friday 2:00–2:30 never mentions it", () => {
  const moment = RECONCILED_TIMELINE.find((m) => m.seedKey === "reh.cake-arrives")!;
  assert.equal(moment.schedule, "rehearsal");
  assert.equal(moment.startAt, "7:00 PM");
  assert.equal(moment.title, "Cake arrives at Black Sheep Shelter");
  assert.deepEqual(scheduleLines(moment.lines), ["Braxton brings the cake from the Airbnb to Black Sheep Shelter (David, Oct 11)."]);
  assert.deepEqual(
    scheduleLines(["2:00 PM — Haley and David first look", "2:00 PM — Denise and Lisa pick up cake at Airbnb; 2:30 PM arrive at BSS (fridge by suites)", "2:30 PM — immediate family portraits"]),
    ["2:00 PM — Haley and David first look", "2:30 PM — immediate family portraits"],
  );
  assert.ok(RECONCILED_TIMELINE.filter((m) => m.schedule === "wedding").every((m) => !m.lines.some((line) => /cake/i.test(line) && /\b2:(?:00|30)\b/.test(line))));
});
