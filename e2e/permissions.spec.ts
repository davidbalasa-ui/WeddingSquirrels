import { expect, test } from "@playwright/test";
import { SECRET_LEAK } from "./expected";
import { attachPageGuards } from "./helpers";

test.describe("permissions and privacy", () => {
  test("restricted PIN cannot open money or day-of, and UI leaks no secrets", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/today");
    await expect(page.locator("body")).not.toContainText("Enter your PIN");

    await page.goto("/money");
    await expect(page).not.toHaveURL(/\/money/);
    await expect(page.locator("nav[aria-label='Primary']").getByRole("link", { name: "Money", exact: true })).toHaveCount(0);

    await page.goto("/day");
    await expect(page).not.toHaveURL(/\/day(?:\/|$)/);

    await page.goto("/print");
    await expect(page).toHaveURL(/\/print/);
    const text = await page.locator("body").innerText();
    expect(SECRET_LEAK.test(text)).toBeFalsy();
    expect(text).not.toMatch(/pinHash/);
    guards.assertClean();
  });
});
