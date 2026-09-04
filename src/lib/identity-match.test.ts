import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildIdentityMatchReport,
  findDuplicatePersonCandidates,
  proposeIdentityMatch,
} from "./identity-match";

const persons = [
  { id: "wendy_rush", name: "Wendy Rush" },
  { id: "david", name: "David" },
  { id: "katie", name: "Katie" },
  { id: "katie_w", name: "Katie Wiewiora" },
  { id: "avalon", name: "Avalon Green" },
];

test("exact normalized full names are SAFE", () => {
  const match = proposeIdentityMatch({ id: "gp1", name: "Wendy Rush" }, persons);
  assert.equal(match.verdict, "SAFE");
  assert.equal(match.proposedPersonId, "wendy_rush");
});

test("first-name-only exact matches are REVIEW", () => {
  const match = proposeIdentityMatch({ id: "meal.david", name: "David" }, persons);
  assert.equal(match.verdict, "REVIEW");
  assert.equal(match.proposedPersonId, "david");
  assert.equal(match.reason, "first-name-only exact match");
});

test("first-name or fuzzy-only matches are REVIEW", () => {
  const match = proposeIdentityMatch({ id: "gp2", name: "David Balasa" }, persons);
  assert.equal(match.verdict, "REVIEW");
  assert.equal(match.proposedPersonId, "david");
  assert.equal(match.reason, "first-name or fuzzy match only");
});

test("conflicting first-name matches are REVIEW without a proposed id", () => {
  const match = proposeIdentityMatch({ id: "gp3", name: "Katie" }, persons);
  assert.equal(match.verdict, "REVIEW");
  assert.equal(match.proposedPersonId, null);
  assert.ok(match.candidatePersonIds.includes("katie"));
  assert.ok(match.candidatePersonIds.includes("katie_w"));
});

test("duplicate exact Person names are REVIEW", () => {
  const match = proposeIdentityMatch({ id: "gp4", name: "Pat Lee" }, [
    { id: "p1", name: "Pat Lee" },
    { id: "p2", name: "Pat Lee" },
  ]);
  assert.equal(match.verdict, "REVIEW");
  assert.equal(match.proposedPersonId, null);
  assert.deepEqual(match.candidatePersonIds, ["p1", "p2"]);
});

test("no name overlap stays UNMATCHED", () => {
  const match = proposeIdentityMatch(
    { id: "c1", name: "Black Sheep Shelter · Venue" },
    persons,
  );
  assert.equal(match.verdict, "UNMATCHED");
  assert.equal(match.proposedPersonId, null);
});

test("vendor suffix does not count as an exact full-name match", () => {
  const match = proposeIdentityMatch(
    { id: "c2", name: "Avalon Green · Planner" },
    persons,
  );
  assert.equal(match.verdict, "REVIEW");
  assert.equal(match.proposedPersonId, "avalon");
});

test("duplicate Person candidates include exact and first-token groups", () => {
  const groups = findDuplicatePersonCandidates(persons);
  assert.ok(groups.some((group) => group.kind === "first_token" && group.key === "katie"));
  assert.equal(
    groups.some((group) => group.kind === "exact"),
    false,
  );
});

test("report counts every source row and does not invent writes", () => {
  const report = buildIdentityMatchReport({
    persons,
    guestPeople: [
      { id: "gp1", name: "Wendy Rush" },
      { id: "gp2", name: "David Balasa" },
    ],
    contacts: [{ id: "c1", name: "Black Sheep Shelter · Venue" }],
    mealGuests: [{ id: "meal.david", name: "David" }],
  });
  assert.equal(report.counts.safe, 1);
  assert.equal(report.counts.review, 2);
  assert.equal(report.counts.unmatched, 1);
  assert.equal(report.matches.length, 4);
  assert.equal(report.counts.firstNameOnlyPersons, 2);
});
