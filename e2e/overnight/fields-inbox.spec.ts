import { expect, test, type Page } from "@playwright/test";
import { overnightPrisma } from "./db";
import { attachGuards, expectNoSidewaysScroll } from "./helpers";

/**
 * Field sweep for the inbox area: /today (compose dock, note editor, ask rows),
 * /messages (new thread) and /messages/[id] (composer). Every test creates the
 * rows it edits and cleans them up, so it can run again against the same copy.
 */
const prisma = overnightPrisma();
const PREFIX = "Sweep inbox";

async function accountIds() {
  const rows = await prisma.pinAccount.findMany({ select: { id: true, name: true } });
  const david = rows.find((row) => row.name === "David")?.id;
  const haley = rows.find((row) => row.name === "Haley")?.id;
  if (!david || !haley) throw new Error("test data needs the David and Haley accounts");
  return { david, haley };
}

async function cleanup() {
  const tasks = await prisma.task.findMany({ where: { title: { startsWith: PREFIX } }, select: { id: true } });
  const taskIds = tasks.map((row) => row.id);
  await prisma.taskAssignee.deleteMany({ where: { taskId: { in: taskIds } } });
  await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
  await prisma.shoppingItem.deleteMany({ where: { name: { startsWith: PREFIX } } });
  const requests = await prisma.request.findMany({ where: { title: { startsWith: PREFIX } }, select: { id: true } });
  const requestIds = requests.map((row) => row.id);
  await prisma.requestMessage.deleteMany({ where: { requestId: { in: requestIds } } });
  await prisma.request.deleteMany({ where: { id: { in: requestIds } } });
}

test.beforeEach(cleanup);
test.afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

function noteRow(page: Page, title: string) {
  return page.locator("article", { hasText: title }).first();
}

test.describe("/today note editor", () => {
  test("Other with nobody ticked clears the owners to Unassigned", async ({ page }) => {
    const guards = attachGuards(page);
    const title = `${PREFIX} owners note`;
    const task = await prisma.task.create({
      data: { title, summary: "", planNotes: "", status: "todo", sortOrder: 9000, amountSpent: 0 },
    });
    await prisma.taskAssignee.createMany({ data: [{ taskId: task.id, personId: "david" }, { taskId: task.id, personId: "haley" }] });

    await page.goto("/today?filter=tasks");
    const row = noteRow(page, title);
    await expect(row).toContainText("David · Haley");
    await row.getByRole("button", { name: "Edit" }).click();
    await row.getByRole("button", { name: "Other" }).click();
    for (const box of await row.locator('input[type="checkbox"]').all()) {
      if (await box.isChecked()) await box.uncheck();
    }
    await expect(row.locator('input[type="checkbox"]:checked')).toHaveCount(0);
    await row.getByRole("button", { name: "Save" }).click();

    await expect(row.locator("form")).toHaveCount(0);
    await expect.poll(() => prisma.taskAssignee.count({ where: { taskId: task.id } }), { timeout: 15_000 }).toBe(0);
    await expect(row).toContainText("Unassigned");
    await page.reload();
    await expect(noteRow(page, title)).toContainText("Unassigned");
    await guards.assertClean();
  });

  test("odd characters in the title and a cleared due date come back as typed", async ({ page }) => {
    const guards = attachGuards(page);
    const title = `${PREFIX} typed note`;
    const task = await prisma.task.create({
      data: { title, summary: "", planNotes: "", status: "todo", sortOrder: 9001, amountSpent: 0, dueDate: new Date("2026-10-12T12:00:00") },
    });
    await prisma.taskAssignee.create({ data: { taskId: task.id, personId: "david" } });

    await page.goto("/today?filter=tasks");
    const row = noteRow(page, title);
    await expect(row).toContainText("Oct 12");
    await row.getByRole("button", { name: "Edit" }).click();
    const input = row.locator("input").first();
    const next = `${PREFIX} 🎉 ' " \` <b>x</b>`;
    await input.fill("   ");
    await expect(row.getByRole("button", { name: "Save" })).toBeDisabled();
    await input.fill(next);
    await row.locator('input[type="date"]').fill("");
    await row.getByRole("button", { name: "Save" }).click();

    await expect(row.locator("form")).toHaveCount(0);
    await expect.poll(async () => (await prisma.task.findUnique({ where: { id: task.id } }))?.title).toBe(next);
    expect((await prisma.task.findUnique({ where: { id: task.id } }))?.dueDate).toBeNull();
    await page.reload();
    const after = noteRow(page, next);
    await expect(after).toContainText(next);
    await expect(after).not.toContainText("Oct 12");
    await expectNoSidewaysScroll(page);
    await guards.assertClean();
  });
});

test.describe("/today compose dock", () => {
  test("Ask with a blank title says what is missing instead of closing the form", async ({ page }) => {
    const guards = attachGuards(page);
    const { haley } = await accountIds();
    const before = await prisma.request.count();
    await page.goto("/today");
    await page.locator(".compose-dock").getByRole("button", { name: "Ask", exact: true }).click();
    await page.locator('select[name="recipientAccountId"]').selectOption(haley);
    await page.locator('input[name="title"]').fill("   ");
    await page.getByRole("button", { name: "Send ask" }).click();

    await expect(page.getByText("Add a short title.")).toBeVisible();
    await expect(page.locator('input[name="title"]')).toBeVisible();
    expect(await prisma.request.count()).toBe(before);

    // Typing a real title sends it and closes the form.
    await page.locator('input[name="title"]').fill(`${PREFIX} ask`);
    await page.getByRole("button", { name: "Send ask" }).click();
    await expect(page.locator('input[name="title"]')).toHaveCount(0);
    await expect.poll(() => prisma.request.count({ where: { title: `${PREFIX} ask` } })).toBe(1);
    await guards.assertClean();
  });

  test("Buy with a blank item name says what is missing instead of closing the form", async ({ page }) => {
    const guards = attachGuards(page);
    const before = await prisma.shoppingItem.count();
    await page.goto("/today");
    await page.locator(".compose-dock").getByRole("button", { name: "Buy", exact: true }).click();
    await page.locator('input[name="name"]').fill("   ");
    await page.getByRole("button", { name: "Add to list" }).click();

    await expect(page.getByText("Add what to buy.")).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
    expect(await prisma.shoppingItem.count()).toBe(before);

    await page.locator('input[name="name"]').fill(`${PREFIX} buy 007`);
    await page.locator('select[name="ownerId"]').selectOption("haley");
    await page.getByRole("button", { name: "Add to list" }).click();
    await expect(page.locator('input[name="name"]')).toHaveCount(0);
    await expect.poll(async () => (await prisma.shoppingItem.findFirst({ where: { name: `${PREFIX} buy 007` } }))?.ownerId).toBe("haley");
    await guards.assertClean();
  });
});

test.describe("/today ask rows", () => {
  test("declined ask checkbox is labelled Reopen and reopens the ask", async ({ page }) => {
    const guards = attachGuards(page);
    const { david, haley } = await accountIds();
    const title = `${PREFIX} declined ask`;
    const request = await prisma.request.create({
      data: {
        title,
        status: "declined",
        declinedAt: new Date(),
        declineNote: "Test decline note",
        senderAccountId: haley,
        recipientAccountId: david,
      },
    });

    await page.goto("/today?filter=asks&done=1");
    const row = noteRow(page, title);
    await expect(row).toContainText("Declined");
    await expect(row.getByRole("button", { name: "Mark done" })).toHaveCount(0);
    await row.getByRole("button", { name: "Reopen" }).click();
    await expect.poll(async () => (await prisma.request.findUnique({ where: { id: request.id } }))?.status).toBe("open");
    await guards.assertClean();
  });

  test("ask edit form with a blank title says Add a title and keeps the old one", async ({ page }) => {
    const guards = attachGuards(page);
    const { david, haley } = await accountIds();
    const title = `${PREFIX} editable ask`;
    const request = await prisma.request.create({
      data: { title, note: "first note", status: "open", senderAccountId: david, recipientAccountId: haley },
    });

    await page.goto("/today?filter=asks");
    const row = noteRow(page, title);
    await row.getByRole("button", { name: title }).click();
    const titleField = row.getByLabel("Ask title");
    await titleField.fill("   ");
    await row.getByRole("button", { name: "Save", exact: true }).click();
    await expect(row.getByText("Add a title.")).toBeVisible();
    expect((await prisma.request.findUnique({ where: { id: request.id } }))?.title).toBe(title);

    const renamed = `${PREFIX} editable ask 🎉 "q"`;
    await titleField.fill(renamed);
    await row.locator('textarea[name="note"]').fill("");
    await row.getByRole("button", { name: "Save", exact: true }).click();
    await expect.poll(async () => (await prisma.request.findUnique({ where: { id: request.id } }))?.title).toBe(renamed);
    expect((await prisma.request.findUnique({ where: { id: request.id } }))?.note).toBeNull();
    await expect(row.getByText("Add a title.")).toHaveCount(0);
    await guards.assertClean();
  });
});

test.describe("/messages", () => {
  test("new message with a blank subject says what is missing and keeps the form", async ({ page }) => {
    const guards = attachGuards(page);
    const { haley } = await accountIds();
    const before = await prisma.request.count();
    await page.goto("/messages");
    await page.getByRole("button", { name: "New message" }).click();
    await page.locator("#message-to").selectOption(haley);
    await page.locator("#message-title").fill("   ");
    await page.locator("#message-note").fill("hello");
    await page.getByRole("button", { name: "Send", exact: true }).click();

    await expect(page.getByText("Add what it's about.")).toBeVisible();
    await expect(page.locator("#message-title")).toBeVisible();
    await expect(page.locator("#message-note")).toHaveValue("hello");
    expect(await prisma.request.count()).toBe(before);

    await page.locator("#message-title").fill(`${PREFIX} thread`);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.locator("#message-title")).toHaveCount(0);
    await expect.poll(() => prisma.request.count({ where: { title: `${PREFIX} thread`, note: "hello" } })).toBe(1);
    await page.reload();
    await expect(page.getByRole("link", { name: new RegExp(`${PREFIX} thread`) })).toBeVisible();
    await guards.assertClean();
  });

  test("conversation composer: Enter adds a line, Ctrl+Enter sends, the sent text comes back intact", async ({ page }) => {
    const guards = attachGuards(page);
    const { david, haley } = await accountIds();
    const request = await prisma.request.create({
      data: { title: `${PREFIX} conversation`, status: "open", senderAccountId: david, recipientAccountId: haley },
    });
    await page.goto(`/messages/${request.id}`);
    const box = page.getByRole("textbox", { name: "Message" });
    await box.fill("   ");
    await expect(page.getByRole("button", { name: "Send" })).toBeDisabled();
    await box.fill("line one");
    await box.press("Enter");
    await expect(box).toHaveValue("line one\n");
    await box.type("line two 🎉 <b>x</b>");
    await box.press("Control+Enter");
    await expect(box).toHaveValue("");
    await expect.poll(async () => (await prisma.requestMessage.findFirst({ where: { requestId: request.id } }))?.body).toBe(
      "line one\nline two 🎉 <b>x</b>",
    );
    // Firefox aborts a reload that starts while the save's own refresh is still in flight.
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(page.locator(".chat-bubble")).toContainText("line two 🎉 <b>x</b>");
    await expectNoSidewaysScroll(page);
    await guards.assertClean();
  });
});
