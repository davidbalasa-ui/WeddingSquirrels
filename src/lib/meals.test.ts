import assert from "node:assert/strict";
import { test } from "node:test";
import { canSeeDinnerTab, mealsEditable, normalizeAccountFlags, rehearsalScheduleEditable } from "./access";
import {
  MEAL_SECTIONS,
  countFinishedGuests,
  guestFinishedPicking,
  isMealGuestId,
  mealGuestCount,
  planMealWrites,
  shouldDeleteMealOptionOnClear,
} from "./meals";
import type { SessionAccount } from "./types";

function session(partial: Partial<SessionAccount>): SessionAccount {
  return {
    id: "acct",
    name: "Guest",
    isMaster: false,
    canSeeTasks: true,
    canSeeBudget: false,
    canSeeGuests: false,
    canSeeTimeline: false,
    canManageAccounts: false,
    canSeeShop: true,
    canSeeCalendar: true,
    canSeePeople: true,
    canSeeRequests: true,
    canSeeStay: false,
    canSeeDinner: false,
    canEditBudget: false,
    canEditTimeline: false,
    canEditDinner: false,
    canEditRehearsal: false,
    linkedPersonId: null,
    assigneeFilter: null,
    ...partial,
  };
}

test("rehearsal dinner has the listed people in six groups", () => {
  assert.equal(MEAL_SECTIONS.length, 6);
  assert.equal(mealGuestCount(), 17);
  const ids = MEAL_SECTIONS.flatMap((section) => section.guests.map((guest) => guest.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(
    MEAL_SECTIONS.map((section) => [section.id, section.guests.map((guest) => guest.name)]),
    [
      ["couple", ["David", "Haley"]],
      ["party", ["Trinity", "Bri", "Evan", "Andi", "Braxton", "Victoria", "Skila", "Kaylie"]],
      ["groom", ["Bryan", "Pam"]],
      ["bride", ["Shelly", "John"]],
      ["officiant", ["Marie"]],
      ["ceremony", ["Wendy", "Kurt"]],
    ],
  );
  assert.equal(isMealGuestId("meal.david"), true);
  assert.equal(isMealGuestId("david"), false);
});

test("only masters, account managers, and dinner editors can edit the dinner menu", () => {
  assert.equal(mealsEditable(session({ isMaster: true })), true);
  assert.equal(mealsEditable(session({ canManageAccounts: true })), true);
  assert.equal(mealsEditable(session({ canEditDinner: true })), true);
  assert.equal(mealsEditable(session({})), false);
});

test("dinner tab is shared on accounts or always visible to menu editors", () => {
  assert.equal(canSeeDinnerTab(session({ isMaster: true })), true);
  assert.equal(canSeeDinnerTab(session({ canManageAccounts: true })), true);
  assert.equal(canSeeDinnerTab(session({ canSeeDinner: true })), true);
  assert.equal(canSeeDinnerTab(session({ canEditDinner: true })), true);
  assert.equal(canSeeDinnerTab(session({})), false);
});

test("account managers keep Dinner See when flags are normalized", () => {
  const flags = normalizeAccountFlags({
    canSeeBudget: false,
    canEditBudget: false,
    canSeeTimeline: false,
    canEditTimeline: false,
    canSeeDinner: false,
    canEditDinner: false,
    canEditRehearsal: false,
    canManageAccounts: true,
  });
  assert.equal(flags.canSeeDinner, true);
  assert.equal(flags.canEditDinner, true);
  assert.equal(
    normalizeAccountFlags({
      canSeeBudget: false,
      canEditBudget: false,
      canSeeTimeline: false,
      canEditTimeline: false,
      canSeeDinner: false,
      canEditDinner: false,
      canEditRehearsal: false,
      canManageAccounts: false,
    }).canSeeDinner,
    false,
  );
});

test("meal layout planner creates missing guests and no-ops when synced", () => {
  const planned = planMealWrites([]);
  assert.equal(planned.creates.length, 17);
  assert.equal(planned.updates.length, 0);
  const synced = planMealWrites(planned.creates);
  assert.equal(synced.creates.length, 0);
  assert.equal(synced.updates.length, 0);
});

test("schedule editors do not get dinner-menu edit, and dinner editors do not get schedule edit", () => {
  assert.equal(rehearsalScheduleEditable(session({ canEditRehearsal: true })), true);
  assert.equal(rehearsalScheduleEditable(session({ canEditDinner: true })), false);
  assert.equal(mealsEditable(session({ canEditRehearsal: true })), false);
  assert.equal(canSeeDinnerTab(session({ canEditRehearsal: true })), true);
});

test("guests finish picking when every labeled course has a choice", () => {
  const courses = [
    {
      id: "entree",
      label: "Entree",
      options: [
        { id: "steak", label: "Steak" },
        { id: "fish", label: "Fish" },
      ],
    },
    { id: "drink", label: "Drink", options: [{ id: "water", label: "Water" }] },
    { id: "empty", label: "Empty", options: [{ id: "blank", label: "" }] },
  ];
  assert.equal(guestFinishedPicking(courses, { entree: "steak" }), false);
  assert.equal(guestFinishedPicking(courses, { entree: "steak", drink: "water" }), true);
  assert.equal(
    countFinishedGuests(courses, [
      { choices: { entree: "steak", drink: "water" } },
      { choices: { entree: "fish" } },
    ]),
    1,
  );
});

test("clearing a named dinner dish does not delete it", () => {
  assert.equal(shouldDeleteMealOptionOnClear("", ""), true);
  assert.equal(shouldDeleteMealOptionOnClear("Steak", ""), false);
  assert.equal(shouldDeleteMealOptionOnClear("Steak", "Salmon"), false);
});
