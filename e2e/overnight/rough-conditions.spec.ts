import { expect, test, type Page, type Route } from "@playwright/test";
import { overnightPrisma, resetOvernightData } from "./db";
import { attachGuards, blockByTitle, editCard, expectAllSaved, openTimelineEditor, reviewRow } from "./helpers";

/**
 * The editor under rough conditions: a connection that drops and comes back, a slow
 * connection while someone keeps typing, and the same moment open in two tabs.
 * Saves go out as POSTs to the page's own URL (server actions), so the network is
 * shaped per request.
 */
const prisma = overnightPrisma();

// These checks shape the network with page.route, which cannot see requests that a
// service worker handles in WebKit and Firefox, so the worker stays out of these pages.
test.use({ serviceWorkers: "block" });

test.beforeAll(async () => {
  await resetOvernightData(prisma);
});
test.afterAll(async () => prisma.$disconnect());

const isSave = (route: Route) => route.request().method() === "POST";

/** Like expectAllSaved, without waiting for the network to go idle: an aborted request can keep the offline pack refreshing in the background. */
async function expectSaved(page: Page) {
  await expect(page.getByText("Saving…")).toHaveCount(0, { timeout: 15_000 });
  await page.waitForTimeout(500);
  await expect(page.getByText("Saving…")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByText(/Couldn’t save/)).toHaveCount(0);
}

async function appendNotes(page: Page, blockId: string, text: string) {
  const card = editCard(page, blockId);
  await card.scrollIntoViewIfNeeded();
  const notes = card.locator("textarea");
  await notes.click();
  await notes.press("Control+End");
  await notes.pressSequentially(text, { delay: 15 });
  return notes;
}

test.describe("Wedding Day editor under rough conditions", () => {
  test("typing continues while the connection is down; when it returns, everything typed is saved without a retry tap", async ({ page }) => {
    const guards = attachGuards(page);
    const block = await blockByTitle(prisma, "Ceremony");
    await openTimelineEditor(page);

    let online = false;
    await page.route("**/plan/timeline", (route) => (isSave(route) && !online ? route.abort("connectionfailed") : route.continue()));

    const notes = await appendNotes(page, block.id, "\nRough check: typed while the connection was down");
    const card = editCard(page, block.id);
    await expect(card.getByText(/Couldn’t save — tap to retry/)).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "saving" })).toContainText(/aren’t saving/);

    // The connection comes back and the person just keeps typing.
    online = true;
    await notes.pressSequentially(", then more once it was back", { delay: 15 });
    await notes.blur();
    await expectSaved(page);
    await expect(card.getByText(/Couldn’t save/)).toHaveCount(0);
    await expect(page.getByRole("alert").filter({ hasText: "saving" })).toHaveCount(0);

    const saved = await prisma.timelineBlock.findUnique({ where: { id: block.id } });
    expect(saved?.notes).toBe(`${block.notes}\nRough check: typed while the connection was down, then more once it was back`);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(reviewRow(page, block.id)).toContainText("then more once it was back");
    await guards.assertClean();
  });

  test("a slow connection while typing never puts older text back and ends with everything typed saved", async ({ page }) => {
    const guards = attachGuards(page);
    const block = await blockByTitle(prisma, "Cake cutting");
    await openTimelineEditor(page);

    // Every save takes 2.5 seconds; the person types through two of them.
    let saves = 0;
    await page.route("**/plan/timeline", async (route) => {
      if (!isSave(route)) return route.continue();
      saves += 1;
      await new Promise((resolve) => setTimeout(resolve, 2500));
      return route.continue();
    });

    const notes = await appendNotes(page, block.id, "\nRough check: slow one");
    await page.waitForTimeout(700); // the first save is now in flight
    await notes.pressSequentially(", slow two", { delay: 15 });
    await page.waitForTimeout(700); // a second save is queued behind it
    await notes.pressSequentially(", slow three", { delay: 15 });
    const typed = `${block.notes}\nRough check: slow one, slow two, slow three`;
    await expect(notes).toHaveValue(typed);

    // While the first answer arrives, the text on screen must stay what was typed.
    await page.waitForTimeout(3000);
    await expect(notes).toHaveValue(typed);
    await notes.blur();
    await expect(page.getByText("Saving…")).toHaveCount(0, { timeout: 20_000 });
    await page.waitForTimeout(500);
    await expect(page.getByText("Saving…")).toHaveCount(0, { timeout: 20_000 });
    await expect(notes).toHaveValue(typed);
    expect(saves).toBeGreaterThanOrEqual(2);

    const saved = await prisma.timelineBlock.findUnique({ where: { id: block.id } });
    expect(saved?.notes).toBe(typed);
    await guards.assertClean();
  });

  test("two tabs editing different moments both save", async ({ context }) => {
    const first = await context.newPage();
    const second = await context.newPage();
    const guardsA = attachGuards(first);
    const guardsB = attachGuards(second);
    const blockA = await blockByTitle(prisma, "Toasts + Cake cutting");
    const blockB = await blockByTitle(prisma, "First dances");
    await openTimelineEditor(first);
    await openTimelineEditor(second);

    const notesA = await appendNotes(first, blockA.id, "\nRough check: tab one");
    const notesB = await appendNotes(second, blockB.id, "\nRough check: tab two");
    await notesA.blur();
    await notesB.blur();
    await expectAllSaved(first);
    await expectAllSaved(second);

    const savedA = await prisma.timelineBlock.findUnique({ where: { id: blockA.id } });
    const savedB = await prisma.timelineBlock.findUnique({ where: { id: blockB.id } });
    expect(savedA?.notes).toBe(`${blockA.notes}\nRough check: tab one`);
    expect(savedB?.notes).toBe(`${blockB.notes}\nRough check: tab two`);

    // Each tab shows the other's edit after a reload.
    await first.reload({ waitUntil: "domcontentloaded" });
    await expect(reviewRow(first, blockB.id)).toContainText("Rough check: tab two");
    await second.reload({ waitUntil: "domcontentloaded" });
    await expect(reviewRow(second, blockA.id)).toContainText("Rough check: tab one");
    await guardsA.assertClean();
    await guardsB.assertClean();
    await first.close();
    await second.close();
  });

  test("two tabs editing the same moment: the second tab's save keeps the first tab's line", async ({ context }) => {
    // Known today (2026-10-10): a save sends the whole moment, so a tab that has not seen
    // the other tab's line writes it away. Waits on David's call on how a stale tab
    // should behave; this check flips to a failure once it is fixed, so it is removed then.
    test.fail(true, "a stale tab's save overwrites the other tab's edit; awaiting David's decision");
    const first = await context.newPage();
    const second = await context.newPage();
    const guardsA = attachGuards(first);
    const guardsB = attachGuards(second);
    const block = await blockByTitle(prisma, "Dinner begins");
    await openTimelineEditor(first);
    await openTimelineEditor(second);

    // Tab one adds a line and it is saved.
    const notesA = await appendNotes(first, block.id, "\nRough check: added in tab one");
    await notesA.blur();
    await expectAllSaved(first);
    expect((await prisma.timelineBlock.findUnique({ where: { id: block.id } }))?.notes).toContain("added in tab one");

    // Tab two, still showing the old text, changes the location.
    const cardB = editCard(second, block.id);
    await cardB.scrollIntoViewIfNeeded();
    const location = cardB.getByPlaceholder("Where this happens");
    await location.click();
    await location.fill("Rough check: head table");
    await location.blur();
    await expectAllSaved(second);

    const saved = await prisma.timelineBlock.findUnique({ where: { id: block.id } });
    expect(saved?.notes, "tab two's location edit must not throw away tab one's line").toContain("added in tab one");
    expect(saved?.notes).toContain("Rough check: head table");

    await guardsA.assertClean();
    await guardsB.assertClean();
    await first.close();
    await second.close();
  });
});
