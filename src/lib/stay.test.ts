import assert from "node:assert/strict";
import { test } from "node:test";
import { STAY_SECTIONS, isStaySectionId, isStaySlotId } from "./stay";

test("stay layout has three sections and unique slot ids", () => {
  assert.equal(STAY_SECTIONS.length, 3);
  const ids = STAY_SECTIONS.flatMap((section) => section.slots.map((slot) => slot.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(isStaySectionId("bride"), true);
  assert.equal(isStaySectionId("bath"), false);
  assert.equal(isStaySlotId("couple.1"), true);
  assert.equal(isStaySlotId("missing"), false);
});

test("couple room defaults to Haley and David", () => {
  const couple = STAY_SECTIONS.find((section) => section.id === "couple");
  assert.equal(couple?.slots[0]?.defaultOccupant, "Haley");
  assert.equal(couple?.slots[1]?.defaultOccupant, "David");
});

test("bride side has four beds and groom side marks optional bunks and air mattress", () => {
  const bride = STAY_SECTIONS.find((section) => section.id === "bride");
  const groom = STAY_SECTIONS.find((section) => section.id === "groom");
  assert.equal(bride?.slots.length, 4);
  assert.equal(groom?.slots.length, 6);
  assert.deepEqual(
    groom?.slots.filter((slot) => slot.optional).map((slot) => slot.id),
    ["groom.bottom.2", "groom.top.2", "groom.air.1", "groom.air.2"],
  );
  assert.equal(groom?.slots.find((slot) => slot.id === "groom.air.1")?.group, "Queen air mattress");
});
