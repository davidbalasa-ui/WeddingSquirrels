import assert from "node:assert/strict";
import { test } from "node:test";
import { assigneeDisplayNames, defaultAssigneeIds, resolveAssigneeIds } from "./people";

test("defaultAssigneeIds prefers the People filter when that person is visible", () => {
  const people = [
    { id: "david" },
    { id: "haley" },
    { id: "shelly" },
  ];
  assert.deepEqual(defaultAssigneeIds(people, ["shelly"]), ["shelly"]);
  assert.deepEqual(defaultAssigneeIds(people), ["david", "haley"]);
});

test("defaultAssigneeIds uses the only visible person for filtered PINs", () => {
  assert.deepEqual(defaultAssigneeIds([{ id: "shelly" }]), ["shelly"]);
});

test("resolveAssigneeIds falls back to the filter when a helper leaves owners blank", async () => {
  const ids = await resolveAssigneeIds([], null, {
    restrictTo: ["shelly"],
    fallback: ["shelly"],
  });
  assert.deepEqual(ids, ["shelly"]);
});

test("resolveAssigneeIds keeps a checked Shelly owner for masters", async () => {
  const ids = await resolveAssigneeIds(["shelly"], null, {
    fallback: ["david", "haley"],
  });
  assert.deepEqual(ids, ["shelly"]);
});

test("assigneeDisplayNames skips missing person rows", () => {
  assert.equal(
    assigneeDisplayNames([{ person: { name: "Shelly" } }, { person: null }]),
    "Shelly",
  );
});
