import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dinnerCourseComplete,
  dinnerOrderComplete,
  normalizeDinnerName,
  parseFollowUpOptions,
  type DinnerCourseView,
} from "./rehearsal-dinner";

const entree: DinnerCourseView = {
  id: "entree",
  label: "Entrée",
  minSelections: 1,
  maxSelections: 1,
  options: [
    {
      id: "filet",
      label: "Filet",
      followUpLabel: "How should it be cooked?",
      followUpOptions: ["Rare", "Medium Rare", "Medium"],
      followUpRequired: true,
    },
    {
      id: "pasta",
      label: "Pasta",
      followUpLabel: null,
      followUpOptions: [],
      followUpRequired: false,
    },
  ],
};

const sides: DinnerCourseView = {
  id: "sides",
  label: "Sides",
  minSelections: 2,
  maxSelections: 3,
  options: [
    { id: "potato", label: "Potatoes", followUpLabel: null, followUpOptions: [], followUpRequired: false },
    { id: "beans", label: "Green beans", followUpLabel: null, followUpOptions: [], followUpRequired: false },
    { id: "salad", label: "Salad", followUpLabel: null, followUpOptions: [], followUpRequired: false },
  ],
};

test("normalizeDinnerName is stable across case and whitespace", () => {
  assert.equal(normalizeDinnerName("  David   Balasa "), "david balasa");
});

test("parseFollowUpOptions accepts only trimmed string arrays", () => {
  assert.deepEqual(parseFollowUpOptions('["Rare", " Medium ", 3]'), ["Rare", "Medium"]);
  assert.deepEqual(parseFollowUpOptions("not-json"), []);
});

test("required follow-up keeps an entree incomplete until answered", () => {
  assert.equal(
    dinnerCourseComplete(entree, [{ optionId: "filet", followUpValue: null }]),
    false,
  );
  assert.equal(
    dinnerCourseComplete(entree, [{ optionId: "filet", followUpValue: "Medium Rare" }]),
    true,
  );
  assert.equal(
    dinnerCourseComplete(entree, [{ optionId: "pasta", followUpValue: null }]),
    true,
  );
});

test("multi-select courses honor configured minimum and maximum", () => {
  assert.equal(dinnerCourseComplete(sides, [{ optionId: "potato", followUpValue: null }]), false);
  assert.equal(
    dinnerCourseComplete(sides, [
      { optionId: "potato", followUpValue: null },
      { optionId: "beans", followUpValue: null },
    ]),
    true,
  );
  assert.equal(
    dinnerCourseComplete(sides, [
      { optionId: "potato", followUpValue: null },
      { optionId: "beans", followUpValue: null },
      { optionId: "salad", followUpValue: null },
      { optionId: "missing", followUpValue: null },
    ]),
    false,
  );
});

test("whole order requires every active course to be complete", () => {
  assert.equal(
    dinnerOrderComplete([entree, sides], {
      entree: [{ optionId: "filet", followUpValue: "Medium" }],
      sides: [
        { optionId: "potato", followUpValue: null },
        { optionId: "beans", followUpValue: null },
      ],
    }),
    true,
  );
  assert.equal(
    dinnerOrderComplete([entree, sides], {
      entree: [{ optionId: "filet", followUpValue: null }],
      sides: [
        { optionId: "potato", followUpValue: null },
        { optionId: "beans", followUpValue: null },
      ],
    }),
    false,
  );
});
