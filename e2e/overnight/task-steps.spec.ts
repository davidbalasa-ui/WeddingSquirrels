import { expect, test, type Page } from "@playwright/test";
import { CURATED_PACKAGES } from "../../src/lib/curated-open-work";
import { overnightPrisma } from "./db";
import { attachGuards, expectNoSidewaysScroll } from "./helpers";

/**
 * The task workspace's "Steps inside this" cards (David, 2026-10-10: the note sat in a
 * small box that scrolled even for two lines, and a task had no way to add a step).
 * Runs on the local test copy. "Day-of Jobs" is built here from the repo's curated
 * package (src/lib/curated-open-work.ts) with its real step titles and notes; every
 * test removes what it made.
 */
const prisma = overnightPrisma();
test.afterAll(async () => prisma.$disconnect());

const PACKAGE_TITLE = "Day-of Jobs";
const ADDED = "Sweep added step";

async function createDayOfJobs() {
  const def = CURATED_PACKAGES.find((pkg) => pkg.title === PACKAGE_TITLE)!;
  await prisma.task.deleteMany({ where: { title: PACKAGE_TITLE, parentId: null } });
  const parent = await prisma.task.create({
    data: { title: def.title, summary: def.summary, planNotes: def.planNotes ?? "", status: "todo", amountSpent: 0 },
  });
  await prisma.taskAssignee.create({ data: { taskId: parent.id, personId: "david" } });
  let sortOrder = 0;
  for (const step of def.steps) {
    await prisma.task.create({
      data: {
        title: step.title,
        planNotes: step.planNotes ?? "",
        parentId: parent.id,
        status: "todo",
        sortOrder: sortOrder++,
        amountSpent: 0,
      },
    });
  }
  return parent.id;
}

/** Waits until React has hydrated the page's buttons (they then carry a fiber key). */
async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    const button = document.querySelector("main button, form button");
    return Boolean(button && Object.keys(button).some((key) => key.startsWith("__reactFiber")));
  });
}

/** Every step title and note on the page shows all of its text: nothing scrolls inside a box or runs off the card. */
async function expectStepsShowAllText(page: Page) {
  const overflowing = () =>
    page.locator("article textarea").evaluateAll((els) =>
      els
        .map((el) => el as HTMLTextAreaElement)
        .filter((box) => box.scrollHeight > box.clientHeight + 1)
        .map((box) => `"${box.value.slice(0, 40)}" (${box.scrollHeight} > ${box.clientHeight})`),
    );
  expect(await page.locator("article textarea").count()).toBeGreaterThan(0);
  // Polled: the boxes size themselves as soon as the page is interactive.
  await expect.poll(overflowing, { message: "a step title or note scrolls inside its box" }).toEqual([]);
}

test.describe("task steps cards", () => {
  let id = "";
  test.beforeEach(async () => {
    id = await createDayOfJobs();
  });
  test.afterEach(async () => {
    await prisma.task.deleteMany({ where: { title: PACKAGE_TITLE, parentId: null } });
  });

  test("step titles wrap and notes show in full without scrolling inside the box", async ({ page }) => {
    const guards = attachGuards(page);
    await page.goto(`/work/${id}`);
    await waitForHydration(page);
    await expect(page.getByRole("heading", { name: "Steps inside this" })).toBeVisible();
    await expectStepsShowAllText(page);
    await expectNoSidewaysScroll(page);

    // Steps are compact rows (David, 12:56: only two cards fit on his phone): the first three,
    // notes included, fit in 400px, so three to four show at a glance on a phone.
    const rows = page.locator("article").filter({ has: page.getByRole("textbox", { name: "Step title" }) });
    const first = (await rows.nth(0).boundingBox())!;
    const third = (await rows.nth(2).boundingBox())!;
    expect(third.y + third.height - first.y).toBeLessThanOrEqual(400);

    // The s'mores title is long enough to need two lines on a phone; it wraps instead of being cut.
    const smores = page.getByRole("textbox", { name: "Step title" }).nth(1);
    await expect(smores).toHaveValue("Decide/assign who preps and sets up the s'mores station foods");

    // The note box grows as lines are typed and shrinks back when cleared.
    const note = page.locator('article textarea[name="planNotes"]').first();
    const before = (await note.boundingBox())!.height;
    const long = ["Line one", "Line two", "Line three", "Line four", "A longer fifth line that wraps on a phone screen for sure"].join("\n");
    await note.fill(long);
    await expectStepsShowAllText(page);
    expect((await note.boundingBox())!.height).toBeGreaterThan(before);
    await page.keyboard.press("Tab");
    const stepId = (await prisma.task.findFirst({ where: { parentId: id }, orderBy: { sortOrder: "asc" } }))!.id;
    await expect.poll(async () => (await prisma.task.findUnique({ where: { id: stepId } }))?.planNotes?.replace(/\r\n/g, "\n")).toBe(long);
    await page.reload();
    await waitForHydration(page);
    await expect(note).toHaveValue(long);
    await expectStepsShowAllText(page);

    await note.fill("");
    await page.keyboard.press("Tab");
    await expect.poll(async () => (await prisma.task.findUnique({ where: { id: stepId } }))?.planNotes).toBe("");
    expect((await note.boundingBox())!.height).toBeLessThanOrEqual(before + 1);
    guards.assertClean();
  });

  test("a step title stays one line of text: Enter saves it and pasted line breaks become spaces", async ({ page }) => {
    const guards = attachGuards(page);
    await page.goto(`/work/${id}`);
    await waitForHydration(page);
    const title = page.getByRole("textbox", { name: "Step title" }).first();
    const stepId = (await prisma.task.findFirst({ where: { parentId: id }, orderBy: { sortOrder: "asc" } }))!.id;
    await title.fill("Ice\nfor the coolers");
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await prisma.task.findUnique({ where: { id: stepId } }))?.title).toBe("Ice for the coolers");
    guards.assertClean();
  });

  test("Add a step adds steps at the end, keeps the box open for the next one, and skips blanks", async ({ page }) => {
    const guards = attachGuards(page);
    await page.goto(`/work/${id}`);
    await waitForHydration(page);
    await expect(page.getByText("0/6 done")).toBeVisible();

    await page.getByRole("button", { name: "+ Add a step" }).click();
    const input = page.getByPlaceholder("What needs doing?");
    await expect(input).toBeFocused();
    const add = page.getByRole("button", { name: "Add step" });
    await expect(add).toBeDisabled();
    await input.fill("   ");
    await expect(add).toBeDisabled();

    await input.fill(`${ADDED} one`);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("textbox", { name: "Step title" }).nth(6)).toHaveValue(`${ADDED} one`);
    await expect(input).toHaveValue("");
    await expect(input).toBeFocused();
    await input.fill(`${ADDED} two`);
    await add.click();
    await expect(page.getByRole("textbox", { name: "Step title" }).nth(7)).toHaveValue(`${ADDED} two`);
    await expect(page.getByText("0/8 done")).toBeVisible();
    await expect(add).toBeDisabled();

    const rows = await prisma.task.findMany({ where: { parentId: id }, orderBy: { sortOrder: "asc" }, include: { assignees: true } });
    expect(rows.map((row) => row.title).slice(-2)).toEqual([`${ADDED} one`, `${ADDED} two`]);
    // New steps belong to the task's owner, like the steps already there.
    expect(rows.at(-1)!.assignees.map((a) => a.personId)).toEqual(["david"]);

    // Its note and check work like any other step's.
    const lastNote = page.locator('article textarea[name="planNotes"]').nth(7);
    await lastNote.fill("Sweep note on an added step");
    await page.keyboard.press("Tab");
    await expect.poll(async () => (await prisma.task.findUnique({ where: { id: rows.at(-1)!.id } }))?.planNotes).toBe("Sweep note on an added step");
    await page.getByRole("button", { name: "Mark step done" }).nth(7).click();
    await expect(page.getByText("1/8 done")).toBeVisible();

    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(page.getByRole("button", { name: "+ Add a step" })).toBeVisible();
    await page.reload();
    // The boxes size themselves once the page is interactive (Safari measured before that).
    await waitForHydration(page);
    await expect(page.getByText("1/8 done")).toBeVisible();
    await expectStepsShowAllText(page);
    await expectNoSidewaysScroll(page);
    guards.assertClean();
  });

  test("Cancel with typed text adds nothing", async ({ page }) => {
    const guards = attachGuards(page);
    await page.goto(`/work/${id}`);
    await waitForHydration(page);
    await page.getByRole("button", { name: "+ Add a step" }).click();
    await page.getByPlaceholder("What needs doing?").fill(`${ADDED} cancelled`);
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByPlaceholder("What needs doing?")).toHaveCount(0);
    expect(await prisma.task.count({ where: { parentId: id } })).toBe(6);
    guards.assertClean();
  });
});

test.describe("task with no steps yet", () => {
  const TITLE = "Sweep task without steps";
  test.afterEach(async () => {
    await prisma.task.deleteMany({ where: { title: TITLE, parentId: null } });
  });

  test("can get its first step, which then shows the steps list", async ({ page }) => {
    const guards = attachGuards(page);
    const task = await prisma.task.create({ data: { title: TITLE, status: "todo", amountSpent: 0 } });
    await page.goto(`/work/${task.id}`);
    await waitForHydration(page);
    await expect(page.getByRole("heading", { name: "Steps inside this" })).toHaveCount(0);
    await page.getByRole("button", { name: "+ Add steps inside this" }).click();
    await page.getByPlaceholder("What needs doing?").fill(`${ADDED} first`);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Steps inside this" })).toBeVisible();
    await expect(page.getByText("0/1 done")).toBeVisible();
    expect(await prisma.task.count({ where: { parentId: task.id } })).toBe(1);
    guards.assertClean();
  });
});

test("task list rows give the preview the full width and keep Escalate priority on the details row", async ({ page }) => {
  const guards = attachGuards(page);
  const id = await createDayOfJobs();
  try {
    await page.goto("/plan/tasks");
    await waitForHydration(page);
    const row = page.locator("article").filter({ has: page.getByText(PACKAGE_TITLE, { exact: true }) });
    const preview = row.locator("p.line-clamp-2");
    await expect(preview).toBeVisible();
    const rowBox = (await row.boundingBox())!;
    const previewBox = (await preview.boundingBox())!;
    // Before, the button sat in a column beside the text and the preview was cut to one short line.
    expect(previewBox.width).toBeGreaterThan(rowBox.width * 0.85);
    const escalate = row.getByRole("button", { name: "Escalate priority" });
    expect((await escalate.boundingBox())!.y).toBeGreaterThan(previewBox.y + previewBox.height - 1);
    await escalate.click();
    await expect.poll(async () => Boolean((await prisma.task.findUnique({ where: { id } }))?.escalatedAt)).toBe(true);
    await expect(row.getByRole("button", { name: "Remove priority pin" })).toBeVisible();
    await expectNoSidewaysScroll(page);
    guards.assertClean();
  } finally {
    await prisma.task.deleteMany({ where: { title: PACKAGE_TITLE, parentId: null } });
  }
});
