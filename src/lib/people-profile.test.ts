import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canonicalRoleMemberships,
  classifyCanonicalPrimaryList,
  linkedIdentityForPerson,
  stayLabelForExactName,
} from "./people-profile";

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

test("Person-only identities are roleless until a real role exists", () => {
  const david = canonicalRoleMemberships({
    directoryList: null,
    hasGuestRole: false,
    hasContactRole: false,
    isDayOfContact: false,
  });
  assert.equal(david.primaryList, null);
  assert.equal(david.guest, false);
  assert.equal(david.vendor, false);
  assert.equal(david.dayOf, false);
  assert.equal(
    classifyCanonicalPrimaryList({
      directoryList: null,
      hasGuestRole: false,
      hasContactRole: false,
    }),
    null,
  );
});

test("Person + GuestPerson classifies as Guest, not Vendor", () => {
  const membership = canonicalRoleMemberships({
    hasGuestRole: true,
    hasContactRole: false,
  });
  assert.equal(membership.primaryList, "guests");
  assert.equal(membership.guest, true);
  assert.equal(membership.vendor, false);
});

test("Person + Contact classifies as Vendor from the Contact role", () => {
  const membership = canonicalRoleMemberships({
    hasGuestRole: false,
    hasContactRole: true,
    isDayOfContact: true,
  });
  assert.equal(membership.primaryList, "vendors");
  assert.equal(membership.guest, false);
  assert.equal(membership.vendor, true);
  assert.equal(membership.dayOf, true);
});

test("Person + GuestPerson + Contact keeps both role memberships", () => {
  const membership = canonicalRoleMemberships({
    hasGuestRole: true,
    hasContactRole: true,
    isDayOfContact: false,
  });
  assert.equal(membership.guest, true);
  assert.equal(membership.vendor, true);
  assert.equal(membership.dayOf, false);
  assert.equal(membership.primaryList, "guests");
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
