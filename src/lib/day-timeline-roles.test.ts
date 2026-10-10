import assert from "node:assert/strict";
import { test } from "node:test";
import { roleNamesFrom } from "./day-timeline-roles";

test("lineup rows give people's names to their role, never a role word", () => {
  const names = roleNamesFrom({
    lineup: [
      { title: "Mother of the Groom & Father of the Groom" },
      { title: "Officiant & Mother of the Bride" },
      { title: "David" },
      { title: "Skila & Trinity" },
      { title: "Melody — flower girl" },
      { title: "Haley with Dad" },
    ],
    people: [
      { name: "Kurt Huizenga", directoryLabel: "MC" },
      { name: "Barry Tilson", directoryLabel: "Photographer" },
      { name: "Avalon Green", directoryLabel: "Planner" },
    ],
  });
  assert.deepEqual(names.party, ["Skila", "Trinity", "Melody"]);
  // "Officiant" is a role in the processional, so "3:00 PM — officiant arrives" is not a family line.
  assert.deepEqual(names.family, []);
  assert.deepEqual(names.mc, ["Kurt Huizenga"]);
  assert.deepEqual(names.photo, ["Barry Tilson"]);
  assert.deepEqual(names.vendors, ["Avalon Green"]);
});
