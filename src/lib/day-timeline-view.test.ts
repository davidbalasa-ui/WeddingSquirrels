import assert from "node:assert/strict";
import { test } from "node:test";
import { duplicateFlagLabel, findTimelineDuplicates, inferLineRoles, momentForRole, reviewMoment } from "./day-timeline-view";

test("reviewMoment splits title, location, bullets, cues and music", () => {
  const view = reviewMoment({
    startAt: "4:00 PM",
    endAt: "5:00 pm",
    notes:
      "Cocktail Hour\nlocation: Bar + trailer\nGuests enjoy drinks; appetizers out\nMC cue at 4:45 PM: Cocktail hour is nearing its end\nPlaylist: Cocktail mix",
  });
  assert.equal(view.timeLabel, "4:00 PM – 5:00 PM");
  assert.equal(view.timeStart, "4:00 PM");
  assert.equal(view.timeEnd, "5:00 PM");
  assert.equal(view.title, "Cocktail Hour");
  assert.equal(view.location, "Bar + trailer");
  assert.deepEqual(
    view.details.map((d) => ({ kind: d.kind, text: d.text })),
    [
      { kind: "note", text: "Guests enjoy drinks" },
      { kind: "note", text: "appetizers out" },
      { kind: "cue", text: "4:45 PM: Cocktail hour is nearing its end" },
      { kind: "music", text: "Cocktail mix" },
    ],
  );
  assert.deepEqual(view.details[2]!.roles, ["mc"]);
  assert.deepEqual(view.details[0]!.roles, []);
  assert.equal(view.details[2]!.time, null);
});

test("reviewMoment keeps untimed and single times as written", () => {
  assert.equal(reviewMoment({ startAt: "TBD", endAt: null, notes: "Dollar dance" }).timeLabel, "TBD");
  const same = reviewMoment({ startAt: "3:30 PM", endAt: "3:30 PM", notes: "Ceremony" });
  assert.equal(same.timeLabel, "3:30 PM");
  assert.equal(same.timeEnd, null);
});

test("findTimelineDuplicates flags repeated titles and titles echoed in notes", () => {
  const flags = findTimelineDuplicates([
    { id: "a", notes: "Venue Opens\nVendors arrive" },
    { id: "b", notes: "Vendor + Wedding Party Arrival\nVenue opens\nDecor setup" },
    { id: "c", notes: "Ceremony\nUnder the shelter" },
    { id: "d", notes: "Ceremony\nMC cue: welcome" },
    { id: "e", notes: "Dinner begins\nGuests seated" },
  ]);
  assert.deepEqual(flags.a, [{ kind: "title-in-notes", otherId: "b", otherTitle: "Vendor + Wedding Party Arrival" }]);
  assert.deepEqual(flags.b, [{ kind: "title-in-notes", otherId: "a", otherTitle: "Venue Opens" }]);
  assert.deepEqual(flags.c, [{ kind: "same-title", otherId: "d", otherTitle: "Ceremony" }]);
  assert.deepEqual(flags.d, [{ kind: "same-title", otherId: "c", otherTitle: "Ceremony" }]);
  assert.equal(flags.e, undefined);
  assert.equal(duplicateFlagLabel(flags.c![0]!), "Same title as “Ceremony”");
});

test("inferLineRoles reads roles from words already in the line and from known names", () => {
  assert.deepEqual(inferLineRoles("Wedding party lines up"), ["party"]);
  assert.deepEqual(inferLineRoles("Photographer captures robe photos"), ["party", "photo"]);
  assert.deepEqual(inferLineRoles("Toasts (Best man, MOH, FOB)"), ["party", "family"]);
  assert.deepEqual(inferLineRoles("Everyone helps pack up before the night is over"), ["helpers"]);
  assert.deepEqual(inferLineRoles("Katie and Belle arrive at 11:00 AM", { party: ["Katie Smith"] }), ["party"]);
  assert.deepEqual(inferLineRoles("Kurt gets the mic", { mc: ["Kurt Huizenga"] }), ["mc"]);
  assert.deepEqual(inferLineRoles("Private vows"), []);
});

test("momentForRole keeps whole moments the title names and filters lines otherwise", () => {
  const first = reviewMoment({ startAt: "2:45 PM", endAt: "3:15 PM", notes: "First Look + Portraits\nFirst look w/ David\nCouple portraits" });
  assert.deepEqual(first.roles, ["photo"]);
  assert.equal(momentForRole(first, "photo")?.details.length, 2);
  assert.equal(momentForRole(first, "mc"), null);

  const dinner = reviewMoment({ startAt: "5:00 PM", endAt: "6:00 PM", notes: "Dinner begins\nGuests seated\nGrand entrance\nDinner service starts" });
  assert.deepEqual(dinner.roles, []);
  assert.deepEqual(momentForRole(dinner, "mc")?.details.map((d) => d.text), ["Grand entrance"]);
  assert.equal(momentForRole(dinner, null), dinner);
});

test("reviewMoment reads open items, bullets with their own semicolons, and margin times", () => {
  const view = reviewMoment({
    startAt: "1:00 PM",
    endAt: "1:30 PM",
    notes: "Haley gets dressed\nHair: Braxton in Bathroom 1; Andi in Bathroom 2.\nChildren arrive at 1:15 PM.\nOpen items: Confirm who buttons the dress.",
  });
  assert.deepEqual(
    view.details.map((d) => [d.kind, d.text, d.time]),
    [
      ["note", "Hair: Braxton in Bathroom 1; Andi in Bathroom 2.", null],
      ["note", "Children arrive at 1:15 PM.", "1:15 PM"],
      ["open", "Confirm who buttons the dress.", null],
    ],
  );
});

test("findTimelineDuplicates leaves moments more than half an hour apart alone", () => {
  const flags = findTimelineDuplicates([
    { id: "pre", startAt: "3:15 PM", notes: "Get ready for the ceremony\nWedding party lines up." },
    { id: "entrance", startAt: "4:50 PM", notes: "Wedding party lines up\nGuests move to dinner seating." },
    { id: "dance1", startAt: "7:00 PM", notes: "Open dancing\nDance floor opens." },
    { id: "dance2", startAt: "9:00 PM", notes: "Open dancing\nDavid and Haley return." },
    { id: "c1", startAt: "3:30 PM", notes: "Ceremony\nUnder the shelter" },
    { id: "c2", startAt: "3:45 PM", notes: "Ceremony\nVows" },
  ]);
  assert.deepEqual(Object.keys(flags).sort(), ["c1", "c2"]);
});

test("the photographer view keeps a moment whose only photo line is a single portrait", () => {
  const moment = reviewMoment(
    { startAt: "1:00 PM", endAt: "1:30 PM", notes: "Haley gets dressed\nMom buttons the dress; bride-with-veil portrait." },
    {},
  );
  assert.ok(momentForRole(moment, "photo"));
});

test("every group view keeps the ceremony with its time and title", () => {
  const ceremony = reviewMoment({ startAt: "3:30 PM", endAt: "4:00 PM", notes: "Ceremony\n@ Under the shelter" }, {});
  for (const role of ["mc", "party", "family", "photo", "vendors"] as const) assert.ok(momentForRole(ceremony, role), role);
});
