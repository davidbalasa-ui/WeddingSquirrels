import { expect, test } from "@playwright/test";
import { attachPageGuards, clickPrimaryNav, expectNoSecrets } from "./helpers";

test.describe("core interactions", () => {
  test("People tabs, search, and a profile open", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/people");
    await page.getByRole("link", { name: /Guests/ }).click();
    await expect(page).toHaveURL(/tab=guests/);
    await page.getByRole("link", { name: /Vendors/ }).click();
    await expect(page).toHaveURL(/tab=vendors/);
    await page.getByRole("link", { name: /Day-of/ }).click();
    await expect(page).toHaveURL(/tab=day-of/);
    await expect(page.getByRole("link", { name: /Wendy Rush/ }).first()).toBeVisible();

    await page.getByRole("link", { name: /^All/ }).click();
    await expect(page.getByLabel("Search people")).toBeVisible();
    await page.getByLabel("Search people").fill("Kurt");
    await expect(page.getByRole("link", { name: /Kurt Huizenga/ })).toBeVisible();
    await page.getByRole("link", { name: /Kurt Huizenga/ }).click();
    await expect(page).toHaveURL(/\/people\//);
    await expect(page.getByRole("heading", { name: "Kurt Huizenga" })).toBeVisible();
    await expect(page.getByText("MC", { exact: true }).first()).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/people/);
    guards.assertClean();
  });

  test("Money detail, add-contract cancel, and Plan chapters", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/money");
    await page.getByRole("link", { name: /Photographer/ }).first().click();
    await expect(page).toHaveURL(/\/money\//);
    await expect(page.getByRole("heading", { name: "Photographer" })).toBeVisible();
    await page.goBack();

    await page.getByRole("button", { name: "Add a contract" }).click();
    await expect(page.getByPlaceholder("Vendor or contract")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByPlaceholder("Vendor or contract")).toHaveCount(0);

    await clickPrimaryNav(page, "Plan");
    await page.getByRole("link", { name: /Wedding Day/ }).click();
    await expect(page).toHaveURL(/\/plan\/timeline/);
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("button", { name: "Review" })).toBeVisible();
    await page.getByRole("button", { name: "Review" }).click();

    await page.getByRole("link", { name: "← Plan" }).click();
    await page.getByRole("link", { name: /Rehearsal/ }).click();
    await expect(page).toHaveURL(/\/plan\/rehearsal/);
    await expect(page.getByRole("heading", { name: /Rehearsal/ })).toBeVisible();

    await clickPrimaryNav(page, "More");
    await page.getByRole("link", { name: /Wedding Binder & Print/ }).click();
    await expect(page).toHaveURL(/\/print/);
    await expectNoSecrets(page);
    guards.assertClean();
  });

  test("Day assignments navigation and shopping add/cancel", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/day");
    await page.getByRole("navigation", { name: "Day-of pages" }).getByRole("link", { name: "Assignments" }).click();
    await expect(page).toHaveURL(/\/day\/assignments/);
    await expect(page.getByText("Get 100 lbs of Ice")).toBeVisible();

    await page.goto("/plan/shopping");
    await page.getByRole("button", { name: "Add shopping item" }).click();
    await expect(page.getByText("New item")).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByText("New item")).toHaveCount(0);
    guards.assertClean();
  });
});
