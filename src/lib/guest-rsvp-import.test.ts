import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  displayNameForCsvPerson,
  findBestGuestMatch,
  groupCsvRowsByHousehold,
  householdRsvpFromPeople,
  mapCsvRsvp,
  resolveImportedRsvp,
  parseGuestRsvpCsv,
  scoreGuestHouseholdMatch,
} from "./guest-rsvp-import";

test("mapCsvRsvp maps Squirrels export values", () => {
  assert.equal(mapCsvRsvp("Attending"), "attending");
  assert.equal(mapCsvRsvp("Regret"), "not_attending");
  assert.equal(mapCsvRsvp("No Response"), "pending");
});

test("displayNameForCsvPerson names generic plus ones from party label", () => {
  assert.equal(
    displayNameForCsvPerson("Plus", "One", "Cynthia Berman & Plus One"),
    "Cynthia Berman +1",
  );
  assert.equal(
    displayNameForCsvPerson(
      "Plus",
      "One",
      "Marie Wiewiora, Juniper Wiewiora, Rowan Wiewiora & Plus One",
      "Marie Wiewiora",
    ),
    "Marie Wiewiora +1",
  );
});

test("CSV no response does not overwrite an existing reply", () => {
  const incoming = { rsvpStatus: "pending" as const, invitedCount: 2, acceptedCount: 0 };
  assert.deepEqual(resolveImportedRsvp(incoming, { rsvpStatus: "not_attending", acceptedCount: 0 }), {
    rsvpStatus: "not_attending",
    invitedCount: 2,
    acceptedCount: 0,
  });
  assert.deepEqual(resolveImportedRsvp(incoming, { rsvpStatus: "attending", acceptedCount: 2 }), {
    rsvpStatus: "attending",
    invitedCount: 2,
    acceptedCount: 2,
  });
  assert.deepEqual(resolveImportedRsvp(incoming, { rsvpStatus: "pending", acceptedCount: 0 }), incoming);
  assert.deepEqual(
    resolveImportedRsvp(
      { rsvpStatus: "not_attending", invitedCount: 2, acceptedCount: 0 },
      { rsvpStatus: "attending", acceptedCount: 2 },
    ),
    { rsvpStatus: "not_attending", invitedCount: 2, acceptedCount: 0 },
  );
});

test("householdRsvpFromPeople handles partial attendance", () => {
  const mixed = householdRsvpFromPeople([
    { rsvp: "attending" },
    { rsvp: "not_attending" },
  ]);
  assert.equal(mixed.rsvpStatus, "attending");
  assert.equal(mixed.invitedCount, 2);
  assert.equal(mixed.acceptedCount, 1);

  const allRegret = householdRsvpFromPeople([{ rsvp: "not_attending" }, { rsvp: "not_attending" }]);
  assert.equal(allRegret.rsvpStatus, "not_attending");
  assert.equal(allRegret.acceptedCount, 0);
});

test("scoreGuestHouseholdMatch links spreadsheet households to csv parties", () => {
  const household = groupCsvRowsByHousehold([
    {
      firstName: "Pamela",
      lastName: "Balasa",
      party: "Pamela & Bryan Balasa",
      notes: "",
      rsvp: "Attending",
      thankYouSent: "",
      giftReceived: "",
    },
    {
      firstName: "Bryan",
      lastName: "Balasa",
      party: "Pamela & Bryan Balasa",
      notes: "",
      rsvp: "Attending",
      thankYouSent: "",
      giftReceived: "",
    },
  ])[0];

  const guest = {
    nameLine1: "Pamela Balasa",
    nameLine2: "Bryan Balasa",
    people: [{ name: "Pamela Balasa" }, { name: "Bryan Balasa" }],
  };
  assert.ok(scoreGuestHouseholdMatch(household, guest) >= 0.8);
});

test("findBestGuestMatch prefers the household with more overlapping names", () => {
  const household = groupCsvRowsByHousehold([
    {
      firstName: "Elizabeth",
      lastName: "Hammond",
      party: "Hammond Family",
      notes: "",
      rsvp: "No Response",
      thankYouSent: "",
      giftReceived: "",
    },
    {
      firstName: "Jeremy",
      lastName: "Hammond",
      party: "Hammond Family",
      notes: "",
      rsvp: "No Response",
      thankYouSent: "",
      giftReceived: "",
    },
  ])[0];

  const hammondGuest = {
    nameLine1: "Elizabeth Hammond",
    nameLine2: "Family",
    people: [{ name: "Elizabeth Hammond" }, { name: "Jeremy Hammond" }],
  };
  const otherGuest = {
    nameLine1: "Pamela Balasa",
    nameLine2: "Bryan Balasa",
    people: [{ name: "Pamela Balasa" }],
  };

  assert.equal(findBestGuestMatch(household, [otherGuest, hammondGuest]), hammondGuest);
});

test("parseGuestRsvpCsv reads quoted party names", () => {
  const csv = readFileSync(
    "/home/ubuntu/.cursor/projects/workspace/uploads/rsvp_03ab.csv",
    "utf8",
  );
  const rows = parseGuestRsvpCsv(csv);
  assert.equal(rows.length, 76);
  const marieParty = rows.find((row) => row.firstName === "Marie" && row.lastName === "Wiewiora");
  assert.ok(marieParty?.party.includes("Juniper Wiewiora"));
});
