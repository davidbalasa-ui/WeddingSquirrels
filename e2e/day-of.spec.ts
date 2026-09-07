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
    const fullDay = page.getByText("View full day");
    if (await fullDay.count()) {
      await fullDay.click();
      await expect(main).toContainText("Tear down / Clean up");
    }
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
    const call = page.locator('#main-content a[href^="tel:"]').first();
    if (await call.count()) {
      expect(await call.getAttribute("href")).toMatch(/^tel:/);
    }
    const mail = page.locator('#main-content a[href^="mailto:"]');
    if (await mail.count()) {
      expect(await mail.first().getAttribute("href")).toMatch(/^mailto:/);
    }
    const body = await page.locator("body").innerText();
    for (const name of DAY_OF_CONTACTS) {
      expect(body).toContain(name.split(" · ")[0]!);
    }
    expect(body).toContain("Wendy Rush");
    guards.assertClean();
  });

  test("day tabs, edit-timeline link, and preview harness extras", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/day");
    await page.getByRole("navigation", { name: "Day-of pages" }).getByRole("link", { name: "Contacts" }).click();
    await expect(page).toHaveURL(/tab=day-of/);
    await page.goto("/day");
    await page.getByRole("navigation", { name: "Day-of pages" }).getByRole("link", { name: "Assignments" }).click();
    await expect(page).toHaveURL(/\/day\/assignments/);
    await page.getByRole("navigation", { name: "Day-of pages" }).getByRole("link", { name: "Day", exact: true }).click();
    await expect(page).toHaveURL(/\/day/);
    await page.getByRole("link", { name: "Edit timeline in Plan" }).click();
    await expect(page).toHaveURL(/\/plan\/timeline/);

    await page.goto("/day");
    const details = page.locator("details.preview-time-control");
    await expect(details).toBeVisible();
    const isOpen = await details.evaluate((el) => (el as HTMLDetailsElement).open);
    if (!isOpen) await details.locator("summary").click();
    await details.locator("#preview-time-custom").fill("2026-10-16T15:35");
    await details.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/asOf=/);
    const detailsAfter = page.locator("details.preview-time-control");
    const openAfter = await detailsAfter.evaluate((el) => (el as HTMLDetailsElement).open);
    if (!openAfter) await detailsAfter.locator("summary").click();
    await detailsAfter.getByText(/19-row sample timeline/).click();
    await expect(page).toHaveURL(/fixture=/);
    await detailsAfter.getByRole("button", { name: "Clear preview" }).click();
    guards.assertClean();
  });
});
