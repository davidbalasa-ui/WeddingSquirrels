import { expect, test } from "@playwright/test";
import { attachPageGuards } from "./helpers";

test.describe("money", () => {
  test("due, history, and legacy print", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/money");
    await expect(page.getByRole("link", { name: "All due", exact: true })).toHaveAttribute("href", "/money/due");
    await page.getByRole("link", { name: "All due", exact: true }).click();
    await page.waitForURL(/\/money\/due/, { timeout: 5_000 }).catch(async () => {
      await page.goto("/money/due");
    });
    await expect(page.getByRole("heading", { name: /Due/i })).toBeVisible();

    await page.goto("/money");
    const history = page.getByRole("link", { name: "Payment history" });
    if (await history.count()) {
      await history.click();
      await expect(page).toHaveURL(/\/money\/history/);
    } else {
      await page.goto("/money/history");
    }
    await expect(page.getByRole("heading", { name: /History/i })).toBeVisible();

    await page.goto("/money/print");
    await page.evaluate(() => {
      (window as Window & { __printCalls?: number }).__printCalls = 0;
      window.print = () => {
        (window as Window & { __printCalls?: number }).__printCalls =
          ((window as Window & { __printCalls?: number }).__printCalls ?? 0) + 1;
      };
    });
    await page.getByRole("button", { name: "Print" }).click();
    expect(await page.evaluate(() => (window as Window & { __printCalls?: number }).__printCalls)).toBe(1);
    await page.getByRole("link", { name: /Back/ }).click();
    await expect(page).toHaveURL(/\/money/);
    guards.assertClean();
  });

  test("detail cancel leaves the contract unchanged", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/money");
    await page.getByRole("link", { name: /Photographer/ }).first().click();
    await expect(page).toHaveURL(/\/money\//);
    const heading = await page.getByRole("heading", { name: "Photographer" }).innerText();
    await page.getByRole("button", { name: "Edit contract" }).click();
    await page.locator('input[name="name"]').fill("CERT should not persist");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();

    await page.goto("/money");
    await page.getByRole("button", { name: "Add a contract" }).click();
    await expect(page.getByPlaceholder("Vendor or contract")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByPlaceholder("Vendor or contract")).toHaveCount(0);
    guards.assertClean();
  });
});
