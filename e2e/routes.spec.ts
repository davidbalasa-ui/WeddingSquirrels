import { expect, test } from "@playwright/test";
import { AUTH_ROUTES, PRIMARY_NAV } from "./expected";
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
