import { expect, test } from "@playwright/test";
import { ALIAS_ROUTES, AUTH_ROUTES, PRIMARY_NAV } from "./expected";
import { attachPageGuards, clickPrimaryNav, expectHealthy } from "./helpers";

test.describe("routes and navigation", () => {
  test("authenticated routes load without application errors", async ({ page }) => {
    const guards = await attachPageGuards(page);
    for (const route of AUTH_ROUTES) {
      await expectHealthy(page, route.path, route.expect);
      await expect(page).toHaveURL(new RegExp(`${route.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\?|$)`));
    }
    guards.assertClean();
  });

  test("legacy aliases reach current hubs", async ({ page }) => {
    const guards = await attachPageGuards(page);
    for (const route of ALIAS_ROUTES) {
      const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
      expect(response?.status() ?? 0, route.path).toBeLessThan(400);
      await expect(page).toHaveURL(route.expectPath);
      await expect(page.locator("body")).not.toContainText("Enter your PIN");
    }
    guards.assertClean();
  });

  test("skip and logout stay named and reachable", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/today");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
    const unlabeled = await page.locator("#main-content button").evaluateAll((buttons) =>
      buttons
        .filter((el) => {
          const text = (el.textContent || "").trim();
          const name = el.getAttribute("aria-label") || el.getAttribute("title") || "";
          return !text && !name && el.getAttribute("type") !== "submit";
        })
        .map((el) => el.outerHTML.slice(0, 80)),
    );
    expect(unlabeled, `unlabeled buttons: ${unlabeled.join(" | ")}`).toEqual([]);
    guards.assertClean();
  });

  test("primary navigation tabs reach the expected hubs", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/today");
    const destinations: Record<(typeof PRIMARY_NAV)[number], RegExp> = {
      Today: /\/today/,
      Plan: /\/plan(?:\/|$|\?)/,
      People: /\/people/,
      Money: /\/money/,
      More: /\/more/,
    };
    for (const label of PRIMARY_NAV) {
      await clickPrimaryNav(page, label);
      await expect(page).toHaveURL(destinations[label]);
      await expect(page.locator("nav[aria-label='Primary']").getByRole("link", { name: label, exact: true })).toHaveAttribute(
        "aria-current",
        "page",
      );
    }
    guards.assertClean();
  });
});
