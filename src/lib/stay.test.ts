import assert from "node:assert/strict";
import { test } from "node:test";
import { STAY_SECTIONS, isStaySectionId, isStaySlotId, planStayWrites } from "./stay";
import { canSeeStayTab } from "./access";
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
    linkedPersonId: null,
    assigneeFilter: null,
    ...partial,
  };
}

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

test("Stay is off for new helper accounts and on when See is shared", () => {
  assert.equal(canSeeStayTab(session({})), false);
  assert.equal(canSeeStayTab(session({ canSeeStay: true })), true);
  assert.equal(canSeeStayTab(session({ isMaster: true })), true);
  assert.equal(canSeeStayTab(session({ canManageAccounts: true })), false);
});

test("stay layout planner creates missing beds and only fills empty couple defaults", () => {
  const planned = planStayWrites([]);
  assert.equal(planned.creates.length, 12);
  assert.equal(planned.updates.length, 0);
  assert.equal(planned.creates.find((row) => row.id === "couple.1")?.occupant, "Haley");
  assert.equal(planned.creates.find((row) => row.id === "couple.2")?.occupant, "David");

  const synced = planStayWrites(
    planned.creates.map((row) =>
      row.id === "couple.1" ? { ...row, occupant: "Aunt May" } : row,
    ),
  );
  assert.equal(synced.creates.length, 0);
  assert.equal(synced.updates.length, 0);
});
