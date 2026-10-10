import { expect, test, type Locator, type Page } from "@playwright/test";
import { overnightPrisma } from "./db";
import { attachGuards, expectNoSidewaysScroll } from "./helpers";

/**
 * Read-across of the task-step fix (David, 2026-10-10): note boxes on other screens grow
 * with their text instead of scrolling inside a small box, and the photo/decor/hair lists
 * keep Edit and Mark done under each item so the text uses the full width. Runs on the
 * local test copy; nothing here is saved except where the test puts it back.
 */
const prisma = overnightPrisma();
test.afterAll(async () => prisma.$disconnect());

const LONG = ["Line one", "Line two", "Line three", "Line four", "Line five", "A sixth line long enough to wrap on a phone screen"].join("\n");

async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    const button = document.querySelector("main button, form button");
    return Boolean(button && Object.keys(button).some((key) => key.startsWith("__reactFiber")));
  });
}

/** Types several lines and checks the box shows them all: it got taller and nothing scrolls inside it. */
async function expectGrows(box: Locator) {
  const before = (await box.boundingBox())!.height;
  await box.fill(LONG);
  const after = await box.evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
  expect(after.scroll, "the note scrolls inside its box").toBeLessThanOrEqual(after.client + 1);
  expect((await box.boundingBox())!.height).toBeGreaterThan(before);
}

test("shot list: Edit and Mark done sit under the item, and the notes box grows", async ({ page }) => {
  const guards = attachGuards(page);
  await page.goto("/day/shots");
  await waitForHydration(page);
  const row = page.locator("li").filter({ has: page.getByText("Invitations", { exact: true }) }).first();
  const title = (await row.getByText("Invitations", { exact: true }).boundingBox())!;
  const edit = (await row.getByRole("button", { name: "Edit", exact: true }).boundingBox())!;
  expect(edit.y, "Edit is below the title, not beside it").toBeGreaterThanOrEqual(title.y + title.height - 1);
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  const form = row.locator("form");
  // The editor spans the row instead of a narrow column next to the buttons.
  expect((await form.boundingBox())!.width).toBeGreaterThan((await row.boundingBox())!.width * 0.9);
  await expectGrows(form.locator("[name=notes]"));
  await form.getByRole("button", { name: "Cancel" }).click();
  await expectNoSidewaysScroll(page);
  guards.assertClean();
});

test("shopping: the note box grows while adding an item", async ({ page }) => {
  const guards = attachGuards(page);
  await page.goto("/plan/shopping");
  await waitForHydration(page);
  await page.getByRole("button", { name: "Add shopping item" }).click();
  await expectGrows(page.locator('textarea[name="note"]'));
  guards.assertClean();
});

test("assignments: the notes box grows", async ({ page }) => {
  const guards = attachGuards(page);
  await page.goto("/day/assignments");
  await waitForHydration(page);
  await page.getByRole("button", { name: "Add assignment" }).first().click();
  await expectGrows(page.locator('textarea[name="notes"]').first());
  guards.assertClean();
});

test("money: a contract's notes box shows saved notes in full", async ({ page }) => {
  const guards = attachGuards(page);
  const item = await prisma.budgetItem.create({ data: { name: "Sweep notes contract", price: 100, note: LONG } });
  try {
    await page.goto(`/money/${item.id}`);
    await waitForHydration(page);
    await page.getByRole("button", { name: "Edit contract" }).click();
    const box = page.locator('textarea[name="note"]').first();
    await expect(box).toHaveValue(LONG);
    const size = await box.evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
    expect(size.scroll, "the saved note scrolls inside its box").toBeLessThanOrEqual(size.client + 1);
    await expectNoSidewaysScroll(page);
  } finally {
    await prisma.budgetItem.delete({ where: { id: item.id } });
  }
  guards.assertClean();
});
