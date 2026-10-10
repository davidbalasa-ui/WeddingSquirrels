import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBlockNotes } from "./day-of-now";
import { REHEARSAL_SCHEDULE_SEED } from "./rehearsal";
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
    ["reh.getready", "reh.depart-bss"],
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
    startAt: m.startAt,
    endAt: m.endAt,
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
    lines: moment.lines.filter((line) => !/bunks/.test(line)),
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
    wedding_party_leaves: { endAt: "12:20 PM", lines: ["Wedding party leaves for Black Sheep Shelter.", "David and Haley remain briefly for private vows with Belle."] },
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
    ["wedding_couple_departs", "12:30 PM", null],
    ["wedding_party_leaves", "12:00 PM", "12:30 PM"],
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
    wedding_toasts_cake: { openItems: "Confirm who is giving a toast, the order, and how long each person gets." },
    wedding_cocktail_hour: {
      lines: ["Bar service begins at 4:00 PM.", "Guests receive drinks and appetizers while photography continues."],
      openItems: "Confirm the bar will be ready at 4:00 PM.",
    },
    wedding_cake_cutting: {
      lines: ["Cut the cake immediately after toasts.", "Photographer and videographer are cued before cutting begins."],
      openItems: "Confirm when the cake arrives, who receives it, and who has the knife, plates, and serving plan.",
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
  const stillOpen = ["wedding_toasts_cake", "wedding_children_ready", "wedding_cake_cutting"];
  for (const row of plan.rewords.filter((r) => !stillOpen.includes(r.id))) {
    assert.equal(/Open items:/.test(row.notes), false, row.id);
  }
});
