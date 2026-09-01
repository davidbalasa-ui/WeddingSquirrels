import assert from "node:assert/strict";
import { test } from "node:test";
import {
  budgetContractsForContact,
  budgetContractsForPerson,
  budgetMatchesName,
  buildProfileRelatedLinks,
  findProfileIdForBudgetName,
  moneyContractHref,
  vendorPrimaryName,
} from "./connections";

test("vendorPrimaryName strips role suffix", () => {
  assert.equal(vendorPrimaryName("Avalon Green · Planner"), "Avalon Green");
});

test("budgetMatchesName links vendor CRM names to budget lines", () => {
  assert.equal(budgetMatchesName("Avalon Green", "Avalon Green · Planner"), true);
  assert.equal(budgetMatchesName("Photographer", "Barry Tilson · Photographer"), false);
});

test("findProfileIdForBudgetName prefers contacts then people", () => {
  assert.equal(
    findProfileIdForBudgetName(
      "Avalon Green",
      [{ id: "c1", name: "Avalon Green · Planner" }],
      [{ id: "david", name: "David" }],
    ),
    "contact:c1",
  );
  assert.equal(
    findProfileIdForBudgetName("Shelly", [], [{ id: "shelly", name: "Shelly" }]),
    "person:shelly",
  );
});

test("budgetContractsForPerson includes owner, payer, and name matches", () => {
  const rows = budgetContractsForPerson(
    { id: "david", name: "David" },
    [
      { id: "b1", name: "Photographer", price: 1000, amountPaid: 200, ownerId: "david", paidById: null },
      { id: "b2", name: "Catering", price: 500, amountPaid: 0, ownerId: "haley", paidById: "david" },
    ],
  );
  assert.deepEqual(
    rows.map((row) => row.id),
    ["b1", "b2"],
  );
});

test("budgetContractsForContact matches vendor CRM names", () => {
  const rows = budgetContractsForContact(
    { id: "c1", name: "Barry Tilson · Photographer" },
    [{ id: "b1", name: "Barry Tilson", price: 800, amountPaid: 0, ownerId: null, paidById: null }],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.href, moneyContractHref("b1"));
});

test("buildProfileRelatedLinks surfaces guest, stay, meal, and money destinations", () => {
  const links = buildProfileRelatedLinks({
    guestInfo: true,
    stayLabel: "Bedroom 2 · Person 1",
    mealStatus: "Bridal Party",
    assignments: 2,
    budgetContracts: [{ id: "b1", name: "Photographer", remaining: 500, href: moneyContractHref("b1") }],
  });
  assert.equal(links.length, 5);
  assert.equal(links[0]?.href, "/guests");
  assert.equal(links.at(-1)?.label, "Money");
});
