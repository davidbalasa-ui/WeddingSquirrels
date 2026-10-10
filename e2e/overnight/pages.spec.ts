import { expect, test } from "@playwright/test";
import { overnightPrisma, resetOvernightData } from "./db";
import { attachGuards, expectNoSidewaysScroll } from "./helpers";
import { ROUTES } from "./routes";

const prisma = overnightPrisma();
test.beforeAll(async () => resetOvernightData(prisma));
test.afterAll(async () => prisma.$disconnect());


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
      await guards.assertClean();
    });
  }
});
