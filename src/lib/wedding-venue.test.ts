import assert from "node:assert/strict";
import { test } from "node:test";
import { placeAddressLines, weddingPlacesFromPlan, weddingVenueLabel } from "./wedding-venue";
import { RECONCILED_TIMELINE, reconciledNotes } from "./reconciled-timeline";
import { REHEARSAL_SCHEDULE_SEED } from "./rehearsal";

test("the places come from the plan, with no typing: venue, rehearsal dinner and lodging", () => {
  const places = weddingPlacesFromPlan([]);
  assert.deepEqual(places.venue, { name: "Black Sheep Shelter", address: ["342 62nd St", "South Haven, MI 49090"] });
  assert.deepEqual(places.rehearsalDinner, { name: "Hawkshead", address: ["523 Hawks Nest Dr", "South Haven, MI"] });
  assert.deepEqual(places.lodging, { name: "Airbnb", address: ["10268 51st St", "Grand Junction, MI 49056"] });
  assert.equal(weddingVenueLabel(places), "Black Sheep Shelter · 342 62nd St, South Haven, MI 49090");
});

test("an address on a page moment is the one used, so a correction on the page reaches every screen", () => {
  const places = weddingPlacesFromPlan([
    { notes: "Depart for Hawkshead\nlocation: Hawkshead, 523 Hawks Nest Drive, South Haven" },
    { notes: "Rehearsal\nVenue: 342 62nd Street, South Haven, MI 49090" },
  ]);
  assert.deepEqual(places.rehearsalDinner.address, ["523 Hawks Nest Drive, South Haven"]);
  assert.deepEqual(places.venue.address, ["342 62nd Street", "South Haven, MI 49090"]);
  // A moment that only names the place leaves the address from his documents.
  assert.deepEqual(weddingPlacesFromPlan([{ notes: "Depart for Hawkshead" }]).rehearsalDinner.address, ["523 Hawks Nest Dr", "South Haven, MI"]);
});

test("his reconciled day and the app's first rehearsal rows both give the same three places", () => {
  for (const blocks of [
    RECONCILED_TIMELINE.map((moment) => ({ notes: reconciledNotes(moment) })),
    REHEARSAL_SCHEDULE_SEED.map((row) => ({ notes: row.notes })),
  ]) {
    const places = weddingPlacesFromPlan(blocks);
    assert.equal(places.venue.name, "Black Sheep Shelter");
    assert.match(places.rehearsalDinner.address.join(", "), /^523 Hawks Nest Dr/);
    assert.equal(places.lodging.address[0], "10268 51st St");
  }
});

test("placeAddressLines handles partial addresses", () => {
  assert.deepEqual(placeAddressLines({ street: "123 St", city: "X", state: "MI", zip: null }), [
    "123 St",
    "X, MI",
  ]);
});
