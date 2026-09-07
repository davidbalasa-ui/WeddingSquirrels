import { expect, test } from "@playwright/test";
import { MONEY, REHEARSAL_TITLES, WEDDING_TITLES } from "./expected";
import { attachPageGuards, countVisibleTitles, expectNoSecrets } from "./helpers";

test.describe("print center", () => {
  test("Full Binder and Day-of Packet presets, toggles, data, and print", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/print");
    await expect(page.getByTestId("print-preset-binder")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-print-section="money"]')).toBeChecked();
    await expect(page.locator('[data-print-section="guests"]')).toBeChecked();
    await expect(page.locator('[data-print-section="setup"]')).not.toBeChecked();

    const binder = page.locator(".binder-doc");
    expect(await countVisibleTitles(page, WEDDING_TITLES)).toBe(19);
    expect(await countVisibleTitles(page, REHEARSAL_TITLES)).toBe(7);
    await expect(binder).toContainText("Kurt Huizenga");
    await expect(binder).toContainText("3:25");
    await expect(binder).toContainText("Wendy Rush");
    await expect(binder).toContainText("UNASSIGNED");
    await expect(binder).toContainText(MONEY.committed);
    await expect(binder).toContainText(MONEY.paid);
    await expect(binder).toContainText(MONEY.remaining);
    await expect(binder).not.toContainText("Wendy Rush · MC");

    await page.getByTestId("print-preset-packet").click();
    await expect(page.getByTestId("print-preset-packet")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-print-section="money"]')).not.toBeChecked();
    await expect(page.locator('[data-print-section="guests"]')).not.toBeChecked();
    await expect(page.locator('[data-print-section="setup"]')).toBeChecked();
    await expect(page.locator('[data-print-section="timeline"]')).toBeChecked();
    await expect(page.locator('[data-print-section="mc"]')).toBeChecked();
    await expect(binder).toContainText("Wedding Day Packet");
    await expect(binder).not.toContainText(MONEY.committed);
    await expect(binder).not.toContainText("Guests / households");

    await page.locator('[data-print-section="money"]').check();
    await expect(binder).toContainText(MONEY.committed);
    await page.locator('[data-print-section="money"]').uncheck();

    await page.evaluate(() => {
      (window as Window & { __printCalls?: number }).__printCalls = 0;
      window.print = () => {
        const store = window as Window & { __printCalls?: number };
        store.__printCalls = (store.__printCalls ?? 0) + 1;
      };
    });
    await page.getByTestId("print-save-pdf").click();
    expect(await page.evaluate(() => (window as Window & { __printCalls?: number }).__printCalls)).toBe(1);

    await page.emulateMedia({ media: "print" });
    const chromeHidden = await page.locator(".print-hide").evaluateAll((els) =>
      els.every((el) => getComputedStyle(el).display === "none"),
    );
    expect(chromeHidden, "print-hide chrome is display:none").toBe(true);
    await expect(page.locator(".nav-bar")).toBeHidden();
    await expect(binder).toBeVisible();
    await expect(binder).toContainText("David & Haley");
    await expectNoSecrets(page);
    guards.assertClean();
  });
});
