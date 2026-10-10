import { expect, test, type Page } from "@playwright/test";
import { overnightPrisma } from "./db";
import { attachGuards, expectNoSidewaysScroll } from "./helpers";

/**
 * Field sweep for the Plan area: tasks, the task workspace, shopping, stay and
 * the calendar. Every test creates (or picks) what it edits and puts it back.
 */
const prisma = overnightPrisma();
test.afterAll(async () => prisma.$disconnect());

const SWEEP_TITLE = "Sweep field test task";
const SWEEP_ITEM = "Sweep test item";

async function createSweepTask(page: Page) {
  await page.goto("/plan/tasks");
  await page.getByRole("button", { name: "Add Task" }).click();
  await page.getByPlaceholder("What needs deciding?").fill(SWEEP_TITLE);
  await page.locator('form button.btn-primary[type="submit"]').click();
  await page.waitForURL(/\/work\//);
  const id = page.url().split("/work/")[1]!.split("?")[0]!;
  return id;
}

/** Waits until React has hydrated the page's buttons (they then carry a fiber key). */
async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    const button = document.querySelector("main button, form button");
    return Boolean(button && Object.keys(button).some((key) => key.startsWith("__reactFiber")));
  });
}

async function saveDecision(page: Page) {
  // A tap before hydration is replayed by React and can leave the button on "Saving…"
  // in a slow test browser, so wait for hydration the way a person's pause would.
  await waitForHydration(page);
  await page.getByRole("button", { name: "Save decision" }).click();
  // The button reads "Saving…" until the action and the redirect finish. Now and then the
  // client keeps "Saving…" although the server already answered the redirect (logged in
  // SWEEP-REPORT.md as a separate finding); a reload shows the saved state, like a person
  // would do, so the field checks below still prove what was written.
  const button = page.getByRole("button", { name: "Save decision" });
  try {
    await expect(button).toBeEnabled({ timeout: 15_000 });
  } catch {
    await page.reload();
    await expect(button).toBeEnabled();
  }
  await page.waitForLoadState("networkidle");
}

test.describe("task workspace", () => {
  test.afterEach(async () => {
    await prisma.task.deleteMany({ where: { title: SWEEP_TITLE } });
  });

  test("typing letters in Money needed says it must be a number instead of silently saving nothing", async ({ page }) => {
    const guards = attachGuards(page);
    const id = await createSweepTask(page);
    const needed = page.locator('input[name="amountNeeded"]');
    await needed.fill("250");
    await saveDecision(page);
    await page.reload();
    await expect(needed).toHaveValue("250");

    await needed.fill("abc");
    await saveDecision(page);
    await expect(page.getByText("Money needed must be a number")).toBeVisible();
    await expect(needed).toHaveValue("abc");
    expect((await prisma.task.findUnique({ where: { id } }))?.amountNeeded).toBe(250);

    const spent = page.locator('input[name="amountSpent"]');
    await needed.fill("250");
    await spent.fill("12 dollars");
    await saveDecision(page);
    await expect(page.getByText("Money spent must be a number")).toBeVisible();
    expect((await prisma.task.findUnique({ where: { id } }))?.amountSpent).toBe(0);
    await guards.assertClean();
  });

  test("money fields keep decimals and commas, clear to empty, and 0 then 9 saves 9", async ({ page }) => {
    const guards = attachGuards(page);
    const id = await createSweepTask(page);
    const needed = page.locator('input[name="amountNeeded"]');
    const spent = page.locator('input[name="amountSpent"]');
    await needed.fill("1,000.50");
    await spent.fill("$12.50");
    await saveDecision(page);
    await page.reload();
    await expect(needed).toHaveValue("1000.5");
    await expect(spent).toHaveValue("12.5");

    await needed.fill("");
    await spent.fill("");
    await saveDecision(page);
    await page.reload();
    await expect(needed).toHaveValue("");
    await expect(spent).toHaveValue("");
    const cleared = await prisma.task.findUnique({ where: { id } });
    expect(cleared?.amountNeeded).toBeNull();
    expect(cleared?.amountSpent).toBe(0);

    await needed.click();
    await page.keyboard.type("0");
    await page.keyboard.press("Backspace");
    await page.keyboard.type("9");
    await expect(needed).toHaveValue("9");
    await saveDecision(page);
    await page.reload();
    await expect(needed).toHaveValue("9");
    expect((await prisma.task.findUnique({ where: { id } }))?.amountNeeded).toBe(9);
    await guards.assertClean();
  });

  test("saving a whitespace-only title says Add a title instead of quietly keeping the old one", async ({ page }) => {
    const guards = attachGuards(page);
    await createSweepTask(page);
    const title = page.locator('input[name="title"]');
    await title.fill("   ");
    await saveDecision(page);
    await expect(page.getByText("Add a title.")).toBeVisible();
    await guards.assertClean();
  });

  test("notes, due date, done and owners come back as typed after a reload", async ({ page }) => {
    const guards = attachGuards(page);
    const id = await createSweepTask(page);
    const tricky = `line1\n\nline3 🎉 ' " \` <b>x</b>`;
    const long = "x".repeat(2000);
    await page.locator('textarea[name="summary"]').fill(tricky);
    await page.locator('textarea[name="planNotes"]').fill(long);
    await page.locator('input[name="dueDate"]').fill("2026-10-20");
    await page.locator('input[name="markDone"]').check();
    await saveDecision(page);
    await page.reload();
    await expect(page.locator('textarea[name="summary"]')).toHaveValue(tricky);
    await expect(page.locator('textarea[name="planNotes"]')).toHaveValue(long);
    await expect(page.locator('input[name="dueDate"]')).toHaveValue("2026-10-20");
    await expect(page.locator('input[name="markDone"]')).toBeChecked();
    await expectNoSidewaysScroll(page);

    await page.locator('input[name="dueDate"]').fill("");
    await page.locator('input[name="markDone"]').uncheck();
    await page.locator("summary", { hasText: "Owners" }).click();
    const boxes = page.locator('input[name="assignees"]');
    for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).uncheck();
    await saveDecision(page);
    await page.reload();
    await expect(page.locator('input[name="dueDate"]')).toHaveValue("");
    await expect(page.locator('input[name="markDone"]')).not.toBeChecked();
    await expect(page.locator("summary", { hasText: "Owners" })).toContainText("Unassigned");
    const row = await prisma.task.findUnique({ where: { id }, include: { assignees: true } });
    expect(row?.dueDate).toBeNull();
    expect(row?.status).toBe("todo");
    expect(row?.assignees).toHaveLength(0);
    await guards.assertClean();
  });
});

test.describe("task steps", () => {
  test("clearing a step title and tabbing away shows the saved title again, Enter saves a rename", async ({ page }) => {
    const guards = attachGuards(page);
    const parent = await prisma.task.findFirst({ where: { title: "Week before", parentId: null } });
    test.skip(!parent, "Week before card missing from the test data");
    const step = await prisma.task.findFirst({ where: { parentId: parent!.id }, orderBy: { sortOrder: "asc" } });
    const original = step!.title;
    await page.goto(`/work/${parent!.id}`);
    await waitForHydration(page);
    const input = page.getByRole("textbox", { name: "Step title" }).first();
    await expect(input).toHaveValue(original);

    await input.fill("");
    await page.keyboard.press("Tab");
    await expect(input).toHaveValue(original);
    expect((await prisma.task.findUnique({ where: { id: step!.id } }))?.title).toBe(original);

    await input.fill("Sweep renamed step");
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await prisma.task.findUnique({ where: { id: step!.id } }))?.title).toBe("Sweep renamed step");
    await page.reload();
    await waitForHydration(page);
    await expect(input).toHaveValue("Sweep renamed step");

    await input.fill(original);
    await page.keyboard.press("Tab");
    await expect.poll(async () => (await prisma.task.findUnique({ where: { id: step!.id } }))?.title).toBe(original);
    await guards.assertClean();
  });

  test("step notes save on blur, survive a reload, and clear to empty", async ({ page }) => {
    const guards = attachGuards(page);
    const parent = await prisma.task.findFirst({ where: { title: "Week before", parentId: null } });
    test.skip(!parent, "Week before card missing from the test data");
    const step = await prisma.task.findFirst({ where: { parentId: parent!.id }, orderBy: { sortOrder: "asc" } });
    await page.goto(`/work/${parent!.id}`);
    await waitForHydration(page);
    const notes = page.locator('article textarea[name="planNotes"]').first();
    await notes.fill("Sweep step note\n\nline 3 🎉");
    await page.keyboard.press("Tab");
    await expect.poll(async () => (await prisma.task.findUnique({ where: { id: step!.id } }))?.planNotes?.replace(/\r\n/g, "\n")).toBe(
      "Sweep step note\n\nline 3 🎉",
    );
    await page.reload();
    await waitForHydration(page);
    await expect(notes).toHaveValue("Sweep step note\n\nline 3 🎉");
    await notes.fill("");
    await page.keyboard.press("Tab");
    await expect.poll(async () => (await prisma.task.findUnique({ where: { id: step!.id } }))?.planNotes).toBe("");
    await page.reload();
    await expect(notes).toHaveValue("");
    await guards.assertClean();
  });
});

test.describe("shopping", () => {
  test.afterEach(async () => {
    await prisma.shoppingItem.deleteMany({ where: { name: { startsWith: "Sweep" } } });
  });

  test("adding an item with a blank name says so and keeps the form open", async ({ page }) => {
    const guards = attachGuards(page);
    await page.goto("/plan/shopping");
    await page.getByRole("button", { name: "Add shopping item" }).click();
    await page.locator('input[name="name"]').fill("   ");
    await page.locator('input[name="quantity"]').fill("2");
    await page.getByRole("button", { name: "Add to list" }).click();
    await expect(page.getByText("Add an item name.")).toBeVisible();
    await expect(page.locator('input[name="quantity"]')).toHaveValue("2");
    expect(await prisma.shoppingItem.count({ where: { name: "" } })).toBe(0);
    await guards.assertClean();
  });

  test("an item round-trips its fields, hides when purchased, and renaming it to blank is refused", async ({ page }) => {
    const guards = attachGuards(page);
    const name = `${SWEEP_ITEM} 🎉 ' " <b>x</b>`;
    await page.goto("/plan/shopping");
    await page.getByRole("button", { name: "Add shopping item" }).click();
    await page.locator('input[name="name"]').fill(name);
    await page.locator('input[name="quantity"]').fill("007");
    await page.locator('select[name="ownerId"]').selectOption("haley");
    await page.locator('textarea[name="note"]').fill("Sweep note\n\nline 3");
    await page.getByRole("button", { name: "Add to list" }).click();
    await expect(page.getByRole("button", { name: "Add shopping item" })).toBeVisible();
    await page.reload();
    await expect(page.getByText(name)).toBeVisible();
    await expect(page.getByText("× 007")).toBeVisible();
    await expectNoSidewaysScroll(page);
    const item = await prisma.shoppingItem.findFirst({ where: { name } });
    expect(item?.ownerId).toBe("haley");
    expect(item?.note?.replace(/\r\n/g, "\n")).toBe("Sweep note\n\nline 3");

    await page.getByRole("button", { name }).click();
    await expect(page.locator('input[name="quantity"]')).toHaveValue("007");
    await expect(page.locator('select[name="ownerId"]')).toHaveValue("haley");
    await page.locator('input[name="name"]').fill("   ");
    await page.getByRole("button", { name: "Save item" }).click();
    await expect(page.getByText("Add an item name.")).toBeVisible();
    expect((await prisma.shoppingItem.findFirst({ where: { id: item!.id } }))?.name).toBe(name);

    await page.locator('input[name="name"]').fill(name);
    await page.locator('input[name="quantity"]').fill("");
    await page.locator('select[name="ownerId"]').selectOption("");
    await page.locator('input[name="purchased"]').check();
    await page.getByRole("button", { name: "Save item" }).click();
    await expect(page.getByText(name)).toHaveCount(0);
    await page.getByRole("button", { name: "Show purchased" }).click();
    await expect(page.getByText(name)).toBeVisible();
    const saved = await prisma.shoppingItem.findFirst({ where: { id: item!.id } });
    expect(saved?.quantity).toBeNull();
    expect(saved?.ownerId).toBeNull();
    expect(saved?.purchased).toBe(true);
    await guards.assertClean();
  });
});

test.describe("stay", () => {
  // No sleeping arrangements (David, 2026-10-10): the page is gone and its saved beds stay in the database.
  test("the Stay page and its Plan row are gone, and saved beds are kept", async ({ page }) => {
    const beds = await prisma.staySlot.count();
    // The old address hands over to Plan in the browser, which cuts off the first page's prefetches.
    await page.goto("/plan/stay");
    await expect(page).toHaveURL(/\/plan$/);
    const guards = attachGuards(page);
    await page.goto("/plan", { waitUntil: "networkidle" });
    await expect(page.locator("#main-content")).toContainText("Shopping");
    await expect(page.locator("#main-content")).not.toContainText("beds assigned");
    await expect(page.locator('a[href="/plan/stay"]')).toHaveCount(0);
    expect(await prisma.staySlot.count()).toBe(beds);
    await guards.assertClean();
  });
});

test.describe("calendar", () => {
  test("editing an event keeps its dates, shows notes with their line breaks, and a blank title is refused", async ({ page }) => {
    const guards = attachGuards(page);
    const event = await prisma.calendarEvent.findFirst({ where: { title: "Wedding day" } });
    test.skip(!event, "Wedding day event missing from the test data");
    const original = { ...event! };
    await page.goto("/plan/calendar");
    // The grid opens on the current month; walk to the event's month.
    const target = new Date(event!.startDate);
    const label = target.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
    for (let i = 0; i < 24 && !(await page.getByRole("heading", { name: label }).count()); i++) {
      const shown = await page.locator("h2").first().innerText();
      await page.getByRole("button", { name: new Date(shown) < target ? "Next month" : "Previous month" }).click();
    }
    await page.getByRole("button", { name: new RegExp(`^${target.getUTCDate()}\\b`) }).click();
    await page.getByRole("button", { name: "Edit" }).first().click();
    await expect(page.locator('input[name="startDate"]')).toHaveValue("2026-10-16");

    await page.locator('input[name="title"]').fill("   ");
    await page.getByRole("button", { name: "Save event" }).click();
    await expect(page.getByText("Add a title.")).toBeVisible();
    expect((await prisma.calendarEvent.findUnique({ where: { id: event!.id } }))?.title).toBe("Wedding day");

    await page.locator('input[name="title"]').fill("Wedding day");
    await page.locator('input[name="location"]').fill("Sweep place 🎉");
    await page.locator('textarea[name="notes"]').fill("Sweep note\n\nline 3");
    await page.locator('input[name="endDate"]').fill("2026-10-17");
    await page.getByRole("button", { name: "Save event" }).click();
    await expect(page.getByRole("button", { name: "Save event" })).toHaveCount(0);
    // Read the card after a full reload so the check is about what was saved.
    // Firefox aborts a reload that starts while the save's own refresh is still in flight.
    await page.waitForLoadState("networkidle");
    await page.reload();
    await page.getByRole("button", { name: new RegExp(`^${target.getUTCDate()}\\b`) }).click();
    const article = page.locator("article").first();
    await expect(article).toContainText("Oct 16–Oct 17");
    await expect(article).toContainText("Sweep place 🎉");
    const notesText = await article.locator("p", { hasText: "Sweep note" }).innerText();
    expect(notesText).toBe("Sweep note\n\nline 3");
    const saved = await prisma.calendarEvent.findUnique({ where: { id: event!.id } });
    expect(saved?.startDate.toISOString()).toBe(original.startDate.toISOString());
    expect(saved?.endDate.toISOString()).toBe("2026-10-17T12:00:00.000Z");

    await prisma.calendarEvent.update({
      where: { id: event!.id },
      data: { title: original.title, notes: original.notes, location: original.location, startDate: original.startDate, endDate: original.endDate },
    });
    await guards.assertClean();
  });
});
