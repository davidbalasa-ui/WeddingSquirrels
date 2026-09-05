import assert from "node:assert/strict";
import { test } from "node:test";
import {
  budgetContractsForContact,
  budgetContractsForPerson,
  budgetMatchesName,
  budgetRoleLabel,
  buildProfileRelatedLinks,
  formatBudgetContractDetail,
  findProfileIdForBudgetName,
  moneyContractHref,
  personBudgetRole,
  vendorPrimaryName,
} from "./connections";

test("vendorPrimaryName strips role suffix", () => {
  assert.equal(vendorPrimaryName("Avalon Green · Planner"), "Avalon Green");
});

test("budgetMatchesName is a display helper and does not become a link", () => {
  assert.equal(budgetMatchesName("Avalon Green", "Avalon Green · Planner"), true);
  assert.equal(budgetMatchesName("Photographer", "Barry Tilson · Photographer"), false);
});

test("findProfileIdForBudgetName remains available but is not used for Money navigation", () => {
  assert.equal(
    findProfileIdForBudgetName(
      "Avalon Green",
      [{ id: "c1", name: "Avalon Green · Planner" }],
      [{ id: "david", name: "David" }],
    ),
    "contact:c1",
  );
});

test("personBudgetRole uses only stored owner and payer ids", () => {
  assert.equal(personBudgetRole("david", { ownerId: "david", paidById: null }), "owner");
  assert.equal(personBudgetRole("david", { ownerId: "haley", paidById: "david" }), "paying");
  assert.equal(personBudgetRole("david", { ownerId: "david", paidById: "david" }), "owner_and_paying");
  assert.equal(personBudgetRole("david", { ownerId: "haley", paidById: null }), null);
  assert.equal(budgetRoleLabel("paying"), "Paying");
});

test("budgetContractsForPerson includes only owner and payer FKs", () => {
  const rows = budgetContractsForPerson(
    { id: "david", name: "David" },
    [
      { id: "b1", name: "Photographer", price: 1000, amountPaid: 200, ownerId: "david", paidById: null },
      { id: "b2", name: "Catering", price: 500, amountPaid: 0, ownerId: "haley", paidById: "david" },
      { id: "b3", name: "David", price: 100, amountPaid: 0, ownerId: null, paidById: null },
    ],
  );
  assert.deepEqual(
    rows.map((row) => ({ id: row.id, role: row.role })),
    [
      { id: "b1", role: "owner" },
      { id: "b2", role: "paying" },
    ],
  );
  assert.equal(rows[0]?.href, moneyContractHref("b1"));
});

test("budgetContractsForContact does not infer vendor contracts from names", () => {
  const rows = budgetContractsForContact(
    { id: "c1", name: "Barry Tilson · Photographer" },
    [{ id: "b1", name: "Barry Tilson", price: 800, amountPaid: 0, ownerId: null, paidById: null }],
  );
  assert.equal(rows.length, 0);
});

test("formatBudgetContractDetail labels owner and payer truthfully", () => {
  assert.equal(
    formatBudgetContractDetail({
      id: "b1",
      name: "Photography",
      remaining: 1000,
      href: "/money/b1",
      role: "paying",
    }),
    "Paying · $1,000 remaining",
  );
  assert.equal(
    formatBudgetContractDetail({
      id: "b2",
      name: "Dog care",
      remaining: 0,
      href: "/money/b2",
      role: "owner",
    }),
    "Owner · Paid in full",
  );
});

test("buildProfileRelatedLinks no longer treats money or assignments as inferred hops", () => {
  const links = buildProfileRelatedLinks({
    guestInfo: true,
    stayLabel: "Bedroom 2 · Person 1",
    mealStatus: "Bridal Party",
  });
  assert.equal(links.length, 3);
  assert.equal(links[0]?.href, "/people");
  assert.equal(
    links.some((link) => link.label === "Money" || link.label === "Responsibilities"),
    false,
  );
});
