import { expect, test, type Page } from "@playwright/test";
import { overnightPrisma } from "./db";
import { attachGuards, expectNoSidewaysScroll } from "./helpers";

/**
 * Field sweep for the Money pages: every box on /money, /money/[itemId] and the
 * read-only money pages gets typed into, cleared, pasted into and reloaded the
 * way a person would. Every test creates the rows it edits, so the file can be
 * re-run against the same local database.
 */
const prisma = overnightPrisma();
const PREFIX = "Sweep money";

async function cleanup() {
  await prisma.budgetItem.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.task.deleteMany({ where: { title: { startsWith: PREFIX } } });
}

test.beforeAll(cleanup);
test.afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

async function createContract(name: string, data: { price: number; amountPaid?: number; note?: string | null }) {
  return prisma.budgetItem.create({
    data: { name, price: data.price, amountPaid: data.amountPaid ?? 0, note: data.note ?? null, sortOrder: 999 },
  });
}

/** The browser's own "what is missing" message on an input, "" when the input is fine. */
async function validationMessage(page: Page, selector: string) {
  return page.locator(selector).evaluate((el) => (el as HTMLInputElement).validationMessage);
}

/** Opens a page and waits for it to be hydrated so the first click is not lost. */
async function open(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  return response;
}

async function waitForSave(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
}

test.describe("/money · Add a contract", () => {
  test("typing a vendor, cents, commas, a date and a two-paragraph note saves exactly and comes back after reload", async ({ page }) => {
    const guards = attachGuards(page);
    const name = `${PREFIX} add <b>x</b> "q" 'a' \`b\` 🎉`;
    await open(page, "/money");
    await page.getByRole("button", { name: "Add a contract" }).click();
    await page.getByLabel("Vendor or contract").fill(name);
    await page.getByLabel("Contract total").pressSequentially("1,000.50");
    await page.getByLabel("Paid so far").pressSequentially("12.5");
    await page.getByLabel("Pay by date").fill("2027-03-04");
    await page.getByLabel("Notes").fill("line one\n\nline three");
    await page.getByRole("button", { name: "Add contract" }).click();
    await waitForSave(page);
    await expect(page.getByRole("button", { name: "Add a contract" })).toBeVisible();

    const saved = await prisma.budgetItem.findFirst({ where: { name } });
    expect(saved?.price).toBe(1000.5);
    expect(saved?.amountPaid).toBe(12.5);
    expect(saved?.note?.replace(/\r\n/g, "\n")).toBe("line one\n\nline three");
    expect(saved?.payByDate && `${saved.payByDate.getFullYear()}-${saved.payByDate.getMonth() + 1}-${saved.payByDate.getDate()}`).toBe("2027-3-4");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toContainText(name);
    await expectNoSidewaysScroll(page);

    // The note keeps its blank line on the contract page instead of collapsing to one line.
    await open(page, `/money/${saved!.id}`);
    const note = page.locator("p", { hasText: "line three" }).first();
    expect(await note.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe("pre-line");
    await expectNoSidewaysScroll(page);
    guards.assertClean();
  });

  test("typing abc or -5 for the contract total says what is wrong instead of adding a $0 contract", async ({ page }) => {
    const guards = attachGuards(page);
    const name = `${PREFIX} add rejects garbage`;
    await open(page, "/money");
    await page.getByRole("button", { name: "Add a contract" }).click();
    await page.getByLabel("Vendor or contract").fill(name);
    await page.getByLabel("Contract total").pressSequentially("abc");
    await page.getByRole("button", { name: "Add contract" }).click();
    await expect(page.getByLabel("Contract total")).toBeVisible();
    expect(await validationMessage(page, 'input[name="price"]')).toContain("Enter a number");
    expect(await prisma.budgetItem.count({ where: { name } })).toBe(0);

    await page.getByLabel("Contract total").fill("-5");
    await page.getByRole("button", { name: "Add contract" }).click();
    await expect(page.getByLabel("Contract total")).toBeVisible();
    expect(await validationMessage(page, 'input[name="price"]')).toContain("negative");
    expect(await prisma.budgetItem.count({ where: { name } })).toBe(0);

    // 0, clear, 9: the box and the saved value are 9.
    const total = page.getByLabel("Contract total");
    await total.fill("");
    await total.pressSequentially("0");
    await total.press("Backspace");
    await total.pressSequentially("9");
    await expect(total).toHaveValue("9");
    await page.getByRole("button", { name: "Add contract" }).click();
    await waitForSave(page);
    expect((await prisma.budgetItem.findFirst({ where: { name } }))?.price).toBe(9);
    guards.assertClean();
  });

  test("submitting with an empty vendor name says it is required and Cancel closes without saving", async ({ page }) => {
    const guards = attachGuards(page);
    const before = await prisma.budgetItem.count();
    await open(page, "/money");
    await page.getByRole("button", { name: "Add a contract" }).click();
    await page.getByLabel("Contract total").fill("5");
    await page.getByRole("button", { name: "Add contract" }).click();
    await expect(page.getByLabel("Vendor or contract")).toBeVisible();
    expect(await validationMessage(page, 'input[name="name"]')).not.toBe("");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("button", { name: "Add a contract" })).toBeVisible();
    expect(await prisma.budgetItem.count()).toBe(before);
    guards.assertClean();
  });
});

test.describe("/money/[itemId] · Edit contract", () => {
  test("clearing the price says Enter an amount and keeps the contract instead of saving $0", async ({ page }) => {
    const guards = attachGuards(page);
    const contract = await createContract(`${PREFIX} edit price`, { price: 1250, amountPaid: 100 });
    await open(page, `/money/${contract.id}`);
    await page.getByRole("button", { name: "Edit contract" }).click();
    const price = page.locator('input[name="price"]');
    await expect(price).toHaveValue("1250");

    // Backspace one character at a time to empty, then Save.
    await price.click();
    await price.press("End");
    for (let i = 0; i < 4; i += 1) await price.press("Backspace");
    await expect(price).toHaveValue("");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(price).toBeVisible();
    expect(await validationMessage(page, 'input[name="price"]')).toBe("Enter an amount");
    expect((await prisma.budgetItem.findUnique({ where: { id: contract.id } }))?.price).toBe(1250);

    // 0, clear, 9: saves 9.
    await price.pressSequentially("0");
    await price.press("Backspace");
    await price.pressSequentially("9");
    await expect(price).toHaveValue("9");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await waitForSave(page);
    await expect(page.getByText("$9 contract")).toBeVisible();
    expect((await prisma.budgetItem.findUnique({ where: { id: contract.id } }))?.price).toBe(9);
    guards.assertClean();
  });

  test("clearing Paid so far saves nothing paid and the box comes back empty, not 0", async ({ page }) => {
    const guards = attachGuards(page);
    const contract = await createContract(`${PREFIX} edit paid`, { price: 500, amountPaid: 100 });
    await open(page, `/money/${contract.id}`);
    await page.getByRole("button", { name: "Edit contract" }).click();
    const paid = page.locator('input[name="amountPaid"]');
    await expect(paid).toHaveValue("100");
    await paid.fill("");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await waitForSave(page);
    await expect(page.getByRole("button", { name: "Edit contract" })).toBeVisible();
    expect((await prisma.budgetItem.findUnique({ where: { id: contract.id } }))?.amountPaid).toBe(0);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Edit contract" }).click();
    await expect(page.locator('input[name="amountPaid"]')).toHaveValue("");
    // Typing abc is refused rather than saved as $0.
    await page.locator('input[name="amountPaid"]').pressSequentially("abc");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    expect(await validationMessage(page, 'input[name="amountPaid"]')).toContain("Enter a number");
    // 12.50 keeps its cents.
    await page.locator('input[name="amountPaid"]').fill("12.50");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await waitForSave(page);
    expect((await prisma.budgetItem.findUnique({ where: { id: contract.id } }))?.amountPaid).toBe(12.5);
    guards.assertClean();
  });

  test("blanking the contract name is refused instead of closing the form as if saved", async ({ page }) => {
    const guards = attachGuards(page);
    const contract = await createContract(`${PREFIX} edit name`, { price: 300 });
    await open(page, `/money/${contract.id}`);
    await page.getByRole("button", { name: "Edit contract" }).click();
    const name = page.locator('input[name="name"]');
    await name.fill("");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(name).toBeVisible();
    expect(await validationMessage(page, 'input[name="name"]')).not.toBe("");
    await name.fill("   ");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(name).toBeVisible();
    expect(await validationMessage(page, 'input[name="name"]')).toBe("Enter a name");
    await name.fill(`${PREFIX} edit name renamed 🎉`);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await waitForSave(page);
    await expect(page.getByRole("button", { name: "Edit contract" })).toBeVisible();
    expect((await prisma.budgetItem.findUnique({ where: { id: contract.id } }))?.name).toBe(`${PREFIX} edit name renamed 🎉`);
    guards.assertClean();
  });

  test("owner, payer, pay-by date and a long note save and survive reload; Escape and Cancel discard; Remove contract asks first", async ({ page }) => {
    const guards = attachGuards(page);
    const contract = await createContract(`${PREFIX} edit selects`, { price: 300 });
    const longNote = "Test note ".repeat(200).trim();
    await open(page, `/money/${contract.id}`);
    await page.getByRole("button", { name: "Edit contract" }).click();
    await page.locator('select[name="ownerId"]').selectOption("haley");
    await page.locator('select[name="paidById"]').selectOption("david");
    await page.locator('input[name="payByDate"]').fill("2027-01-15");
    await page.locator('textarea[name="note"]').fill(longNote);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await waitForSave(page);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toContainText(/Owner Haley/);
    await expect(page.locator("body")).toContainText(/Paid by David/);
    await expectNoSidewaysScroll(page);
    const saved = await prisma.budgetItem.findUnique({ where: { id: contract.id } });
    expect(saved?.ownerId).toBe("haley");
    expect(saved?.paidById).toBe("david");
    expect(saved?.note).toBe(longNote);
    expect(saved?.payByDate?.getDate()).toBe(15);

    await page.getByRole("button", { name: "Edit contract" }).click();
    await expect(page.locator('select[name="ownerId"]')).toHaveValue("haley");
    await expect(page.locator('input[name="payByDate"]')).toHaveValue("2027-01-15");
    await page.locator('textarea[name="note"]').fill("discarded");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("button", { name: "Edit contract" })).toBeVisible();
    expect((await prisma.budgetItem.findUnique({ where: { id: contract.id } }))?.note).toBe(longNote);

    // Remove contract asks first, then goes back to the Money page without the contract.
    await page.getByRole("button", { name: "Edit contract" }).click();
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "Remove contract" }).click();
    await page.waitForTimeout(500);
    expect(await prisma.budgetItem.count({ where: { id: contract.id } })).toBe(1);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Remove contract" }).click();
    await page.waitForURL(/\/money$/);
    await expect(page.locator("body")).not.toContainText(`${PREFIX} edit selects`);
    expect(await prisma.budgetItem.count({ where: { id: contract.id } })).toBe(0);
    guards.assertClean();
  });
});

test.describe("/money/[itemId] · Payment schedule", () => {
  test("adding a payment with abc, 0 or -5 as the amount says so and keeps the form open", async ({ page }) => {
    const guards = attachGuards(page);
    const contract = await createContract(`${PREFIX} payment garbage`, { price: 1000 });
    await open(page, `/money/${contract.id}`);
    await page.getByRole("button", { name: "Add a payment" }).click();
    const amount = page.locator('input[name="amount"]');
    await page.locator('input[name="label"]').fill("Deposit");
    for (const [typed, expected] of [
      ["abc", "Enter a number"],
      ["0", "greater than $0"],
      ["-5", "negative"],
      ["", "Enter an amount"],
    ] as const) {
      await amount.fill(typed);
      await page.getByRole("button", { name: "Add payment" }).click();
      await expect(amount, `form stays open after typing "${typed}"`).toBeVisible();
      if (typed) expect(await validationMessage(page, 'input[name="amount"]')).toContain(expected);
      else expect(await validationMessage(page, 'input[name="amount"]')).not.toBe("");
      expect(await prisma.budgetPayment.count({ where: { budgetItemId: contract.id } })).toBe(0);
    }

    await amount.fill("$1,250.50");
    await page.locator('input[name="dueDate"]').fill("2027-02-02");
    await page.locator('textarea[name="note"]').fill("Test note\n\nsecond");
    await page.getByRole("button", { name: "Add payment" }).click();
    await waitForSave(page);
    await expect(page.getByRole("button", { name: "Add a payment" })).toBeVisible();
    const payment = await prisma.budgetPayment.findFirst({ where: { budgetItemId: contract.id } });
    expect(payment?.amount).toBe(1250.5);
    expect(payment?.label).toBe("Deposit");
    expect(payment?.paidAmount).toBe(0);
    expect(payment?.dueDate?.getDate()).toBe(2);
    await expect(page.locator("body")).toContainText("Deposit");
    await expectNoSidewaysScroll(page);
    guards.assertClean();
  });

  test("editing the label of a partly paid payment keeps what was already paid instead of resetting it to $0", async ({ page }) => {
    const guards = attachGuards(page);
    const contract = await createContract(`${PREFIX} partial payment`, { price: 1000 });
    const paidAt = new Date("2026-09-01T12:00:00");
    const payment = await prisma.budgetPayment.create({
      data: { budgetItemId: contract.id, label: "Second", amount: 100, paidAmount: 40, paidAt, sortOrder: 0 },
    });
    await open(page, `/money/${contract.id}`);
    await expect(page.locator("body")).toContainText("$60");
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.locator('input[name="paid"]')).not.toBeChecked();
    await page.locator('input[name="label"]').fill("Second (edited)");
    await page.getByRole("button", { name: "Save payment" }).click();
    await waitForSave(page);
    const saved = await prisma.budgetPayment.findUnique({ where: { id: payment.id } });
    expect(saved?.label).toBe("Second (edited)");
    expect(saved?.paidAmount).toBe(40);
    expect(saved?.paidAt?.getTime()).toBe(paidAt.getTime());
    await expect(page.locator("body")).toContainText("$60");
    guards.assertClean();
  });

  test("ticking Paid pays the whole amount, unticking it on a paid payment un-pays it, Mark paid and Remove work", async ({ page }) => {
    const guards = attachGuards(page);
    const contract = await createContract(`${PREFIX} paid toggle`, { price: 1000 });
    const payment = await prisma.budgetPayment.create({
      data: { budgetItemId: contract.id, label: "Final", amount: 250, paidAmount: 0, sortOrder: 0 },
    });
    await open(page, `/money/${contract.id}`);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.locator('input[name="paid"]').check();
    await page.locator('input[name="paidAt"]').fill("2026-10-01");
    await page.getByRole("button", { name: "Save payment" }).click();
    await waitForSave(page);
    let saved = await prisma.budgetPayment.findUnique({ where: { id: payment.id } });
    expect(saved?.paidAmount).toBe(250);
    expect(saved?.paidAt?.getDate()).toBe(1);
    await expect(page.locator("body")).toContainText("History");
    await expect(page.locator("body")).toContainText("$250 paid");

    // Un-pay it from the History row.
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.locator('input[name="paid"]')).toBeChecked();
    await page.locator('input[name="paid"]').uncheck();
    await page.getByRole("button", { name: "Save payment" }).click();
    await waitForSave(page);
    saved = await prisma.budgetPayment.findUnique({ where: { id: payment.id } });
    expect(saved?.paidAmount).toBe(0);
    expect(saved?.paidAt).toBeNull();

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Mark paid" }).click();
    await waitForSave(page);
    saved = await prisma.budgetPayment.findUnique({ where: { id: payment.id } });
    expect(saved?.paidAmount).toBe(250);

    // See SWEEP-REPORT.md #13: router.refresh() after an action occasionally never settles,
    // which leaves the row's buttons disabled; a reload shows the saved state regardless.
    await page.reload({ waitUntil: "domcontentloaded" });
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Remove", exact: true }).click();
    await waitForSave(page);
    expect(await prisma.budgetPayment.count({ where: { id: payment.id } })).toBe(0);
    guards.assertClean();
  });
});

test.describe("/money · Other spending", () => {
  test("Needed and Spent save cents, refuse abc, and clearing them comes back empty", async ({ page }) => {
    const guards = attachGuards(page);
    const title = `${PREFIX} minor expense`;
    const task = await prisma.task.create({ data: { title, amountSpent: 5 } });
    await open(page, "/money");
    await page.getByRole("button", { name: title }).click();
    const needed = page.locator('input[name="amountNeeded"]');
    const spent = page.locator('input[name="amountSpent"]');
    await expect(spent).toHaveValue("5");
    await needed.pressSequentially("abc");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(needed).toBeVisible();
    expect(await validationMessage(page, 'input[name="amountNeeded"]')).toContain("Enter a number");

    await needed.fill("12.50");
    await spent.fill("");
    await spent.pressSequentially("0");
    await spent.press("Backspace");
    await spent.pressSequentially("9");
    await expect(spent).toHaveValue("9");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await waitForSave(page);
    let saved = await prisma.task.findUnique({ where: { id: task.id } });
    expect(saved?.amountNeeded).toBe(12.5);
    expect(saved?.amountSpent).toBe(9);
    // The list refreshes after Save; a reload makes sure the row below is the saved one.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toContainText("$9 spent of $13");

    await page.getByRole("button", { name: title }).click();
    await expect(page.locator('input[name="amountNeeded"]')).toHaveValue("12.5");
    await page.locator('input[name="amountNeeded"]').fill("");
    await page.locator('input[name="amountSpent"]').fill("");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await waitForSave(page);
    saved = await prisma.task.findUnique({ where: { id: task.id } });
    expect(saved?.amountNeeded).toBeNull();
    expect(saved?.amountSpent).toBe(0);
    // With nothing needed and nothing spent the row leaves the Money page; it is still the task's data.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: title })).toHaveCount(0);
    await expectNoSidewaysScroll(page);
    guards.assertClean();
  });
});

test.describe("/money/due, /money/history, /money/print", () => {
  test("the read-only money pages open with the test contract, without errors or sideways scroll", async ({ page }) => {
    const guards = attachGuards(page);
    const contract = await createContract(`${PREFIX} read only`, { price: 800, amountPaid: 200 });
    await prisma.budgetItem.update({ where: { id: contract.id }, data: { payByDate: new Date("2027-04-01T12:00:00") } });
    for (const path of ["/money/due", "/money/history", "/money/print", "/money"]) {
      const response = await open(page, path);
      expect(response?.status() ?? 0, `${path} status`).toBeLessThan(400);
      await expect(page.locator("body")).not.toContainText(/Something went wrong|Application error/);
      await page.waitForLoadState("networkidle").catch(() => undefined);
      await expectNoSidewaysScroll(page);
    }
    await expect(page.locator("body")).toContainText(`${PREFIX} read only`);
    guards.assertClean();
  });
});
