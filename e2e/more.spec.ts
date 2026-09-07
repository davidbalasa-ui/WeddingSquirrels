import { expect, test } from "@playwright/test";
import { attachPageGuards, expectNoSecrets } from "./helpers";

test.describe("more", () => {
  test("cards reach print, offline, and accounts", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/more");
    await expect(page.getByRole("link", { name: /Wedding Binder & Print/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open offline copy" })).toBeVisible();
    await page.getByRole("link", { name: "Accounts" }).first().click();
    await expect(page).toHaveURL(/\/accounts/);
    await expect(page.getByRole("button", { name: "Add account" })).toBeVisible();
    await expectNoSecrets(page);
    guards.assertClean();
  });

  test("accounts dialogs open and close without writing", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/accounts");
    await page.getByRole("button", { name: "Add account" }).click();
    await expect(page.getByRole("button", { name: /Close|Cancel/ }).first()).toBeVisible();
    await page.getByRole("button", { name: /Close/ }).first().click();
    await expect(page.getByRole("button", { name: "Add account" })).toBeVisible();

    const preview = page.getByRole("button", { name: "Preview" }).first();
    await preview.click();
    await expect(page.getByRole("button", { name: /Close/ }).first()).toBeVisible();
    await page.getByRole("button", { name: /Close/ }).first().click();

    const edit = page.getByRole("button", { name: "Edit" }).first();
    await edit.click();
    await page.getByRole("button", { name: /Close/ }).first().click();
    await expect(page.getByRole("button", { name: "Add account" })).toBeVisible();
    guards.assertClean();
  });
});
