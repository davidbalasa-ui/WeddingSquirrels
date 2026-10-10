import { expect, test } from "@playwright/test";
import { overnightPrisma, resetOvernightData } from "./db";
import { attachGuards, expectNoSidewaysScroll } from "./helpers";

const prisma = overnightPrisma();
test.beforeAll(async () => resetOvernightData(prisma));
test.afterAll(async () => prisma.$disconnect());

const ROUTES: Array<{ path: string; expect: RegExp }> = [
  { path: "/today", expect: /David & Haley|Today/i },
  { path: "/day", expect: /Wedding day|planned|Today/i },
  { path: "/day?asOf=2026-10-16T15:35", expect: /Ceremony/i },
  { path: "/day/mc", expect: /MC Run of Show/i },
  { path: "/day/assignments", expect: /Assignments|jobs/i },
  { path: "/day/contacts", expect: /Contacts/i },
  { path: "/day/hair-makeup", expect: /Hair/i },
  { path: "/day/shots", expect: /Shot/i },
  { path: "/day/decor", expect: /Decor/i },
  { path: "/plan", expect: /Everything|Plan/i },
  { path: "/plan/timeline", expect: /Wedding Day/i },
  { path: "/plan/timeline?edit=1", expect: /Add moment/i },
  { path: "/plan/rehearsal", expect: /Rehearsal/i },
  { path: "/people", expect: /People|wedding happen/i },
  { path: "/print", expect: /Wedding Binder & Print/i },
  { path: "/more", expect: /More|Offline/i },
];

test.describe("every page opens without errors and without sideways scrolling", () => {
  for (const route of ROUTES) {
    test(route.path, async ({ page }) => {
      const guards = attachGuards(page);
      const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
      expect(response?.status() ?? 0, `${route.path} status`).toBeLessThan(400);
      await expect(page.locator("body")).not.toContainText("Enter your PIN");
      await expect(page.locator("body")).toContainText(route.expect);
      await expect(page.locator("body")).not.toContainText(/Something went wrong|Application error/);
      await page.waitForLoadState("networkidle").catch(() => undefined);
      await expectNoSidewaysScroll(page);
      guards.assertClean();
    });
  }
});
