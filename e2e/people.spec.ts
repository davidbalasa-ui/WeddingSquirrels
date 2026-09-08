import { expect, test } from "@playwright/test";
import { attachPageGuards } from "./helpers";

test.describe("people", () => {
  test("tabs and search", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/people");
    await page.getByRole("link", { name: /Guests/ }).click();
    await expect(page).toHaveURL(/tab=guests/);
    await page.getByRole("link", { name: /Vendors/ }).click();
    await expect(page).toHaveURL(/tab=vendors/);
    await page.getByRole("link", { name: /Day-of/ }).click();
    await expect(page).toHaveURL(/tab=day-of/);
    await page.getByRole("link", { name: /^All/ }).click();
    await page.getByLabel("Search people").fill("Kurt");
    await expect(page.getByRole("link", { name: /Kurt Huizenga/ })).toBeVisible();
    guards.assertClean();
  });

  test("identity grouping and Day-of roster", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/people");
    await page.getByLabel("Search people").fill("Kurt Huizenga");
    expect(await page.getByRole("link", { name: /Kurt Huizenga/ }).count()).toBe(1);

    await page.goto("/people?tab=day-of");
    await expect(page.getByRole("link", { name: /Wendy Rush/ }).first()).toBeVisible();
    const body = await page.locator("#main-content").innerText();
    expect(body).toContain("Wendy Rush");
    expect(body).not.toMatch(/Kurt Huizenga/);
    guards.assertClean();
  });

  test("profiles, channels, and back", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/people");
    await page.getByLabel("Search people").fill("Kurt");
    await page.getByRole("link", { name: /Kurt Huizenga/ }).click();
    await expect(page.getByRole("heading", { name: "Kurt Huizenga" })).toBeVisible();
    await expect(page.getByText("MC", { exact: true }).first()).toBeVisible();
    const kurtTel = page.locator('#main-content a[href^="tel:"], #main-content a[href^="sms:"]');
    expect(await kurtTel.count(), "Kurt is not a fabricated Contact channel").toBe(0);

    await page.getByRole("link", { name: "← People" }).click();
    await expect(page).toHaveURL(/\/people/);

    await page.getByLabel("Search people").fill("Wendy");
    await page.getByRole("link", { name: /Wendy Rush/ }).click();
    await expect(page.getByRole("heading", { name: "Wendy Rush" })).toBeVisible();
    await expect(page.getByText("MC", { exact: true })).toHaveCount(0);
    const wendyMail = page.locator('#main-content a[href^="mailto:"], #main-content a[href^="tel:"]');
    if (await wendyMail.count()) {
      const href = await wendyMail.first().getAttribute("href");
      expect(href).toMatch(/^(tel:|mailto:|sms:)/);
    }
    guards.assertClean();
  });

  test("role editor Cancel leaves MC unchanged", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/people");
    await page.getByLabel("Search people").fill("Kurt");
    await page.getByRole("link", { name: /Kurt Huizenga/ }).first().click();
    await expect(page.getByRole("heading", { name: "Kurt Huizenga" })).toBeVisible();
    await page.locator("summary").filter({ hasText: /^Edit / }).click();
    const editor = page.getByRole("button", { name: "Edit role" });
    await expect(editor).toBeVisible();
    await editor.click();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("MC", { exact: true }).first()).toBeVisible();
    guards.assertClean();
  });

  test("guests filters and manage list", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/people?tab=guests");
    await page.getByRole("link", { name: "No reply", exact: true }).click();
    await expect(page).toHaveURL(/rsvp=pending/);
    await page.getByRole("link", { name: "Accepted", exact: true }).click();
    await expect(page).toHaveURL(/rsvp=attending/);
    await page.getByRole("link", { name: /Manage guest list/ }).click();
    await expect(page).toHaveURL(/manage=1/);
    await expect(page.getByLabel("Search guests")).toBeVisible();
    await page.getByRole("link", { name: /Print gift list/ }).click();
    await expect(page).toHaveURL(/\/guests\/print/);
    guards.assertClean();
  });

  test("day-of contacts accordion and subpages", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/people?tab=day-of");
    const accordion = page.getByText("Add or edit day-of contacts");
    if (await accordion.count()) {
      await accordion.click();
      await expect(page.getByRole("button", { name: "Add day-of contact" })).toBeVisible();
    }
    await page.goto("/people/vendors");
    await expect(page.getByLabel(/Search/)).toBeVisible();
    await page.goto("/people/party");
    await expect(page.getByLabel(/Search/)).toBeVisible();
    await page.goto("/people/family");
    await expect(page.getByLabel(/Search/)).toBeVisible();
    guards.assertClean();
  });

  test("David open work titles open the task workspace and back returns", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/people/person:david");
    await expect(page.getByRole("heading", { name: /David/ }).first()).toBeVisible();
    const openWork = page.locator("section").filter({ hasText: "Open work" });
    await expect(openWork).toBeVisible();
    await expect(openWork.getByText(/workspace/)).toBeVisible();
    await expect(openWork.getByText(/open step/)).toBeVisible();
    const firstWork = openWork.getByRole("link").first();
    await expect(firstWork).toBeVisible();
    await firstWork.click();
    await expect(page).toHaveURL(/\/work\//);
    await expect(page.getByRole("button", { name: "Save decision" })).toBeVisible();
    await page.getByRole("link", { name: /^← Back/ }).click();
    await expect(page).toHaveURL(/\/people\/person:david|\/people\/person%3Adavid/);
    guards.assertClean();
  });
});
