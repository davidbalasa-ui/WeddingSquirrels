import { expect, test } from "@playwright/test";
import { DAY_OF_CONTACTS, WEDDING_TITLES } from "./expected";
import { attachPageGuards, countVisibleTitles, openPreviewPreset } from "./helpers";

test.describe("day of", () => {
  test("10:42 AM overlap NOW / NEXT / AFTER THAT", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/day");
    await openPreviewPreset(page, "Wedding day — 10:42 AM");
    const main = page.locator("#main-content");
    await expect(main.getByRole("paragraph").filter({ hasText: /^Today$/ })).toBeVisible();
    await expect(main).toContainText("Settle in at Airbnb");
    await expect(main).toContainText("Venue Opens");
    await expect(main).toContainText("Vendor + Wedding Party Arrival");
    await expect(main).toContainText("Wedding party DIY hair & makeup");
    await expect(main).toContainText("Wedding party packs up");
    await expect(main.getByRole("paragraph").filter({ hasText: /^Now$/ })).toBeVisible();
    await expect(main.getByRole("heading", { name: /Next/ })).toBeVisible();
    await expect(main.getByRole("heading", { name: /After that/ })).toBeVisible();
    guards.assertClean();
  });

  test("later wedding-day NOW moments", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/day");
    const main = page.locator("#main-content");
    await openPreviewPreset(page, "Wedding day — ceremony");
    await expect(main.getByRole("paragraph").filter({ hasText: /^Now$/ })).toBeVisible();
    await expect(main).toContainText("Ceremony");

    await openPreviewPreset(page, "Wedding day — dinner");
    await expect(main).toContainText("Dinner begins");

    await openPreviewPreset(page, "Wedding day — dancing");
    await expect(main).toContainText("Open Dancing");

    await openPreviewPreset(page, "Wedding day — teardown");
    await expect(main).toContainText("Tear down / Clean up");
    guards.assertClean();
  });

  test("planning mode shows the full schedule without live NOW", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/day");
    await openPreviewPreset(page, "Planning");
    await expect(page.getByText("Here's how the day is planned.")).toBeVisible();
    expect(await countVisibleTitles(page, WEDDING_TITLES)).toBe(19);
    await expect(page.getByRole("heading", { name: "Now" })).toHaveCount(0);
    guards.assertClean();
  });

  test("Need Someone lists every flagged day-of contact", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/day");
    await expect(page.getByText("Need someone?")).toBeVisible();
    const body = await page.locator("body").innerText();
    for (const name of DAY_OF_CONTACTS) {
      expect(body).toContain(name.split(" · ")[0]!);
    }
    expect(body).toContain("Wendy Rush");
    guards.assertClean();
  });
});
