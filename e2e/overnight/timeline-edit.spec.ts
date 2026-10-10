import { expect, test } from "@playwright/test";
import { overnightPrisma, resetOvernightData } from "./db";
import {
  attachGuards,
  blockByTitle,
  editCard,
  expectAllSaved,
  expectNoSidewaysScroll,
  openTimelineEditor,
  reviewRow,
  setStartTime,
} from "./helpers";

const prisma = overnightPrisma();

// These checks shape the network with page.route, which cannot see requests that a
// service worker handles in WebKit and Firefox, so the worker stays out of these pages.
test.use({ serviceWorkers: "block" });

test.beforeAll(async () => {
  await resetOvernightData(prisma);
});
test.afterAll(async () => prisma.$disconnect());

test.describe("Wedding Day editor", () => {
  test("typed notes with spaces and new lines survive save and reload", async ({ page }) => {
    const guards = attachGuards(page);
    const block = await blockByTitle(prisma, "Ceremony");
    await openTimelineEditor(page);
    const card = editCard(page, block.id);
    await card.scrollIntoViewIfNeeded();
    const notes = card.locator("textarea");
    const before = await notes.inputValue();

    // Type the way a person does: a space inside a line, then Enter for a second line.
    await notes.click();
    await notes.press("Control+End");
    await notes.pressSequentially("\nOvernight check: rings on the entry table", { delay: 15 });
    await expect(notes).toHaveValue(`${before}\nOvernight check: rings on the entry table`);
    await notes.pressSequentially(" at 3:20 PM", { delay: 15 });
    await expect(notes).toHaveValue(`${before}\nOvernight check: rings on the entry table at 3:20 PM`);
    await notes.blur();
    await expectAllSaved(page);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Review", exact: true })).toBeVisible();
    await expect(reviewRow(page, block.id)).toContainText("Overnight check: rings on the entry table at 3:20 PM");

    const saved = await prisma.timelineBlock.findUnique({ where: { id: block.id } });
    expect(saved?.notes).toBe(`${block.notes}\nOvernight check: rings on the entry table at 3:20 PM`);
    await expectNoSidewaysScroll(page);
    guards.assertClean();
  });

  test("a location edit is saved and shown after reload", async ({ page }) => {
    const guards = attachGuards(page);
    const block = await blockByTitle(prisma, "Getaway vehicle photos");
    await openTimelineEditor(page);
    const card = editCard(page, block.id);
    await card.scrollIntoViewIfNeeded();
    const location = card.getByPlaceholder("Where this happens");
    await location.click();
    await location.fill("Head table");
    await location.blur();
    await expectAllSaved(page);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(reviewRow(page, block.id)).toContainText("Head table");
    const saved = await prisma.timelineBlock.findUnique({ where: { id: block.id } });
    expect(saved?.notes.split("\n")[1]).toBe("location: Head table");
    guards.assertClean();
  });

  test("a start time change moves the moment and survives reload", async ({ page }) => {
    const guards = attachGuards(page);
    const block = await blockByTitle(prisma, "Dollar dance");
    await openTimelineEditor(page);
    const card = editCard(page, block.id);
    await card.scrollIntoViewIfNeeded();
    await setStartTime(card, "9", "05", "PM");
    await expectAllSaved(page);
    await expect(card.getByLabel("Start time hour")).toHaveValue("9");
    await expect(card.getByLabel("Start time minutes")).toHaveValue("05");

    await page.reload({ waitUntil: "domcontentloaded" });
    const row = reviewRow(page, block.id);
    await expect(row).toContainText("9:05 PM");
    const saved = await prisma.timelineBlock.findUnique({ where: { id: block.id } });
    expect(saved?.startAt).toBe("9:05 PM");
    expect(saved?.startMinutes).toBe(21 * 60 + 5);
    // The page keeps moments in time order after the move.
    const times = await page.locator(".day-timeline-time").allInnerTexts();
    const index = times.findIndex((text) => text.startsWith("9:05 PM"));
    expect(index).toBeGreaterThan(0);
    expect(times[index - 1]).toMatch(/^(8|9:0[0-4]) ?/);
    guards.assertClean();
  });

  test("Remove takes the moment off the page and out of the data", async ({ page }) => {
    const guards = attachGuards(page);
    const block = await blockByTitle(prisma, "Night-sky photos and Barry finishes");
    await openTimelineEditor(page);
    const card = editCard(page, block.id);
    await card.scrollIntoViewIfNeeded();
    await card.getByRole("button", { name: "Remove moment" }).click();
    await card.getByRole("button", { name: "Remove?" }).click();
    await expect(card).toHaveCount(0);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).not.toContainText("Night-sky photos and Barry finishes");
    expect(await prisma.timelineBlock.findUnique({ where: { id: block.id } })).toBeNull();
    guards.assertClean();
  });

  test("Remove still works after the app was redeployed under an open page", async ({ page }) => {
    // The old page's server actions no longer exist after a deploy: the server answers 404.
    const guards = attachGuards(page, { allow: /status of 404/ });
    const block = await blockByTitle(prisma, "Private final dance");
    await openTimelineEditor(page);
    const card = editCard(page, block.id);
    await card.scrollIntoViewIfNeeded();
    let blocked = 0;
    await page.route("**/plan/timeline", (route) => {
      if (route.request().method() === "POST" && blocked < 1) {
        blocked += 1;
        return route.fulfill({ status: 404, body: "" });
      }
      return route.continue();
    });
    await card.getByRole("button", { name: "Remove moment" }).click();
    await card.getByRole("button", { name: "Remove?" }).click();
    const alert = page.getByRole("alert").filter({ hasText: "saving" });
    await expect(alert).toContainText(/aren’t saving|reload/i);
    await expect(card).toHaveCount(1);
    // Second try goes through once the server answers again.
    await expect(page.getByText("Couldn’t remove that moment")).toBeVisible();
    const confirm = card.getByRole("button", { name: "Remove?" });
    if (!(await confirm.count())) await card.getByRole("button", { name: "Remove moment" }).click();
    await confirm.click();
    await expect(card).toHaveCount(0);
    await expect(alert).toHaveCount(0);
    expect(await prisma.timelineBlock.findUnique({ where: { id: block.id } })).toBeNull();
    guards.assertClean();
  });

  test("Reload prompt asks before throwing away unsaved text, then retry saves it", async ({ page }) => {
    const guards = attachGuards(page);
    const block = await blockByTitle(prisma, "Last open dance");
    await openTimelineEditor(page);
    const card = editCard(page, block.id);
    await card.scrollIntoViewIfNeeded();

    let offline = true;
    await page.route("**/plan/timeline", (route) => {
      if (route.request().method() === "POST" && offline) return route.abort("connectionfailed");
      return route.continue();
    });

    const notes = card.locator("textarea");
    await notes.click();
    await notes.press("Control+End");
    await notes.pressSequentially("\nOvernight check: typed while offline", { delay: 10 });
    await notes.blur();
    await expect(card.getByText(/Couldn’t save — tap to retry/)).toBeVisible();
    const alert = page.getByRole("alert").filter({ hasText: "saving" });
    await expect(alert).toContainText(/aren’t saving/);

    // Reload must ask first, and declining keeps the text on the page.
    let asked = "";
    page.once("dialog", (dialog) => {
      asked = dialog.message();
      void dialog.dismiss();
    });
    await alert.getByRole("button", { name: "Reload" }).click();
    await page.waitForTimeout(300);
    expect(asked).toMatch(/haven’t saved/);
    await expect(notes).toHaveValue(new RegExp("typed while offline$"));

    offline = false;
    await card.getByRole("button", { name: /Couldn’t save — tap to retry/ }).click();
    await expectAllSaved(page);
    await expect(alert).toHaveCount(0);
    const saved = await prisma.timelineBlock.findUnique({ where: { id: block.id } });
    expect(saved?.notes.endsWith("Overnight check: typed while offline")).toBe(true);
    guards.assertClean();
  });
});
