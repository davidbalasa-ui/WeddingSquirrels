import assert from "node:assert/strict";
import { test } from "node:test";
import { linkedIdentityForPerson, stayLabelForExactName } from "./people-profile";

test("linkedIdentityForPerson attaches only personId matches", () => {
  const linked = linkedIdentityForPerson("bri", {
    guestPeople: [
      { id: "gp-bri", personId: "bri", name: "Bri Eling" },
      { id: "gp-other", personId: null, name: "Bri" },
    ],
    contacts: [
      { id: "c-bri", personId: "bri", name: "Bri Eling" },
      { id: "c-role", personId: null, name: "Bri Eling · Planner" },
    ],
    mealGuests: [
      { id: "meal.bri", personId: null, name: "Bri" },
      { id: "meal.other", personId: "bri", name: "Bri Eling" },
    ],
  });
  assert.deepEqual(
    linked.guestPeople.map((row) => row.id),
    ["gp-bri"],
  );
  assert.deepEqual(
    linked.contacts.map((row) => row.id),
    ["c-bri"],
  );
  assert.deepEqual(
    linked.mealGuests.map((row) => row.id),
    ["meal.other"],
  );
});

test("stayLabelForExactName does not first-name match", () => {
  const slots = [
    { sectionId: "house", label: "Room A", occupant: "David" },
    { sectionId: "house", label: "Room B", occupant: "David Berman" },
  ];
  assert.equal(stayLabelForExactName("David Berman", slots)?.includes("Room B"), true);
  assert.equal(stayLabelForExactName("David", slots)?.includes("Room A"), true);
  assert.equal(stayLabelForExactName("David Berman", slots)?.includes("Room A"), false);
});
