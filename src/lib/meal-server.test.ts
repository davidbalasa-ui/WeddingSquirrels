import assert from "node:assert/strict";
import { test } from "node:test";
import { newMealGuestId } from "./meal-server";

test("guest person outside legacy roster gets a stable meal guest id", () => {
  const guestPersonId = "gp_plus_one_123";
  assert.equal(newMealGuestId(guestPersonId), "meal.gp.gp_plus_one_123");
  assert.notEqual(newMealGuestId(guestPersonId), "meal.david");
});
