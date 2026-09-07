import { expect, test } from "@playwright/test";
import { DISCOVERED_ROUTES } from "./inventory";
import { attachPageGuards } from "./helpers";

const IGNORE = /^(tel:|mailto:|sms:|javascript:|#)/i;

test.describe("inventory crawl", () => {
  test("discovered same-origin links stay inside the inventoried route set", async ({ page }) => {
    const guards = await attachPageGuards(page);
    const seeds = ["/today", "/plan", "/people", "/money", "/more", "/day", "/print"];
    const found = new Set<string>();
    const queue = [...seeds];

    while (queue.length) {
      const path = queue.shift()!;
      if (found.has(path)) continue;
      found.add(path);
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(response?.status() ?? 0, path).toBeLessThan(400);
      const hrefs = await page.locator("a[href]").evaluateAll((links) =>
        links.map((link) => (link as HTMLAnchorElement).getAttribute("href") || ""),
      );
      for (const href of hrefs) {
        if (!href || IGNORE.test(href)) continue;
        let url: URL;
        try {
          url = new URL(href, page.url());
        } catch {
          continue;
        }
        if (url.origin !== new URL(page.url()).origin) continue;
        const next = `${url.pathname}${url.search}`;
        const bare = url.pathname;
        if (!found.has(bare) && !found.has(next) && !queue.includes(bare)) {
          if (
            bare.startsWith("/people/") ||
            bare.startsWith("/money/") ||
            bare.startsWith("/work/")
          ) {
            found.add(bare);
            continue;
          }
          queue.push(bare);
        }
      }
    }

    const inventoried = new Set(
      DISCOVERED_ROUTES.map((route) => route.split("?")[0]!).concat(["/offline", "/no-access"]),
    );
    const unexpected = [...found].filter((path) => {
      if (inventoried.has(path)) return false;
      if (path.startsWith("/people/")) return false;
      if (path.startsWith("/money/")) return false;
      if (path.startsWith("/work/")) return false;
      if (path === "/favicon.ico") return false;
      return true;
    });
    expect(unexpected, `uninventoried routes: ${unexpected.join(", ")}`).toEqual([]);
    guards.assertClean();
  });
});
