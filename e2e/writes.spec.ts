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
});
