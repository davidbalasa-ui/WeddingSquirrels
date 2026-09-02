import assert from "node:assert/strict";
import { test } from "node:test";
import {
  analyzeHouseholdMerges,
  buildMergedHouseholdFields,
  detectHouseholdConflicts,
  householdsShouldCluster,
  pickMergeWinner,
  type MergeGuestHousehold,
} from "@/lib/guest-household-merge";
import { planPhotoCopies } from "@/lib/guest-photo-sync";

function household(
  id: string,
  names: string[],
  extras: Partial<MergeGuestHousehold> = {},
): MergeGuestHousehold {
  return {
    id,
    phone: null,
    street: null,
    city: null,
    state: null,
    zip: null,
    rsvpStatus: "pending",
    invitedCount: names.length,
    acceptedCount: 0,
    sortOrder: 0,
    people: names.map((name, index) => ({
      id: `${id}-p${index}`,
      name,
      directoryLabel: null,
      isDayOfContact: false,
      rsvpStatus: "pending",
      photoData: null,
      tableNumber: null,
      tableSpot: null,
      sortOrder: index,
    })),
    gifts: [],
    ...extras,
  };
}

test("Balasa family clusters with Benjamin+Hannah household", () => {
  const family = household("family", [
    "Benjamin Balasa",
    "Hannah Balasa",
    "Meira Balasa",
    "Isaac Balasa",
  ]);
  const couple = household(
    "couple",
    ["Benjamin Balasa", "Hannah Balasa"],
    { street: "123 Main", city: "Chicago", state: "IL", zip: "60601" },
  );
  assert.equal(householdsShouldCluster(family, couple), true);
  const { winner, loser } = pickMergeWinner(family, couple);
  assert.equal(winner.id, "couple");
  assert.equal(loser.id, "family");
  assert.deepEqual(detectHouseholdConflicts(winner, loser), []);
});

test("address conflict skips auto-merge", () => {
  const a = household("a", ["Andi Cartwright"], {
    street: "1 Oak",
    city: "Town",
    state: "IL",
    zip: "60000",
  });
  const b = household("b", ["Andi Cartwright"], {
    street: "2 Pine",
    city: "Town",
    state: "IL",
    zip: "60000",
  });
  const analysis = analyzeHouseholdMerges([a, b]);
  assert.equal(analysis.merges.length, 0);
  assert.equal(analysis.conflicts.length, 1);
});

test("buildMergedHouseholdFields unions people gifts and address", () => {
  const winner = household(
    "couple",
    ["Benjamin Balasa", "Hannah Balasa"],
    {
      street: "123 Main",
      city: "Chicago",
      state: "IL",
      zip: "60601",
      gifts: [
        {
          id: "g1",
          description: "Toaster",
          thanked: true,
          thankYouWritten: true,
          thankYouSent: false,
          sortOrder: 0,
        },
      ],
    },
  );
  const loser = household("family", [
    "Benjamin Balasa",
    "Hannah Balasa",
    "Isaac Balasa",
  ]);
  const built = buildMergedHouseholdFields(winner, loser);
  assert.equal(built.people.length, 3);
  assert.ok(built.people.some((person) => person.name === "Isaac Balasa"));
  assert.equal(built.household.street, "123 Main");
  assert.equal(built.gifts.length, 1);
});

test("planPhotoCopies only fills empty slots", () => {
  const plan = planPhotoCopies(
    [
      { id: "gp1", name: "Andi Cartwright", photoData: null },
      { id: "gp2", name: "Other Person", photoData: "data:image/jpeg;base64,AAA" },
    ],
    [
      { id: "c1", name: "Andi Cartwright", photoData: "data:image/jpeg;base64,BBB" },
      { id: "c2", name: "Other Person", photoData: null },
    ],
  );
  assert.deepEqual(plan.guestUpdates, [{ id: "gp1", photoData: "data:image/jpeg;base64,BBB" }]);
  assert.deepEqual(plan.contactUpdates, [{ id: "c2", photoData: "data:image/jpeg;base64,AAA" }]);
});
