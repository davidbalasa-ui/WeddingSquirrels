import { expect, test } from "@playwright/test";
import { PRIMARY_NAV } from "./expected";
import { attachPageGuards, clickPrimaryNav } from "./helpers";

test.describe("mobile smoke", () => {
  test("critical hubs, navigation, and print controls stay usable", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/today");
    await expect(page.locator("h1")).toBeVisible();

    await clickPrimaryNav(page, "Plan");
    await expect(page).toHaveURL(/\/plan/);

    await clickPrimaryNav(page, "People");
    await expect(page.getByLabel("Search people")).toBeVisible();

    await page.goto("/day");
    await expect(page.getByText("Need someone?")).toBeVisible();

    await page.goto("/print");
    await expect(page.getByTestId("print-preset-packet")).toBeVisible();
    await page.getByTestId("print-preset-packet").click();
    await expect(page.getByTestId("print-preset-packet")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("print-save-pdf")).toBeVisible();

    for (const label of PRIMARY_NAV) {
      await expect(page.locator("nav[aria-label='Primary']").getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    guards.assertClean();
  });
});
