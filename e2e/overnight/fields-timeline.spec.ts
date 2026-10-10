import { expect, test, type Locator, type Page } from "@playwright/test";
import { parsedTimeFields } from "../../src/lib/day-of-time";
import { overnightPrisma } from "./db";
import { attachGuards, editCard, expectAllSaved, expectNoSidewaysScroll, openTimelineEditor, reviewRow } from "./helpers";

/**
 * Field sweep for the Wedding Day editor (/plan/timeline), the rehearsal
 * walkthrough and menu (/plan/rehearsal) and the master-only Preview time
 * control: every box gets typed in, cleared, pasted into and reloaded.
 * The spec creates the moments it edits, so it can run again and again.
 */
const prisma = overnightPrisma();
const PREFIX = "Fields sweep";

type Seed = { key: string; startAt: string; endAt?: string | null; schedule?: "wedding" | "rehearsal"; notes?: string };

const SEEDS: Seed[] = [
  { key: "hour-13", startAt: "3:00 PM" },
  { key: "hour-full", startAt: "3:00 PM" },
  { key: "hour-fast", startAt: "3:00 PM" },
  { key: "minute-fast", startAt: "3:00 PM" },
  { key: "hour-zero", startAt: "3:00 PM" },
  { key: "hour-clear", startAt: "3:00 PM" },
  { key: "notes-clear", startAt: "3:00 PM" },
  { key: "notes-type", startAt: "3:00 PM" },
  { key: "location", startAt: "3:00 PM", notes: `${PREFIX} location\nlocation: Test room\nTest line` },
  { key: "end-clear", startAt: "3:00 PM", endAt: "4:00 PM" },
  { key: "remove", startAt: "3:00 PM" },
  { key: "reh-hour", startAt: "5:00 PM", schedule: "rehearsal" },
];

const ids = new Map<string, string>();

async function withRetry<T>(fn: () => Promise<T>, tries = 40): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
  throw last;
}

test.beforeAll(async () => {
  await withRetry(() => prisma.$connect());
  await prisma.timelineBlock.deleteMany({ where: { OR: [{ notes: { startsWith: PREFIX } }, { notes: "Untitled moment" }] } });
  for (const seed of SEEDS) {
    const notes = seed.notes ?? `${PREFIX} ${seed.key}\nTest line`;
    const row = await prisma.timelineBlock.create({
      data: {
        startAt: seed.startAt,
        endAt: seed.endAt ?? null,
        notes,
        sortOrder: 900,
        schedule: seed.schedule ?? "wedding",
        ...parsedTimeFields(seed.startAt, seed.endAt ?? null),
      },
    });
    ids.set(seed.key, row.id);
  }
});
test.afterAll(async () => prisma.$disconnect());

function block(key: string) {
  const id = ids.get(key);
  if (!id) throw new Error(`no seeded block ${key}`);
  return id;
}

async function saved(key: string) {
  const row = await prisma.timelineBlock.findUnique({ where: { id: block(key) } });
  if (!row) throw new Error(`block ${key} is gone`);
  return row;
}

async function openCard(page: Page, key: string, path = "/plan/timeline") {
  if (path === "/plan/timeline") {
    await openTimelineEditor(page);
  } else {
    await page.goto(path);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByRole("button", { name: "+ Add moment" })).toBeVisible();
  }
  const card = editCard(page, block(key));
  await card.scrollIntoViewIfNeeded();
  return card;
}

/** Taps the box the way a person does, with a beat before typing. */
async function tap(page: Page, field: Locator) {
  await field.click();
  await page.waitForTimeout(80);
}

test.describe("Wedding Day editor · start and end time boxes", () => {
  test("typing 13 into the hour reads 1 PM instead of being forced to 12", async ({ page }) => {
    const guards = attachGuards(page);
    const card = await openCard(page, "hour-13");
    const hour = card.getByLabel("Start time hour");
    await tap(page, hour);
    await page.keyboard.type("13", { delay: 60 });
    await page.keyboard.press("Enter");
    await expectAllSaved(page);
    await expect(hour).toHaveValue("1");
    await expect(card.getByRole("button", { name: /^Start time PM/ })).toBeVisible();
    expect((await saved("hour-13")).startAt).toBe("1:00 PM");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(reviewRow(page, block("hour-13"))).toContainText("1:00 PM");
    guards.assertClean();
  });

  test("a 9 typed into a full hour box replaces 12 instead of being thrown away", async ({ page }) => {
    const guards = attachGuards(page);
    const card = await openCard(page, "hour-full");
    const hour = card.getByLabel("Start time hour");
    await tap(page, hour);
    await page.keyboard.type("12", { delay: 60 });
    await page.keyboard.press("Enter");
    await expectAllSaved(page);
    expect((await saved("hour-full")).startAt).toBe("12:00 PM");
    // Caret at the end, nothing selected: the box already holds two digits.
    await tap(page, hour);
    await page.keyboard.press("End");
    await page.keyboard.type("9");
    await expect(hour).toHaveValue("9");
    await page.keyboard.press("Enter");
    await expectAllSaved(page);
    await expect(hour).toHaveValue("9");
    expect((await saved("hour-full")).startAt).toBe("9:00 PM");
    guards.assertClean();
  });

  test("digits typed straight after a click are all kept", async ({ page }) => {
    const guards = attachGuards(page);
    const card = await openCard(page, "hour-fast");
    const hour = card.getByLabel("Start time hour");
    const minute = card.getByLabel("Start time minutes");
    await hour.click();
    await page.keyboard.type("11");
    await page.keyboard.press("Enter");
    await expectAllSaved(page);
    await expect(hour).toHaveValue("11");
    expect((await saved("hour-fast")).startAt).toBe("11:00 PM");
    await hour.click();
    await page.keyboard.type("7");
    await page.keyboard.press("Enter");
    await expectAllSaved(page);
    await expect(hour).toHaveValue("7");
    await minute.click();
    await page.keyboard.type("30");
    await page.keyboard.press("Enter");
    await expectAllSaved(page);
    await expect(minute).toHaveValue("30");
    expect((await saved("hour-fast")).startAt).toBe("7:30 PM");
    guards.assertClean();
  });

  test("typing 0 reads 12, and 9 can then be typed over it", async ({ page }) => {
    const guards = attachGuards(page);
    const card = await openCard(page, "hour-zero");
    const hour = card.getByLabel("Start time hour");
    await tap(page, hour);
    await page.keyboard.type("0");
    await page.keyboard.press("Enter");
    await expectAllSaved(page);
    await expect(hour).toHaveValue("12");
    expect((await saved("hour-zero")).startAt).toBe("12:00 PM");
    await tap(page, hour);
    await page.keyboard.type("9");
    await page.keyboard.press("Enter");
    await expectAllSaved(page);
    await expect(hour).toHaveValue("9");
    expect((await saved("hour-zero")).startAt).toBe("9:00 PM");
    // Backspace to empty, then type again: nothing lost.
    await tap(page, hour);
    await page.keyboard.press("End");
    await page.keyboard.press("Backspace");
    await expect(hour).toHaveValue("");
    await page.keyboard.type("4");
    await page.keyboard.press("Enter");
    await expectAllSaved(page);
    expect((await saved("hour-zero")).startAt).toBe("4:00 PM");
    // Pasted junk never becomes a time.
    await tap(page, hour);
    await page.keyboard.insertText("-5");
    await page.keyboard.press("Enter");
    await expectAllSaved(page);
    expect((await saved("hour-zero")).startAt).toBe("5:00 PM");
    await tap(page, hour);
    await page.keyboard.press("Control+a");
    await page.keyboard.insertText("99");
    await page.keyboard.press("Enter");
    await expectAllSaved(page);
    await expect(hour).toHaveValue("5");
    expect((await saved("hour-zero")).startAt).toBe("5:00 PM");
    guards.assertClean();
  });

  test("clearing the start hour keeps the saved time and says so", async ({ page }) => {
    const guards = attachGuards(page);
    const card = await openCard(page, "hour-clear");
    const hour = card.getByLabel("Start time hour");
    await tap(page, hour);
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Delete");
    await expect(hour).toHaveValue("");
    await page.keyboard.press("Enter");
    await expectAllSaved(page);
    await expect(hour).toHaveValue("3");
    await expect(card).toContainText("A moment needs a start time — kept the saved one.");
    expect((await saved("hour-clear")).startAt).toBe("3:00 PM");
    // The notice goes away with the next edit.
    await tap(page, hour);
    await page.keyboard.type("6");
    await page.keyboard.press("Enter");
    await expectAllSaved(page);
    await expect(card).not.toContainText("kept the saved one");
    expect((await saved("hour-clear")).startAt).toBe("6:00 PM");
    guards.assertClean();
  });

  test("clearing the end time empties it and stays empty after reload", async ({ page }) => {
    const guards = attachGuards(page);
    const card = await openCard(page, "end-clear");
    const endHour = card.getByLabel("End time hour");
    await expect(endHour).toHaveValue("4");
    await tap(page, endHour);
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Delete");
    await page.keyboard.press("Enter");
    await expectAllSaved(page);
    expect((await saved("end-clear")).endAt).toBeNull();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(card.getByLabel("End time hour")).toHaveValue("");
    // Typing it back works and it reads after the start.
    await tap(page, card.getByLabel("End time hour"));
    await page.keyboard.type("5");
    await page.keyboard.press("Enter");
    await expectAllSaved(page);
    // An end typed after a 3 PM start reads PM, not 5 AM the next morning.
    expect((await saved("end-clear")).endAt).toBe("5:00 PM");
    await expect(card.getByText("Ends before it starts")).toHaveCount(0);
    guards.assertClean();
  });
});

test.describe("Wedding Day editor · notes and location", () => {
  test("deleting every word of the notes keeps the saved title and says so", async ({ page }) => {
    const guards = attachGuards(page);
    const card = await openCard(page, "notes-clear");
    const notes = card.locator("textarea");
    await notes.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Delete");
    await expect(notes).toHaveValue("");
    await notes.blur();
    await expectAllSaved(page);
    await expect(notes).toHaveValue(`${PREFIX} notes-clear\nTest line`);
    await expect(card).toContainText("A moment needs a title — kept the saved one.");
    expect((await saved("notes-clear")).notes).toBe(`${PREFIX} notes-clear\nTest line`);
    // Whitespace only is the same as empty.
    await notes.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.insertText("   ");
    await notes.blur();
    await expectAllSaved(page);
    expect((await saved("notes-clear")).notes).toBe(`${PREFIX} notes-clear\nTest line`);
    guards.assertClean();
  });

  test("typed, pasted and backspaced notes save exactly and come back after reload", async ({ page }) => {
    const guards = attachGuards(page);
    const card = await openCard(page, "notes-type");
    const notes = card.locator("textarea");
    // 0, backspace, 9 on the title line.
    await notes.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("0");
    await page.keyboard.press("Backspace");
    await page.keyboard.type("9");
    await expect(notes).toHaveValue("9");
    await notes.blur();
    await expectAllSaved(page);
    expect((await saved("notes-type")).notes).toBe("9");
    await expect(card).not.toContainText("kept the saved one");
    // Backspace to empty while focused, then type again: nothing is forced in meanwhile.
    await notes.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Backspace");
    await expect(notes).toHaveValue("");
    await page.waitForTimeout(700);
    expect((await saved("notes-type")).notes).toBe("9");
    await page.keyboard.type(`${PREFIX} notes-type`, { delay: 0 });
    await expect(notes).toHaveValue(`${PREFIX} notes-type`);
    await notes.blur();
    await expectAllSaved(page);
    // Pasted quotes, tags, emoji and a long line survive; Enter adds a line.
    const long = "x".repeat(2000);
    await notes.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.press("Enter");
    await page.keyboard.insertText(`Test 'q' "dq" \`bt\` <b>x</b> 🎉`);
    await page.keyboard.press("Enter");
    await page.keyboard.insertText(long);
    await notes.blur();
    await expectAllSaved(page);
    const row = await saved("notes-type");
    expect(row.notes).toBe(`${PREFIX} notes-type\nTest 'q' "dq" \`bt\` <b>x</b> 🎉\n${long}`);
    await expectNoSidewaysScroll(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(reviewRow(page, block("notes-type"))).toContainText(`Test 'q' "dq" \`bt\` <b>x</b> 🎉`);
    await expectNoSidewaysScroll(page);
    guards.assertClean();
  });

  test("the location box saves what is typed and stays empty once cleared", async ({ page }) => {
    const guards = attachGuards(page);
    const card = await openCard(page, "location");
    const location = card.getByPlaceholder("Where this happens");
    await expect(location).toHaveValue("Test room");
    await location.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("0");
    await page.keyboard.press("Backspace");
    await page.keyboard.type("9");
    await page.keyboard.press("Enter");
    await location.blur();
    await expectAllSaved(page);
    expect((await saved("location")).notes).toBe(`${PREFIX} location\nlocation: 9\nTest line`);
    await location.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Delete");
    await location.blur();
    await expectAllSaved(page);
    expect((await saved("location")).notes).toBe(`${PREFIX} location\nTest line`);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(card.getByPlaceholder("Where this happens")).toHaveValue("");
    guards.assertClean();
  });
});

test.describe("Wedding Day editor · adding and removing moments", () => {
  test("Add with nothing filled in says what is missing instead of doing nothing", async ({ page }) => {
    const guards = attachGuards(page);
    await openTimelineEditor(page);
    await page.getByRole("button", { name: "+ Add moment" }).click();
    const draft = page.locator("#day-draft");
    await draft.getByRole("button", { name: "Add", exact: true }).click();
    await expect(draft.getByRole("alert")).toContainText("Add a start time or what happens first.");
    await expect(draft).toBeVisible();
    expect(await prisma.timelineBlock.count({ where: { notes: "Untitled moment" } })).toBe(0);
    // Typing clears the message; a real moment then saves with its location and lines.
    await draft.locator("textarea").click();
    await page.keyboard.type(`${PREFIX} draft added`);
    await expect(draft.getByRole("alert")).toHaveCount(0);
    await page.keyboard.press("Enter");
    await page.keyboard.type("Second line");
    await draft.getByPlaceholder("Location (optional)").fill("  Test place  ");
    const hour = draft.getByLabel("Start time hour");
    await tap(page, hour);
    await page.keyboard.type("19", { delay: 60 });
    await page.keyboard.press("Enter");
    await draft.getByRole("button", { name: "Add", exact: true }).click();
    await expect(draft).toHaveCount(0);
    await expectAllSaved(page);
    const created = await prisma.timelineBlock.findFirst({ where: { notes: { startsWith: `${PREFIX} draft added` } } });
    expect(created?.startAt).toBe("7:00 PM");
    expect(created?.notes).toBe(`${PREFIX} draft added\nlocation: Test place\nSecond line`);
    await expect(editCard(page, created!.id)).toBeVisible();
    // Discard throws a draft away without saving.
    await page.getByRole("button", { name: "+ Add moment" }).click();
    await draft.locator("textarea").fill(`${PREFIX} draft discarded`);
    await draft.getByRole("button", { name: "Discard" }).click();
    await expect(draft).toHaveCount(0);
    await page.waitForTimeout(600);
    expect(await prisma.timelineBlock.count({ where: { notes: { startsWith: `${PREFIX} draft discarded` } } })).toBe(0);
    guards.assertClean();
  });

  test("Keep leaves a moment alone and Remove? takes it away for good", async ({ page }) => {
    const guards = attachGuards(page);
    const card = await openCard(page, "remove");
    await card.getByRole("button", { name: "Remove moment" }).click();
    await card.getByRole("button", { name: "Keep" }).click();
    await expect(card.getByRole("button", { name: "Remove moment" })).toBeVisible();
    expect(await prisma.timelineBlock.findUnique({ where: { id: block("remove") } })).not.toBeNull();
    await card.getByRole("button", { name: "Remove moment" }).click();
    await card.getByRole("button", { name: "Remove?" }).click();
    await expect(card).toHaveCount(0);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).not.toContainText(`${PREFIX} remove`);
    expect(await prisma.timelineBlock.findUnique({ where: { id: block("remove") } })).toBeNull();
    guards.assertClean();
  });
});

test.describe("Rehearsal & Dinner", () => {
  test("the walkthrough hour understands 19 as 7 PM", async ({ page }) => {
    const guards = attachGuards(page);
    const card = await openCard(page, "reh-hour", "/plan/rehearsal");
    const hour = card.getByLabel("Start time hour");
    await tap(page, hour);
    await page.keyboard.type("19", { delay: 60 });
    await page.keyboard.press("Enter");
    await expectAllSaved(page);
    await expect(hour).toHaveValue("7");
    expect((await saved("reh-hour")).startAt).toBe("7:00 PM");
    guards.assertClean();
  });

  test("menu courses and dishes save on Enter, keep their name when cleared, and go with Remove", async ({ page }) => {
    const guards = attachGuards(page);
    const courseName = `${PREFIX} course`;
    await prisma.mealOption.deleteMany({ where: { course: { label: courseName } } });
    await prisma.mealCourse.deleteMany({ where: { label: courseName } });
    await page.goto("/plan/rehearsal");
    await page.getByRole("button", { name: "+ Add course" }).click();
    const course = page.getByPlaceholder("Course name (Entree, Side, Drink…)").last();
    await expect(course).toBeFocused();
    await page.keyboard.type("0");
    await page.keyboard.press("Backspace");
    await page.keyboard.type(courseName);
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await prisma.mealCourse.findFirst({ where: { label: courseName } }))?.label).toBe(courseName);
    // Clearing a named course keeps its name (it is not deleted behind the typist's back).
    await course.click();
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Delete");
    await course.blur();
    await expect(course).toHaveValue(courseName);
    const section = page.locator("div.px-3.py-2").filter({ has: course });
    await section.getByRole("button", { name: "+ Add dish" }).click();
    const dish = section.getByPlaceholder("Dish name").last();
    await expect(dish).toBeFocused();
    // A beat before typing, as a person's first letter never lands in the same instant the box appears.
    await page.waitForTimeout(80);
    await page.keyboard.type("Test dish 🎉 'q'");
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await prisma.mealOption.findFirst({ where: { label: "Test dish 🎉 'q'" } }))?.label).toBe("Test dish 🎉 'q'");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByPlaceholder("Dish name").filter({ hasText: "" }).last()).toHaveValue("Test dish 🎉 'q'");
    // A guest can pick the dish and un-pick it.
    const pill = page.getByRole("button", { name: "Test dish 🎉 'q'", exact: true }).first();
    if (await pill.count()) {
      await pill.click();
      await expect.poll(() => prisma.mealChoice.count({ where: { option: { label: "Test dish 🎉 'q'" } } })).toBe(1);
      await pill.click();
      await expect.poll(() => prisma.mealChoice.count({ where: { option: { label: "Test dish 🎉 'q'" } } })).toBe(0);
    }
    const again = page.locator("div.px-3.py-2").filter({ has: page.getByPlaceholder("Course name (Entree, Side, Drink…)").last() });
    await again.getByRole("button", { name: "Remove dish" }).first().click();
    await expect.poll(() => prisma.mealOption.count({ where: { label: "Test dish 🎉 'q'" } })).toBe(0);
    await again.getByRole("button", { name: "Remove course" }).click();
    await expect.poll(() => prisma.mealCourse.count({ where: { label: courseName } })).toBe(0);
    guards.assertClean();
  });

  test("the menu visibility toggle saves and reads back after reload", async ({ page }) => {
    const guards = attachGuards(page);
    await page.goto("/plan/rehearsal");
    const toggle = page.getByRole("button", { name: /Visible to guests|Hidden from guests/ });
    const before = await toggle.innerText();
    await toggle.click();
    await expect(toggle).not.toHaveText(before);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /Visible to guests|Hidden from guests/ })).not.toHaveText(before);
    await page.getByRole("button", { name: /Visible to guests|Hidden from guests/ }).click();
    await expect(page.getByRole("button", { name: /Visible to guests|Hidden from guests/ })).toHaveText(before);
    guards.assertClean();
  });
});

test.describe("Preview time (master only)", () => {
  test("preset, custom time, sample fixture and Clear all land in the address bar", async ({ page }) => {
    const guards = attachGuards(page);
    await page.goto("/plan/timeline");
    const control = page.locator("details.preview-time-control");
    await expect(control).toHaveCount(1);
    await control.locator("summary").click();
    const preset = page.locator("#preview-time-preset");
    await preset.selectOption({ index: 1 });
    await expect(page).toHaveURL(/asOf=/);
    const chosen = await preset.inputValue();
    expect(chosen).not.toBe("");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#preview-time-preset")).toHaveValue(chosen);
    await page.locator("details.preview-time-control summary").click();
    await expect(page.getByRole("button", { name: "Apply", exact: true })).toBeDisabled();
    await page.locator("#preview-time-custom").fill("2026-10-16T14:30");
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    // 2:30 PM in Detroit on the wedding day is 18:30 UTC.
    await expect(page).toHaveURL(/asOf=2026-10-16T18%3A30%3A00\.000Z/);
    await expect(control.locator("summary")).toContainText(/custom/i);
    await page.getByRole("checkbox").first().click();
    await expect(page).toHaveURL(/fixture=production-wedding/);
    await expect(page.getByRole("checkbox").first()).toBeChecked();
    await page.getByRole("button", { name: "Clear preview" }).click();
    await expect(page).not.toHaveURL(/asOf=|fixture=/);
    guards.assertClean();
  });
});

test.describe("Wedding places", () => {
  test("venue fields save what is typed, and a cleared field stays empty after reload", async ({ page }) => {
    const guards = attachGuards(page);
    const before = await prisma.appSettings.findUnique({ where: { id: 1 } });
    await page.goto("/plan/timeline#venues");
    const venue = page.locator("#venues");
    const name = venue.getByLabel("Place name").first();
    const zip = venue.getByLabel("ZIP").first();
    await expect(name).toBeVisible();
    await name.fill("");
    await name.pressSequentially("Test venue 'q' 🎉");
    await zip.fill("");
    await zip.pressSequentially("0");
    await zip.press("Backspace");
    await zip.pressSequentially("9");
    await expect(zip).toHaveValue("9");
    await venue.getByRole("button", { name: "Save wedding places" }).click();
    await expect.poll(async () => (await prisma.appSettings.findUnique({ where: { id: 1 } }))?.venueName).toBe("Test venue 'q' 🎉");
    expect((await prisma.appSettings.findUnique({ where: { id: 1 } }))?.venueZip).toBe("9");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#venues").getByLabel("Place name").first()).toHaveValue("Test venue 'q' 🎉");
    // Clear the name (whitespace only) and save: it must come back empty, not as spaces.
    const nameAgain = page.locator("#venues").getByLabel("Place name").first();
    await nameAgain.fill("   ");
    await page.locator("#venues").getByRole("button", { name: "Save wedding places" }).click();
    await expect.poll(async () => (await prisma.appSettings.findUnique({ where: { id: 1 } }))?.venueName).toBeNull();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#venues").getByLabel("Place name").first()).toHaveValue("");
    // Put the seeded values back so the page reads as before.
    await prisma.appSettings.update({ where: { id: 1 }, data: { venueName: before?.venueName ?? null, venueZip: before?.venueZip ?? null } });
    guards.assertClean();
  });
});
