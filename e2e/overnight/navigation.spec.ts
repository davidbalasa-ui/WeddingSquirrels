import { expect, test, type Page } from "@playwright/test";
import { overnightPrisma, resetOvernightData } from "./db";
import { attachGuards } from "./helpers";

/**
 * Going back lands where you were, not at the top: the browser's back button,
 * a reload, and the app's own "← Back" links alike.
 */
const prisma = overnightPrisma();
test.beforeAll(async () => resetOvernightData(prisma));
test.afterAll(async () => prisma.$disconnect());

const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));

/** Scrolls a long way down and returns where that landed (the page may be shorter than asked). */
async function scrollDown(page: Page, to = 100_000) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), to);
  await page.waitForTimeout(250);
  const y = await scrollY(page);
  expect(y, "the page is long enough to scroll").toBeGreaterThan(100);
  return y;
}

/** What the app remembered and where the page is, for the message when a position comes back wrong. */
const describeScroll = (page: Page) =>
  page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    return `scrollY=${Math.round(window.scrollY)} height=${root.scrollHeight} viewport=${window.innerHeight} memory=${window.sessionStorage.getItem("ws:navigation") ?? "(none)"}`;
  });

async function expectBackAt(page: Page, path: string, y: number) {
  await expect(page).toHaveURL(new RegExp(`${path.replace(/[?]/g, "\\?")}$`));
  await expect.poll(() => scrollY(page), { timeout: 5000 }).toBeGreaterThan(y - 6);
  expect(await scrollY(page), `back to ${path} at ${y}: ${await describeScroll(page)}`).toBeLessThan(y + 6);
}

test("the app restores scroll positions itself", async ({ page }) => {
  await page.goto("/today");
  await expect.poll(() => page.evaluate(() => window.history.scrollRestoration)).toBe("manual");
});

for (const [from, label] of [
  ["/plan/timeline", "Wedding Day"],
  ["/day", "Day-of"],
  ["/print", "Print Center"],
] as const) {
  test(`${label}: bottom nav to Today, browser back keeps the position`, async ({ page }) => {
    const guards = attachGuards(page);
    await page.goto(from, { waitUntil: "networkidle" });
    const y = await scrollDown(page);
    await page.locator('nav.nav-bar a[href="/today"]').click();
    await expect(page).toHaveURL(/\/today$/);
    await expect.poll(() => scrollY(page)).toBe(0);
    await page.goBack();
    await expectBackAt(page, from, y);
    await guards.assertClean();
  });
}

test("Wedding Day: a reload keeps the position", async ({ page }) => {
  await page.goto("/plan/timeline", { waitUntil: "networkidle" });
  const y = await scrollDown(page, 3000);
  await page.reload({ waitUntil: "networkidle" });
  await expectBackAt(page, "/plan/timeline", y);
});

test("Day-of: open a person from the bottom of the page, browser back keeps the position", async ({ page }) => {
  const guards = attachGuards(page);
  await page.goto("/day", { waitUntil: "networkidle" });
  const link = page.locator('a[href^="/people/"]').last();
  await link.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const y = await scrollY(page);
  expect(y).toBeGreaterThan(100);
  await link.click();
  await expect(page).toHaveURL(/\/people\//);
  await page.goBack();
  await expectBackAt(page, "/day", y);
  await guards.assertClean();
});

test("People: open a day-of contact, '← People' brings the list back as it was", async ({ page }) => {
  const guards = attachGuards(page);
  await page.goto("/people?tab=day-of", { waitUntil: "networkidle" });
  const link = page.locator('a[href^="/people/contact"]').last();
  await link.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const y = await scrollY(page);
  expect(y).toBeGreaterThan(50);
  await link.click();
  await expect(page).toHaveURL(/\/people\/contact/);
  await page.getByRole("link", { name: "← People" }).click();
  // Same tab, same place, not the top of the guest list.
  await expectBackAt(page, "/people?tab=day-of", y);
  await guards.assertClean();
});

test("Plan: open Tasks, '← Plan' returns to the same spot on Plan", async ({ page }) => {
  const guards = attachGuards(page);
  // Plan is short on a tall desktop window since its Stay row went (2026-10-10); a shorter one still scrolls.
  await page.setViewportSize({ width: page.viewportSize()!.width, height: Math.min(page.viewportSize()!.height, 600) });
  await page.goto("/plan", { waitUntil: "networkidle" });
  await scrollDown(page);
  // The Tasks link sits near the top of Plan: scroll so it is on screen a little way
  // down, rather than letting the click scroll it into view after the position is read.
  const link = page.locator('a[href="/plan/tasks"]').first();
  await link.evaluate((el) => window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 60, behavior: "instant" }));
  await page.waitForTimeout(200);
  const y = await scrollY(page);
  expect(y).toBeGreaterThan(50);
  await link.click();
  await expect(page).toHaveURL(/\/plan\/tasks$/);
  await page.getByRole("link", { name: "← Plan" }).click();
  await expectBackAt(page, "/plan", y);
  await guards.assertClean();
});

test("Tasks: open a task, '← Back to Tasks' returns to the same spot in the list", async ({ page }) => {
  const guards = attachGuards(page);
  await page.goto("/plan/tasks", { waitUntil: "networkidle" });
  // The list scrolls only a little on a tall desktop window; any real offset will do.
  await page.evaluate(() => window.scrollTo({ top: 100_000, behavior: "instant" }));
  await page.waitForTimeout(250);
  const y = await scrollY(page);
  expect(y, "the task list scrolls").toBeGreaterThan(10);
  // Tap a task that sits clear of the top bar and the fixed bottom nav. A link tucked
  // under the nav makes the tap scroll the list again first (on the iPhone viewport the
  // last link lands there), and the app then rightly remembers that new spot, not `y`.
  const links = page.locator('a[href^="/work/"]');
  const index = await links.evaluateAll((els) =>
    els.findIndex((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 80 && r.bottom <= window.innerHeight - 120;
    }),
  );
  expect(index, "a task link is on screen clear of the bars").toBeGreaterThanOrEqual(0);
  await links.nth(index).click();
  await expect(page).toHaveURL(/\/work\//);
  await page.getByRole("link", { name: /← Back/ }).click();
  await expectBackAt(page, "/plan/tasks", y);
  await guards.assertClean();
});

test("'← Plan' opened fresh (no history) still goes to Plan", async ({ page }) => {
  await page.goto("/plan/calendar", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "← Plan" }).click();
  await expect(page).toHaveURL(/\/plan$/);
});

test("a tap on a far-away link lands at the top of the new page", async ({ page }) => {
  await page.goto("/plan/timeline", { waitUntil: "networkidle" });
  await scrollDown(page);
  await page.locator('nav.nav-bar a[href^="/people"]').click();
  await expect(page).toHaveURL(/\/people/);
  await expect.poll(() => scrollY(page)).toBe(0);
});
