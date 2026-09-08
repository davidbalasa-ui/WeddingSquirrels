import { expect, test } from "@playwright/test";
import { attachPageGuards } from "./helpers";

test.describe("today", () => {
  test("pulse and sections expose working links", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/today");
    await expect(page.locator("h1")).toBeVisible();

    const pulse = page.locator("section").filter({ hasText: /Wedding pulse|Pulse/ }).getByRole("link");
    const pulseCount = await pulse.count();
    expect(pulseCount).toBeGreaterThan(0);
    const firstPulse = pulse.first();
    const href = await firstPulse.getAttribute("href");
    expect(href).toBeTruthy();
    await firstPulse.click();
    await expect(page).not.toHaveURL(/\/today$/);

    await page.goto("/today");
    const coming = page.getByRole("link").filter({ hasText: /.+/ });
    expect(await coming.count()).toBeGreaterThan(3);
    guards.assertClean();
  });

  test("compose Ask / Task / Buy opens and Cancel closes", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/today");
    for (const label of ["Ask", "Task", "Buy"]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByRole("button", { name: "Cancel" })).toHaveCount(0);
    }
    guards.assertClean();
  });

  test("inbox filters change the board", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/today?filter=asks");
    await expect(page.getByText("All items")).toBeVisible();
    await page.getByRole("button", { name: "Tasks", exact: true }).click();
    await expect(page).toHaveURL(/filter=tasks/);
    await page.locator('button[aria-pressed]').filter({ hasText: /^Buy$/ }).click();
    await expect(page).toHaveURL(/filter=buy/);
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(page).toHaveURL(/done=1/);
    guards.assertClean();
  });

  test("task titles open the canonical workspace and back returns to Today", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/today");
    const pulseTasks = page.getByRole("link").filter({ hasText: /Tasks/ }).filter({ hasText: /open/ });
    if (await pulseTasks.count()) {
      const pulseText = (await pulseTasks.first().innerText()).replace(/\s+/g, " ");
      const pulseOpen = pulseText.match(/(\d+)/);
      expect(pulseOpen, `today pulse copy: ${pulseText}`).toBeTruthy();
      expect(Number(pulseOpen![1])).toBeGreaterThanOrEqual(13);
    }

    await page.goto("/today?filter=tasks");
    const stepTitle = page.getByRole("link", { name: "Confirm week-of plans with each other" });
    await expect(stepTitle).toBeVisible();
    await stepTitle.click();
    await expect(page).toHaveURL(/\/work\/.+/);
    await expect(page).toHaveURL(/returnTo=/);
    await expect(page.getByRole("button", { name: "Save decision" })).toBeVisible();
    await page.getByRole("link", { name: /^← Back/ }).click();
    await expect(page).toHaveURL(/\/today/);
    await expect(page).toHaveURL(/filter=tasks/);
    guards.assertClean();
  });
});
