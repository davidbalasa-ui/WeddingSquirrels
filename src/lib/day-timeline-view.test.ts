import assert from "node:assert/strict";
import { test } from "node:test";
import { duplicateFlagLabel, findTimelineDuplicates, reviewMoment } from "./day-timeline-view";

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
  assert.deepEqual(view.details, [
    { kind: "note", text: "Guests enjoy drinks" },
    { kind: "note", text: "appetizers out" },
    { kind: "cue", text: "4:45 PM: Cocktail hour is nearing its end" },
    { kind: "music", text: "Cocktail mix" },
  ]);
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
