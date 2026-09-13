import assert from "node:assert/strict";
import { test } from "node:test";
import {
  placeAddressLines,
  quickReferencePlaces,
  todayVenueLabel,
} from "./wedding-venue";

test("todayVenueLabel prefers canonical AppSettings fields", () => {
  const label = todayVenueLabel({
    venueName: "Black Sheep Shelter",
    venueStreet: "342 62nd St",
    venueCity: "South Haven",
    venueState: "MI",
    venueZip: "49090",
  });
  assert.match(label ?? "", /Black Sheep Shelter/);
  assert.match(label ?? "", /342 62nd St/);
});

test("quickReferencePlaces maps venue and rehearsal dinner", () => {
  const places = quickReferencePlaces({
    venueName: "Venue A",
    venueStreet: "1 Main",
    venueCity: "Town",
    venueState: "MI",
    venueZip: "12345",
    rehearsalDinnerName: "Hawkshead",
    rehearsalDinnerStreet: "523 Hawks Nest Dr",
    rehearsalDinnerCity: "South Haven",
    rehearsalDinnerState: "MI",
    rehearsalDinnerZip: null,
  });
  assert.equal(places.venueName, "Venue A");
  assert.deepEqual(places.venueAddress, ["1 Main", "Town, MI 12345"]);
  assert.equal(places.rehearsalDinnerName, "Hawkshead");
  assert.deepEqual(places.rehearsalDinnerAddress, ["523 Hawks Nest Dr", "South Haven, MI"]);
});

test("placeAddressLines handles partial addresses", () => {
  assert.deepEqual(placeAddressLines({ street: "123 St", city: "X", state: "MI", zip: null }), [
    "123 St",
    "X, MI",
  ]);
});
