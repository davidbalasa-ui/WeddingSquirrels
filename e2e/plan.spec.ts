import { expect, test } from "@playwright/test";
import { REHEARSAL_TITLES, SHOPPING_ITEMS, WEDDING_TITLES } from "./expected";
import { attachPageGuards, countVisibleTitles } from "./helpers";

test.describe("plan", () => {
  test("hub chapters reach every exposed domain", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/plan");
    const expected = ["Tasks", "Wedding Day", "Rehearsal", "Stay", "Shopping", "Calendar"];
    for (const label of expected) {
      await expect(page.getByRole("navigation", { name: "Wedding plan" }).getByRole("link", { name: new RegExp(label) })).toBeVisible();
    }
    await page.getByRole("navigation", { name: "Wedding plan" }).getByRole("link", { name: /Tasks/ }).click();
    await expect(page).toHaveURL(/\/plan\/tasks/);
    guards.assertClean();
  });

  test("tasks filters and workspace open", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/plan/tasks");
    for (const label of ["Overdue", "Soon", "Mine", "Finished"]) {
      await page.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(label === "Finished" ? /view=done/ : new RegExp(`view=${label.toLowerCase()}`));
    }
    await page.getByRole("link", { name: "Open", exact: true }).click();
    const firstTask = page.locator("article a").first();
    await expect(firstTask).toBeVisible();
    await firstTask.click();
    await expect(page).toHaveURL(/\/work\//);
    await expect(page.getByRole("button", { name: "Save decision" })).toBeVisible();
    await page.getByRole("link", { name: /^← Back/ }).click();
    await expect(page).toHaveURL(/\/plan\/tasks/);
    guards.assertClean();
  });

  test("task home count, empty copy, and mine filter keep wedding-week work", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/plan");
    const hubTasks = page.getByRole("navigation", { name: "Wedding plan" }).getByRole("link", { name: /Tasks/ });
    const hubText = (await hubTasks.innerText()).replace(/\s+/g, " ");
    const hubOpen = hubText.match(/(\d+)\s+open/);
    expect(hubOpen, `plan hub tasks copy: ${hubText}`).toBeTruthy();
    const openCount = Number(hubOpen![1]);
    expect(openCount).toBeGreaterThanOrEqual(13);

    await hubTasks.click();
    await expect(page).toHaveURL(/\/plan\/tasks/);
    await expect(page.getByRole("button", { name: "Add Task" })).toBeVisible();
    const tasksBody = await page.locator("#main-content").innerText();
    expect(tasksBody).toMatch(new RegExp(`${openCount} open`));
    expect(tasksBody).toMatch(/wedding week/i);
    expect(tasksBody).toContain("Week before");
    expect(tasksBody).toMatch(/No decision tasks yet/);
    expect(tasksBody).not.toMatch(/Everything is done/);

    await page.getByRole("link", { name: "Mine", exact: true }).click();
    await expect(page).toHaveURL(/view=mine/);
    const mineBody = await page.locator("#main-content").innerText();
    expect(mineBody).not.toMatch(/Everything is done/);
    expect(mineBody).toMatch(/Assigned to you|No decision tasks assigned to you/);

    await page.getByRole("link", { name: "Soon", exact: true }).click();
    await expect(page).toHaveURL(/view=soon/);
    const soonBody = await page.locator("#main-content").innerText();
    expect(soonBody).not.toMatch(/Everything is done/);
    expect(soonBody).toMatch(/Due this week|No decision tasks due this week|Week before/);
    guards.assertClean();
  });

  test("timeline review/edit and 19 rows", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/plan/timeline");
    expect(await countVisibleTitles(page, WEDDING_TITLES)).toBe(19);
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("button", { name: "+ Add moment" })).toBeVisible();
    await page.getByRole("button", { name: "Review" }).click();
    guards.assertClean();
  });

  test("rehearsal rows and empty dinner", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/plan/rehearsal");
    expect(await countVisibleTitles(page, REHEARSAL_TITLES)).toBe(7);
    const main = await page.locator("#main-content").innerText();
    expect(main).toMatch(/4:15[\s\S]*6:00/);
    await expect(page.getByRole("button", { name: "Hidden from guests" })).toBeVisible();
    await expect(page.getByText("No courses yet").first()).toBeVisible();
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("button", { name: "+ Add moment" })).toBeVisible();
    guards.assertClean();
  });

  test("stay slots render", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/plan/stay");
    await expect(page.getByText(/Tap a name to claim a bed/)).toBeVisible();
    expect(await page.locator("#main-content input").count()).toBeGreaterThan(0);
    guards.assertClean();
  });

  test("shopping list, filters, and production items", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/plan/shopping");
    const body = await page.locator("#main-content").innerText();
    for (const item of SHOPPING_ITEMS) expect(body).toContain(item);
    await page.getByRole("link", { name: "David items" }).click();
    await expect(page).toHaveURL(/who=david/);
    await page.getByRole("link", { name: "All", exact: true }).click();
    await page.getByRole("button", { name: /Show purchased|Hide purchased/ }).click();
    guards.assertClean();
  });

  test("calendar month navigation and events", async ({ page }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/plan/calendar");
    await expect(page.getByRole("heading", { name: /2026|2025|2027/ })).toBeVisible();
    for (let i = 0; i < 8; i++) {
      const dotted = page.locator("#main-content button").filter({ has: page.locator("span[title]") });
      if (await dotted.count()) {
        await dotted.first().click();
        break;
      }
      await page.getByRole("button", { name: "Next month" }).click();
    }
    await expect(page.locator("#main-content article").first()).toBeVisible();
    await expect(page.locator("#main-content article").first()).toContainText(/Bachelorette|Bachelor|Wedding/i);
    guards.assertClean();
  });
});
