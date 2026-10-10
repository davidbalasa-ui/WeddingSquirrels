import { expect, test, type Page } from "@playwright/test";
import { overnightPrisma } from "./db";
import { attachGuards } from "./helpers";

/**
 * After a save, the page must show the saved state right away, every time.
 *
 * On Next 16.2.12 the task page's "Save decision" button stayed on "Saving…" for about
 * one save in six although the row was written (the client router never committed the
 * page update the action sent back). Repeating the save a dozen times catches a rate
 * like that; Next 16.4.0 passes this 80 times out of 80.
 */
const prisma = overnightPrisma();
test.afterAll(async () => prisma.$disconnect());

const TITLE = "Refresh check task";
const ROUNDS = 12;

async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    const button = document.querySelector("main button, form button");
    return Boolean(button && Object.keys(button).some((key) => key.startsWith("__reactFiber")));
  });
}

test.describe("/work/[id] · Save decision", () => {
  test.afterEach(async () => {
    await prisma.task.deleteMany({ where: { title: TITLE } });
  });

  test(`saving ${ROUNDS} times in a row never leaves the button on Saving…`, async ({ page }) => {
    const guards = attachGuards(page);
    const task = await prisma.task.create({ data: { title: TITLE } });
    await page.goto(`/work/${task.id}`);
    await waitForHydration(page);

    const summary = page.locator('[name="summary"]');
    const save = page.getByRole("button", { name: "Save decision" });
    for (let round = 1; round <= ROUNDS; round += 1) {
      const text = `Decision ${round}`;
      await summary.fill(text);
      await save.click();
      // The button reads "Saving…" while the action runs, then comes back on its own.
      await expect(save, `round ${round}`).toBeEnabled({ timeout: 8_000 });
      await expect(summary).toHaveValue(text);
      const row = await prisma.task.findUnique({ where: { id: task.id } });
      expect(row?.summary, `round ${round} in the data`).toBe(text);
    }

    await page.reload();
    await expect(page.locator('[name="summary"]')).toHaveValue(`Decision ${ROUNDS}`);
    await guards.assertClean();
  });
});
