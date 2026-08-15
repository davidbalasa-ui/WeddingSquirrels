import assert from "node:assert/strict";
import { test } from "node:test";
import { mealsEditable } from "./access";
import { MEAL_SECTIONS, isMealGuestId, mealGuestCount } from "./meals";
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
    canEditBudget: false,
    canEditTimeline: false,
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

test("only masters and account managers can edit the dinner menu", () => {
  assert.equal(mealsEditable(session({ isMaster: true })), true);
  assert.equal(mealsEditable(session({ canManageAccounts: true })), true);
  assert.equal(mealsEditable(session({})), false);
});
