import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canSubmitMealOrder,
  courseSelectionHint,
  formatMealOrderSummary,
  isMealOrderComplete,
  legacyChoiceMapFromSelections,
  mealOrderProgress,
  selectionsFromLegacyChoiceMap,
  summarizeMealOrders,
  validateMealSelections,
  validatePartialMealSelections,
  type MealCourseConfig,
} from "./meal-order";

function menu(): MealCourseConfig[] {
  return [
    {
      id: "entree",
      label: "Entree",
      minSelections: 1,
      maxSelections: 1,
      options: [
        {
          id: "filet",
          label: "Filet",
          followUpPrompt: "How would you like it cooked?",
          followUpChoices: [
            { id: "rare", label: "Rare" },
            { id: "med-rare", label: "Medium Rare" },
          ],
        },
        { id: "chicken", label: "Chicken", followUpPrompt: null, followUpChoices: [] },
      ],
    },
    {
      id: "sides",
      label: "Sides",
      minSelections: 0,
      maxSelections: 3,
      options: [
        { id: "potatoes", label: "Mashed potatoes", followUpPrompt: null, followUpChoices: [] },
        { id: "beans", label: "Green beans", followUpPrompt: null, followUpChoices: [] },
        { id: "veg", label: "Vegetables", followUpPrompt: null, followUpChoices: [] },
      ],
    },
    {
      id: "drink",
      label: "Drink",
      minSelections: 1,
      maxSelections: 1,
      options: [{ id: "coke", label: "Coke", followUpPrompt: null, followUpChoices: [] }],
    },
    {
      id: "dessert",
      label: "Dessert",
      minSelections: 0,
      maxSelections: 1,
      options: [{ id: "cake", label: "Chocolate cake", followUpPrompt: null, followUpChoices: [] }],
    },
  ];
}

test("min=1 max=1 course requires exactly one option", () => {
  const courses = menu();
  assert.equal(
    validateMealSelections(courses, [{ courseId: "entree", optionId: "filet", followUpChoiceId: "med-rare" }]).ok,
    false,
  );
  const ok = validateMealSelections(courses, [
    { courseId: "entree", optionId: "filet", followUpChoiceId: "med-rare" },
    { courseId: "drink", optionId: "coke" },
  ]);
  assert.equal(ok.ok, true);
});

test("min=0 max=3 multi-select course allows multiple sides", () => {
  const courses = menu();
  const ok = validateMealSelections(courses, [
    { courseId: "entree", optionId: "chicken" },
    { courseId: "sides", optionId: "potatoes" },
    { courseId: "sides", optionId: "beans" },
    { courseId: "drink", optionId: "coke" },
  ]);
  assert.equal(ok.ok, true);
});

test("too many options in a course is rejected", () => {
  const courses = menu();
  const result = validateMealSelections(courses, [
    { courseId: "entree", optionId: "chicken" },
    { courseId: "sides", optionId: "potatoes" },
    { courseId: "sides", optionId: "beans" },
    { courseId: "sides", optionId: "veg" },
    { courseId: "sides", optionId: "potatoes" },
    { courseId: "drink", optionId: "coke" },
  ]);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "duplicate_option");

  const tooManySides = validateMealSelections(courses, [
    { courseId: "entree", optionId: "chicken" },
    { courseId: "sides", optionId: "potatoes" },
    { courseId: "sides", optionId: "beans" },
    { courseId: "sides", optionId: "veg" },
    { courseId: "sides", optionId: "potatoes" },
    { courseId: "drink", optionId: "coke" },
  ]);
  assert.equal(tooManySides.ok, false);

  const fourSides = validateMealSelections(
    [
      ...menu().slice(0, 1),
      {
        ...menu()[1]!,
        options: [
          ...menu()[1]!.options,
          { id: "mac", label: "Mac and cheese", followUpPrompt: null, followUpChoices: [] },
        ],
        maxSelections: 3,
      },
      ...menu().slice(2),
    ],
    [
      { courseId: "entree", optionId: "chicken" },
      { courseId: "sides", optionId: "potatoes" },
      { courseId: "sides", optionId: "beans" },
      { courseId: "sides", optionId: "veg" },
      { courseId: "sides", optionId: "mac" },
      { courseId: "drink", optionId: "coke" },
    ],
  );
  assert.equal(fourSides.ok, false);
  if (!fourSides.ok) assert.equal(fourSides.reason, "too_many");
});

test("duplicate selection in same course is rejected", () => {
  const courses = menu();
  const result = validateMealSelections(courses, [
    { courseId: "entree", optionId: "chicken" },
    { courseId: "sides", optionId: "potatoes" },
    { courseId: "sides", optionId: "potatoes" },
    { courseId: "drink", optionId: "coke" },
  ]);
  assert.equal(result.ok, false);
});

test("option from wrong course is rejected", () => {
  const courses = menu();
  const result = validateMealSelections(courses, [
    { courseId: "entree", optionId: "coke" },
    { courseId: "drink", optionId: "coke" },
  ]);
  assert.equal(result.ok, false);
});

test("conditional follow-up only applies to selected option", () => {
  const courses = menu();
  const chickenOnly = validateMealSelections(courses, [
    { courseId: "entree", optionId: "chicken" },
    { courseId: "drink", optionId: "coke" },
  ]);
  assert.equal(chickenOnly.ok, true);

  const filetMissing = validateMealSelections(courses, [
    { courseId: "entree", optionId: "filet" },
    { courseId: "drink", optionId: "coke" },
  ]);
  assert.equal(filetMissing.ok, false);
});

test("required follow-up makes order incomplete until answered", () => {
  const courses = menu();
  assert.equal(
    isMealOrderComplete(courses, [
      { courseId: "entree", optionId: "filet" },
      { courseId: "drink", optionId: "coke" },
    ]),
    false,
  );
  assert.equal(
    isMealOrderComplete(courses, [
      { courseId: "entree", optionId: "filet", followUpChoiceId: "rare" },
      { courseId: "drink", optionId: "coke" },
    ]),
    true,
  );
});

test("optional course does not block completion", () => {
  const courses = menu();
  assert.equal(
    isMealOrderComplete(courses, [
      { courseId: "entree", optionId: "chicken" },
      { courseId: "drink", optionId: "coke" },
    ]),
    true,
  );
});

test("meal order progress and summary counts", () => {
  const courses = menu();
  const stats = summarizeMealOrders(courses, [
    {
      selections: [
        { courseId: "entree", optionId: "chicken" },
        { courseId: "drink", optionId: "coke" },
      ],
    },
    { selections: [{ courseId: "entree", optionId: "chicken" }] },
  ]);
  assert.equal(stats.complete, 1);
  assert.equal(stats.started, 1);
  assert.equal(mealOrderProgress(courses, []), "none");
});

test("course selection hints", () => {
  assert.equal(courseSelectionHint({ minSelections: 1, maxSelections: 1 }), "Choose 1");
  assert.equal(courseSelectionHint({ minSelections: 0, maxSelections: 3 }), "Choose up to 3");
});

test("print-style summary keeps follow-up answers", () => {
  const courses = menu();
  const summary = formatMealOrderSummary(courses, [
    { courseId: "entree", optionId: "filet", followUpChoiceId: "med-rare" },
    { courseId: "sides", optionId: "potatoes" },
    { courseId: "sides", optionId: "beans" },
    { courseId: "drink", optionId: "coke" },
  ]);
  assert.match(summary, /Filet — Medium Rare/);
  assert.match(summary, /Mashed potatoes/);
  assert.match(summary, /Coke/);
});

test("publish gate blocks ordinary viewers until published", () => {
  assert.equal(canSubmitMealOrder({ published: false, canEditMenu: false }), false);
  assert.equal(canSubmitMealOrder({ published: true, canEditMenu: false }), true);
  assert.equal(canSubmitMealOrder({ published: false, canEditMenu: true }), true);
});

test("legacy single-choice map remains readable", () => {
  const courses = [{ id: "entree", label: "Entree", options: [{ id: "a", label: "A" }] }];
  const map = { entree: "a", drink: null };
  const selections = selectionsFromLegacyChoiceMap(courses, map);
  assert.deepEqual(selections, [{ courseId: "entree", optionId: "a" }]);
  assert.deepEqual(legacyChoiceMapFromSelections(selections), { entree: "a" });
});

test("partial validation allows in-progress saves under max", () => {
  const courses = menu();
  const result = validatePartialMealSelections(courses, [
    { courseId: "entree", optionId: "chicken" },
    { courseId: "sides", optionId: "potatoes" },
  ]);
  assert.equal(result.ok, true);
});
