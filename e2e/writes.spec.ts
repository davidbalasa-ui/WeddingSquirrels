import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import { attachPageGuards, certName } from "./helpers";

async function cleanupCertRecords() {
  const url =
    process.env.CERT_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "postgresql://wedding:wedding@127.0.0.1:5432/wedding_production_merge_simulation_20260907?sslmode=disable";
  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    await prisma.shoppingItem.deleteMany({ where: { name: { startsWith: "CERT-WS" } } });
    await prisma.dayAssignment.deleteMany({ where: { title: { startsWith: "CERT-WS" } } });
    await prisma.timelineBlock.deleteMany({ where: { notes: { startsWith: "CERT-WS" } } });
    await prisma.budgetItem.deleteMany({ where: { name: { startsWith: "CERT-WS" } } });
    await prisma.task.deleteMany({ where: { title: { startsWith: "CERT-WS" } } });
    await prisma.stayBathNote.deleteMany({ where: { note: { startsWith: "CERT-WS" } } });
    await prisma.staySlot.updateMany({ where: { occupant: { startsWith: "CERT" } }, data: { occupant: "" } });
    await prisma.mealChoice.deleteMany({
      where: { OR: [{ course: { label: { startsWith: "CERT-WS" } } }, { option: { label: { startsWith: "CERT-WS" } } }] },
    });
    await prisma.mealOption.deleteMany({
      where: { OR: [{ label: { startsWith: "CERT-WS" } }, { course: { label: { startsWith: "CERT-WS" } } }] },
    });
    await prisma.mealCourse.deleteMany({ where: { OR: [{ label: { startsWith: "CERT-WS" } }, { label: "" }] } });
    await prisma.mealSettings.upsert({
      where: { id: 1 },
      create: { id: 1, published: false },
      update: { published: false },
    });
  } finally {
    await prisma.$disconnect();
  }
}

test.afterEach(async () => {
  await cleanupCertRecords();
});

test.describe("writable lifecycles", () => {
  test("shopping add / edit / cancel / delete", async ({ page }) => {
    const guards = await attachPageGuards(page);
    const name = certName("shop");
    const renamed = `${name} edited`;
    await page.goto("/plan/shopping");
    await page.getByRole("button", { name: "Add shopping item" }).click();
    await page.getByPlaceholder("What do we need to buy?").fill(name);
    await page.getByRole("button", { name: "Add to list" }).click();
    await expect(page.getByRole("button", { name: new RegExp(name) })).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: new RegExp(name) }).click();
    await page.locator('input[name="name"]').fill(renamed);
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("button", { name: new RegExp(name) })).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(renamed) })).toHaveCount(0);

    await page.getByRole("button", { name: new RegExp(name) }).click();
    await page.locator('input[name="name"]').fill(renamed);
    await page.getByRole("button", { name: "Save item" }).click();
    await expect(page.getByRole("button", { name: new RegExp(renamed) })).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: new RegExp(renamed) }).click();
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("button", { name: new RegExp(renamed) })).toHaveCount(0);
    guards.assertClean();
  });

  test("assignment add / cancel / delete", async ({ page }) => {
    const guards = await attachPageGuards(page);
    const name = certName("job");
    const form = page.locator("form").filter({ hasText: "New assignment" });
    await page.goto("/day/assignments");
    await page.getByRole("button", { name: "Add assignment" }).first().click();
    await expect(form).toBeVisible();
    await form.locator('input[name="title"]').fill(name);
    await form.getByRole("button", { name: "Cancel" }).click();
    await expect(form).toHaveCount(0);
    await expect(page.getByText(name)).toHaveCount(0);

    await page.getByRole("button", { name: "Add assignment" }).first().click();
    await expect(form).toBeVisible();
    await form.locator('input[name="title"]').fill(name);
    await form.locator('button[type="submit"]').click();
    await expect(form).toHaveCount(0, { timeout: 15_000 });
    const created = page.getByText(name);
    if (!(await created.isVisible().catch(() => false))) {
      await page.reload({ waitUntil: "domcontentloaded" });
    }
    await expect(created).toBeVisible();
    await expect(page.getByText("No one assigned").first()).toBeVisible();

    await page.evaluate(() => {
      window.confirm = () => true;
    });
    await page.locator("article").filter({ hasText: name }).getByRole("button", { name: "Delete" }).click();
    if ((await page.getByText(name).count()) > 0) {
      await page.reload({ waitUntil: "domcontentloaded" });
    }
    await expect(page.getByText(name)).toHaveCount(0);
    guards.assertClean();
  });

  test("timeline disposable block add / discard / delete", async ({ page }) => {
    const guards = await attachPageGuards(page);
    const notes = certName("moment");
    await page.goto("/plan/timeline");
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("button", { name: "+ Add moment" }).click();
    await page.locator("textarea[placeholder*='What happens']").fill("discard me");
    await page.getByRole("button", { name: "Discard" }).click();
    await expect(page.getByText("discard me")).toHaveCount(0);

    await page.getByRole("button", { name: "+ Add moment" }).click();
    await page.locator("textarea[placeholder*='What happens']").fill(notes);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(notes)).toBeVisible({ timeout: 15_000 });

    const row = page.locator("article").filter({ hasText: notes });
    await row.getByRole("button", { name: "Remove moment" }).click();
    await row.getByRole("button", { name: "Remove?" }).click();
    await expect(page.getByText(notes)).toHaveCount(0);
    guards.assertClean();
  });

  test("stay bathroom note create and delete", async ({ page }) => {
    const guards = await attachPageGuards(page);
    const note = certName("bath");
    await page.goto("/plan/stay");
    await page.getByRole("button", { name: "+ Add note" }).first().click();
    const editor = page.getByPlaceholder(/Who/).last();
    await editor.fill(note);
    await editor.blur();
    await expect(page.getByText(note)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Remove bathroom note" }).last().click();
    await expect(page.getByText(note)).toHaveCount(0);

    const slot = page.locator("label").filter({ hasText: /^Middle bunk/ }).locator("input");
    await expect(slot).toHaveValue("");
    await slot.fill("CERT occupant");
    await slot.blur();
    await expect(slot).toHaveValue("CERT occupant", { timeout: 15_000 });
    await slot.fill("");
    await slot.blur();
    await expect(slot).toHaveValue("");
    guards.assertClean();
  });

  test("today task create and workspace save", async ({ page }) => {
    const guards = await attachPageGuards(page);
    const name = certName("task");
    await page.goto("/today");
    await page.getByRole("button", { name: "Task", exact: true }).click();
    await page.getByPlaceholder("What needs deciding?").fill(name);
    await page.getByRole("button", { name: "Add task" }).click();
    await expect(page.getByRole("button", { name: "Cancel" })).toHaveCount(0);
    await page.goto("/today?filter=tasks");
    await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });

    const prisma = new PrismaClient({
      datasourceUrl:
        process.env.CERT_DATABASE_URL ||
        "postgresql://wedding:wedding@127.0.0.1:5432/wedding_production_merge_simulation_20260907?sslmode=disable",
    });
    const created = await prisma.task.findFirst({ where: { title: name } });
    await prisma.$disconnect();
    expect(created, "created task should exist in the simulation DB").toBeTruthy();
    const workspace = `/work/${created!.id}`;
    await page.goto(workspace);
    await expect(page.getByRole("button", { name: "Save decision" })).toBeVisible();
    await page.locator('textarea[name="planNotes"]').fill("CERT workspace note");
    await page.getByRole("button", { name: "Save decision" }).click();
    await expect(page).toHaveURL(/\/today/);
    await page.goto(workspace);
    await expect(page.locator('textarea[name="planNotes"]')).toHaveValue("CERT workspace note");
    guards.assertClean();
  });

  test("money disposable contract create and delete", async ({ page }) => {
    const guards = await attachPageGuards(page);
    const name = certName("contract");
    await page.goto("/money");
    await page.getByRole("button", { name: "Add a contract" }).click();
    await page.getByPlaceholder("Vendor or contract").fill(name);
    await page.getByPlaceholder("Contract total").fill("1");
    await page.getByRole("button", { name: "Add contract" }).click();
    await expect(page.getByRole("button", { name: "Add a contract" })).toBeVisible({ timeout: 15_000 });

    const prisma = new PrismaClient({
      datasourceUrl:
        process.env.CERT_DATABASE_URL ||
        "postgresql://wedding:wedding@127.0.0.1:5432/wedding_production_merge_simulation_20260907?sslmode=disable",
    });
    const created = await prisma.budgetItem.findFirst({ where: { name } });
    await prisma.$disconnect();
    expect(created, "created contract should exist in the simulation DB").toBeTruthy();
    await page.goto(`/money/${created!.id}`);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await page.getByRole("button", { name: "Edit contract" }).click();
    await page.evaluate(() => {
      window.confirm = () => true;
    });
    await page.getByRole("button", { name: "Remove contract" }).click();
    await expect(page).toHaveURL(/\/money/);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: new RegExp(name) })).toHaveCount(0);
    guards.assertClean();
  });

  test("timeline drag-reorders same-start disposable peers", async ({ page }) => {
    const guards = await attachPageGuards(page);
    const firstNotes = certName("alpha");
    const secondNotes = certName("beta");
    await page.goto("/plan/timeline");
    await page.getByRole("button", { name: "Edit" }).click();

    for (const notes of [firstNotes, secondNotes]) {
      await page.getByRole("button", { name: "+ Add moment" }).click();
      await page.locator("textarea[placeholder*='What happens']").fill(notes);
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await expect(page.locator("article").filter({ hasText: notes })).toBeVisible({ timeout: 15_000 });
    }

    for (const notes of [firstNotes, secondNotes]) {
      const row = page.locator("article").filter({ hasText: notes });
      await row.getByLabel("Start time hour").fill("04");
      await row.getByLabel("Start time minutes").fill("44");
      await row.locator("textarea").click();
    }

    const certDb = () =>
      new PrismaClient({
        datasourceUrl:
          process.env.CERT_DATABASE_URL ||
          "postgresql://wedding:wedding@127.0.0.1:5432/wedding_production_merge_simulation_20260907?sslmode=disable",
      });
    await expect
      .poll(async () => {
        const prisma = certDb();
        const rows = await prisma.timelineBlock.findMany({
          where: { notes: { in: [firstNotes, secondNotes] } },
        });
        await prisma.$disconnect();
        return rows.filter((row) => row.startAt.includes("4:44")).length;
      }, { timeout: 10_000 })
      .toBe(2);

    const first = page.locator("article").filter({ hasText: firstNotes });
    const second = page.locator("article").filter({ hasText: secondNotes });
    await expect(first.getByRole("button", { name: "Drag to reorder matching start and end" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(second.getByRole("button", { name: "Drag to reorder matching start and end" })).toBeVisible();

    const peerOrder = async () =>
      page.evaluate((notes: string[]) =>
        [...document.querySelectorAll("article")]
          .map((el) => el.querySelector("textarea")?.value || "")
          .filter((value) => notes.some((note) => value.includes(note))),
      [firstNotes, secondNotes]);

    const before = await peerOrder();
    expect(before).toHaveLength(2);
    const leading = before[0]!;
    const trailing = before[1]!;
    const leadingRow = page.locator("article").filter({ hasText: leading });
    const trailingRow = page.locator("article").filter({ hasText: trailing });
    const handle = leadingRow.getByRole("button", { name: "Drag to reorder matching start and end" });
    await handle.scrollIntoViewIfNeeded();
    const from = await handle.boundingBox();
    const toBox = await trailingRow.boundingBox();
    expect(from && toBox, "drag source and target need geometry").toBeTruthy();
    await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
    await page.mouse.down();
    await page.mouse.move(toBox!.x + 20, toBox!.y + toBox!.height + 16, { steps: 16 });
    await page.mouse.up();
    await page
      .locator("article")
      .filter({ hasText: leading })
      .getByRole("button", { name: "Drag to reorder matching start and end" })
      .dispatchEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse" });
    if ((await peerOrder())[0] === leading) {
      await page
        .locator("article")
        .filter({ hasText: leading })
        .getByRole("button", { name: "Drag to reorder matching start and end" })
        .click({ force: true });
    }
    await expect.poll(async () => (await peerOrder())[0], { timeout: 10_000 }).not.toBe(leading);
    const swapped = (await peerOrder())[0]!;
    await expect
      .poll(async () => {
        const prisma = certDb();
        const rows = await prisma.timelineBlock.findMany({
          where: { notes: { in: [firstNotes, secondNotes] } },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        });
        await prisma.$disconnect();
        return rows[0]?.notes ?? "";
      }, { timeout: 10_000 })
      .toBe(swapped);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Edit" }).click();
    await expect.poll(async () => (await peerOrder())[0], { timeout: 10_000 }).toBe(swapped);

    for (const notes of [firstNotes, secondNotes]) {
      const row = page.locator("article").filter({ hasText: notes });
      await row.getByRole("button", { name: "Remove moment" }).click();
      await row.getByRole("button", { name: "Remove?" }).click();
      await expect(page.getByText(notes)).toHaveCount(0);
    }
    guards.assertClean();
  });

  test("meal add course / dish / publish then remove", async ({ page }) => {
    const guards = await attachPageGuards(page);
    const course = certName("entree");
    const dish = certName("steak");
    await page.goto("/plan/rehearsal");
    await expect(page.getByRole("button", { name: "Hidden from guests" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel" })).toHaveCount(0);

    await page.getByRole("button", { name: "+ Add course" }).click();
    const courseInput = page.getByPlaceholder("Course name (Entree, Side, Drink…)");
    await expect(courseInput).toBeVisible();
    await courseInput.fill(course);
    await courseInput.blur();
    await expect(courseInput).toHaveValue(course);

    await page.getByRole("button", { name: "+ Add dish" }).click();
    const dishInput = page.getByPlaceholder("Dish name");
    await expect(dishInput).toBeVisible();
    await dishInput.fill(dish);
    await dishInput.blur();
    await expect(dishInput).toHaveValue(dish);

    await page.getByRole("button", { name: "Hidden from guests" }).click();
    await expect(page.getByRole("button", { name: "Visible to guests" })).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByPlaceholder("Course name (Entree, Side, Drink…)")).toHaveValue(course);
    await expect(page.getByPlaceholder("Dish name")).toHaveValue(dish);
    await expect(page.getByRole("button", { name: "Visible to guests" })).toBeVisible();

    await page.getByRole("button", { name: "Visible to guests" }).click();
    await expect(page.getByRole("button", { name: "Hidden from guests" })).toBeVisible();
    await page.getByRole("button", { name: "Remove course" }).click();
    await expect(page.getByPlaceholder("Course name (Entree, Side, Drink…)")).toHaveCount(0);
    await expect(page.getByText("No courses yet").first()).toBeVisible();
    guards.assertClean();
  });

  test("workspace leave without save keeps the original notes", async ({ page }) => {
    const guards = await attachPageGuards(page);
    const name = certName("leave");
    await page.goto("/today");
    await page.getByRole("button", { name: "Task", exact: true }).click();
    await page.getByPlaceholder("What needs deciding?").fill(name);
    await page.getByRole("button", { name: "Add task" }).click();
    await expect(page.getByRole("button", { name: "Cancel" })).toHaveCount(0);

    const prisma = new PrismaClient({
      datasourceUrl:
        process.env.CERT_DATABASE_URL ||
        "postgresql://wedding:wedding@127.0.0.1:5432/wedding_production_merge_simulation_20260907?sslmode=disable",
    });
    const created = await prisma.task.findFirst({ where: { title: name } });
    await prisma.$disconnect();
    expect(created, "created task should exist in the simulation DB").toBeTruthy();
    const workspace = `/work/${created!.id}`;
    await page.goto(workspace);
    const notes = page.locator('textarea[name="planNotes"]');
    const original = await notes.inputValue();
    await notes.fill("CERT should not persist");
    await expect(notes).toHaveValue("CERT should not persist");
    await page.getByRole("link", { name: "← Back to Today" }).click();
    await expect(page).toHaveURL(/\/today/);
    await page.goto(workspace);
    await expect(notes).toHaveValue(original);
    await expect(notes).not.toHaveValue("CERT should not persist");
    guards.assertClean();
  });
});
