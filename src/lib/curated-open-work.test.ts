import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CURATED_PACKAGES,
  DAY_BEFORE_STEPS,
  WEEK_BEFORE_STEPS,
  actionableOpenCount,
  forbiddenTaskReason,
  hasOccupant,
  isOrgStepTitle,
  normalizeTitle,
  planCuratedOpenWork,
  planOpenCount,
  plannedInsertCounts,
  productionWeddingIdentityError,
  remainingRequiredBeds,
  titlesMatch,
  todayPulseOpenCount,
  uniqueBudgetItemId,
  type TaskSnapshot,
  type WeddingSnapshot,
} from "./curated-open-work";

function task(partial: Partial<TaskSnapshot> & Pick<TaskSnapshot, "id" | "title">): TaskSnapshot {
  return {
    summary: null,
    planNotes: null,
    status: "todo",
    dueDate: null,
    sourceRow: null,
    parentId: null,
    orgKey: null,
    budgetItemId: null,
    sortOrder: 0,
    ...partial,
  };
}

function orgTree(): TaskSnapshot[] {
  const week = task({ id: "week", title: "Week before", orgKey: "week_before", sortOrder: -20 });
  const day = task({ id: "day", title: "Day before", orgKey: "day_before", sortOrder: -10 });
  const weekKids = WEEK_BEFORE_STEPS.map((title, index) =>
    task({ id: `w${index}`, title, parentId: "week", sortOrder: index }),
  );
  const dayKids = DAY_BEFORE_STEPS.map((title, index) =>
    task({ id: `d${index}`, title, parentId: "day", sortOrder: index }),
  );
  return [week, day, ...weekKids, ...dayKids];
}

function snapshot(overrides: Partial<WeddingSnapshot> = {}): WeddingSnapshot {
  return {
    coupleNames: "David & Haley",
    weddingDate: "2026-10-16T12:00:00.000Z",
    timezone: "America/Detroit",
    tasks: orgTree(),
    people: [
      { id: "david", name: "David", isDayOfContact: false },
      { id: "haley", name: "Haley", isDayOfContact: false },
      { id: "shelly", name: "Shelly", isDayOfContact: true },
      { id: "wendy_rush", name: "Wendy Rush", isDayOfContact: false },
      { id: "kurt", name: "Kurt", isDayOfContact: false },
    ],
    contacts: [
      {
        id: "c-shelly",
        name: "Shelly Wiewiora",
        personId: "shelly",
        isDayOfContact: true,
        phone: "555",
        email: null,
      },
      {
        id: "c-wendy",
        name: "Wendy Rush",
        personId: "wendy_rush",
        isDayOfContact: true,
        phone: "556",
        email: null,
      },
    ],
    stay: [
      { id: "bride.bottom", label: "Bottom bunk", occupant: "Trinity", optional: false },
      { id: "bride.middle", label: "Middle bunk", occupant: "Bri", optional: false },
      { id: "bride.top", label: "Top bunk", occupant: "Skila", optional: false },
      { id: "bride.single", label: "Single bed", occupant: "", optional: false },
      { id: "groom.air.1", label: "Person 1", occupant: "", optional: true },
    ],
    budgetItems: [
      { id: "b-booze", name: "Booze" },
      { id: "b-venue", name: "Black Sheep Shelter" },
      { id: "b-dishes", name: "150 compostable dishware sets" },
    ],
    ...overrides,
  };
}

test("production wedding identity accepts David & Haley on 2026-10-16 Detroit", () => {
  assert.equal(productionWeddingIdentityError(snapshot()), null);
});

test("production wedding identity rejects the wrong couple or date", () => {
  assert.match(
    productionWeddingIdentityError(snapshot({ coupleNames: "Someone Else" })) ?? "",
    /Couple names/,
  );
  assert.match(
    productionWeddingIdentityError(snapshot({ weddingDate: "2025-01-01T12:00:00.000Z" })) ?? "",
    /Wedding date/,
  );
});

test("org-card rehearsal step is not the rehearsal-dinner menu", () => {
  assert.equal(isOrgStepTitle("Rehearsal time + dinner locked"), true);
  assert.equal(isOrgStepTitle("Rehearsal Dinner Menu"), false);
  assert.equal(titlesMatch("Rehearsal Dinner Menu", "Rehearsal time + dinner locked"), false);
});

test("forbidden titles catch venue payment, florist, bartender booking, and David's 10k", () => {
  assert.equal(forbiddenTaskReason("Pay Black Sheep venue"), "Pay Black Sheep venue");
  assert.equal(forbiddenTaskReason("Find florist"), "Find florist");
  assert.equal(forbiddenTaskReason("Book bartender"), "Find/book bartender");
  assert.equal(forbiddenTaskReason("Receive David's $10,000"), "David's already-funded $10,000");
  assert.equal(forbiddenTaskReason("Finalize table and chair quantities for Black Sheep"), null);
});

test("remaining required beds ignore optional overflow and do not hard-code six", () => {
  const stats = remainingRequiredBeds(snapshot().stay);
  assert.equal(stats.totalRequired, 4);
  assert.equal(stats.assignedRequired, 3);
  assert.equal(stats.remainingRequired, 1);
  assert.equal(stats.optionalEmpty, 1);
});

test("Trinity, Bri, and Skila occupant detection is name-based", () => {
  const stay = snapshot().stay;
  assert.equal(hasOccupant(stay, /trinity/i), true);
  assert.equal(hasOccupant(stay, /\bbri\b/i), true);
  assert.equal(hasOccupant(stay, /skila/i), true);
});

test("budget links attach only when a single unambiguous BudgetItem exists", () => {
  assert.equal(uniqueBudgetItemId(snapshot().budgetItems, "booze").id, "b-booze");
  assert.equal(uniqueBudgetItemId(snapshot().budgetItems, "dishware").id, "b-dishes");
  assert.equal(uniqueBudgetItemId([{ id: "x", name: "Cutlery" }], "dishware").id, null);
  assert.equal(
    uniqueBudgetItemId(
      [
        { id: "a", name: "Booze" },
        { id: "b", name: "More Booze" },
      ],
      "booze",
    ).id,
    null,
  );
});

test("fresh production-like tree inserts eight packages and does not duplicate Kurt's phone", () => {
  const plan = planCuratedOpenWork(snapshot());
  const counts = plannedInsertCounts(plan);
  assert.equal(plan.packages.length, 8);
  assert.equal(counts.packages, 8);
  assert.equal(
    plan.packages.every((pkg) => pkg.steps.every((step) => step.action === "insert")),
    true,
  );
  const titles = plan.packages.flatMap((pkg) => pkg.steps.map((step) => step.title));
  assert.equal(titles.filter((title) => /kurt/i.test(title) && /phone|contact information/i.test(title)).length, 1);
  assert.equal(
    plan.skipped.some((row) => /venue packet/i.test(row.item)),
    true,
  );
  const booze = plan.packages
    .flatMap((pkg) => pkg.steps)
    .find((step) => step.key === "drinks-booze");
  assert.equal(booze?.budgetItemId, "b-booze");
  const stay = plan.packages
    .flatMap((pkg) => pkg.steps)
    .find((step) => step.key === "stay-required");
  assert.match(stay?.planNotes ?? "", /1 required bed still needs a name/);
});

test("existing org-card steps are never scheduled as new curated tasks", () => {
  const plan = planCuratedOpenWork(snapshot());
  const scheduled = new Set(plan.packages.flatMap((pkg) => pkg.steps.map((step) => normalizeTitle(step.title))));
  for (const title of [...WEEK_BEFORE_STEPS, ...DAY_BEFORE_STEPS]) {
    assert.equal(scheduled.has(normalizeTitle(title)), false);
  }
});

test("reuses an existing package and its child instead of inserting copies", () => {
  const existing = [
    ...orgTree(),
    task({
      id: "pkg-funding",
      title: "Wedding Funding",
      summary: "Follow up on John & Shelly's promised contribution. Money stays the financial source of truth.",
    }),
    task({
      id: "step-funding",
      title: "Receive/confirm John & Shelly's $5,000 wedding contribution",
      parentId: "pkg-funding",
    }),
  ];
  const plan = planCuratedOpenWork(snapshot({ tasks: existing }));
  const funding = plan.packages.find((pkg) => pkg.key === "wedding-funding");
  assert.equal(funding?.action, "reuse");
  assert.equal(funding?.existingId, "pkg-funding");
  assert.equal(funding?.steps[0]?.action, "reuse");
  assert.equal(funding?.steps[0]?.existingId, "step-funding");
});

test("does not merge a similarly named task from another tree", () => {
  const existing = [
    ...orgTree(),
    task({
      id: "other",
      title: "Get Kurt's missing phone/contact information",
      parentId: "week",
    }),
  ];
  const plan = planCuratedOpenWork(snapshot({ tasks: existing }));
  const kurt = plan.packages
    .find((pkg) => pkg.key === "mc-contacts")
    ?.steps.find((step) => step.key === "kurt-phone");
  assert.equal(kurt, undefined);
  assert.equal(
    plan.skipped.some((row) => row.item === "Get Kurt's missing phone/contact information"),
    true,
  );
});

test("day-of flags update existing people/contacts and never invent Kurt's channel", () => {
  const plan = planCuratedOpenWork(snapshot());
  assert.deepEqual(
    plan.personFlags.map((row) => row.id).sort(),
    ["kurt", "wendy_rush"],
  );
  assert.equal(plan.contactFlags.length, 0);
  assert.equal(plan.kurt.personId, "kurt");
  assert.equal(plan.kurt.hasChannel, false);
  assert.equal(
    plan.skipped.some((row) => /No unique existing Contact for kurt/i.test(row.reason)),
    true,
  );
});

test("plan and today pulse counts do not double-count children", () => {
  const tasks = orgTree();
  assert.equal(tasks.length, 15);
  assert.equal(planOpenCount(tasks), 2);
  assert.equal(todayPulseOpenCount(tasks), 0);
  assert.equal(actionableOpenCount(tasks), 13);

  const withPackages = [
    ...tasks,
    task({ id: "p", title: "Wedding Funding" }),
    task({ id: "s", title: "Receive/confirm John & Shelly's $5,000 wedding contribution", parentId: "p" }),
  ];
  assert.equal(planOpenCount(withPackages), 3);
  assert.equal(todayPulseOpenCount(withPackages), 1);
  assert.equal(actionableOpenCount(withPackages), 14);
});

test("curated catalog does not include forbidden outcomes", () => {
  const titles = CURATED_PACKAGES.flatMap((pkg) => [pkg.title, ...pkg.steps.map((step) => step.title)]);
  for (const title of titles) {
    assert.equal(forbiddenTaskReason(title), null, title);
  }
});
