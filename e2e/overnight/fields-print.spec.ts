import { expect, test, type Page } from "@playwright/test";
import { compare, hash } from "bcryptjs";
import { AUTO_APPLIED_ORIGINS, overnightPrisma } from "./db";
import { attachGuards, expectNoSidewaysScroll, PACKETS } from "./helpers";

/**
 * Field sweep for the print / accounts / more / no-access / login / offline area.
 * Every test creates what it edits; accounts it makes start with "Sweep " and are removed again.
 */
const prisma = overnightPrisma();
// Signed out, but a PIN typed here signs in as David, so his first page must not apply the cards.
const NO_COOKIE = { cookies: [], origins: AUTO_APPLIED_ORIGINS };
const RESTRICTED_PIN = "4320";
const RESTRICTED_NAME = "Sweep no modules";
const LONG_PIN_NAME = "Sweep long pin";
const LONG_PIN = "13572468";
const NO_MODULES = {
  canSeeTasks: false,
  canSeeBudget: false,
  canSeeGuests: false,
  canSeeTimeline: false,
  canManageAccounts: false,
  canSeeShop: false,
  canSeeCalendar: false,
  canSeePeople: false,
  canSeeRequests: false,
  canSeeStay: false,
  canSeeDinner: false,
  canEditDinner: false,
  canEditRehearsal: false,
  canEditBudget: false,
  canEditTimeline: false,
};
const DANGER = "p.text-sm.text-\\[var\\(--danger\\)\\]";

async function cleanSweepAccounts() {
  await prisma.pinAccount.deleteMany({ where: { name: { startsWith: "Sweep" } } });
}

test.beforeAll(async () => {
  await cleanSweepAccounts();
  await prisma.pinAccount.create({
    // The schema defaults several modules on, so every flag is off here on purpose.
    data: {
      name: RESTRICTED_NAME,
      pinHash: await hash(RESTRICTED_PIN, 10),
      isMaster: false,
      ...NO_MODULES,
    },
  });
  await prisma.pinAccount.create({
    data: { name: LONG_PIN_NAME, pinHash: await hash(LONG_PIN, 10), isMaster: false, canSeeTasks: true },
  });
});
test.afterAll(async () => {
  await cleanSweepAccounts();
  await prisma.$disconnect();
});

/** The shared test Postgres is busy with every worker; a "database waking up" page gets one more try. */
async function gotoReady(page: Page, path: string) {
  for (let attempt = 0; attempt < 6; attempt++) {
    await page.goto(path);
    if ((await page.getByText("This page couldn’t load").count()) === 0) return;
    await page.waitForTimeout(3000);
  }
  throw new Error(`${path} kept showing the database-waking page`);
}

async function tapPin(page: Page, pin: string) {
  for (const digit of pin.split("")) await page.getByRole("button", { name: digit, exact: true }).click();
}

/** The pad's own error line (Next's route announcer is also role=alert). */
function pinAlert(page: Page) {
  return page.locator('p[role="alert"]');
}

/** Dots with a colour behind them. Read from the computed style: Safari reports an inline
 *  `transparent` as `rgba(0, 0, 0, 0)`, so the inline value cannot be compared across engines. */
function filledDots(page: Page) {
  return page
    .locator('[aria-label="PIN length"] span')
    .evaluateAll((els) =>
      els.filter((el) => {
        const colour = getComputedStyle(el).backgroundColor;
        return colour !== "transparent" && colour !== "rgba(0, 0, 0, 0)";
      }).length,
    );
}

// ---------------------------------------------------------------------------------------------
// Login page (no session cookie)
// ---------------------------------------------------------------------------------------------
test.describe("login page PIN pad", () => {
  test.use({ storageState: NO_COOKIE });

  test("wrong PIN says Incorrect PIN and clears the pad, twice in a row", async ({ page }) => {
    const guards = attachGuards(page);
    await gotoReady(page, "/");
    await expect(page.getByText("Enter your PIN")).toBeVisible();
    await tapPin(page, "1234");
    await expect(pinAlert(page)).toHaveText("Incorrect PIN");
    expect(await filledDots(page)).toBe(0);
    await tapPin(page, "1234");
    await expect(pinAlert(page)).toHaveText("Incorrect PIN");
    await expect.poll(() => filledDots(page)).toBe(0);
    expect(page.url()).toMatch(/\/$/);
    await guards.assertClean();
  });

  test("backspace removes the last digit and the fourth digit unlocks David (0425)", async ({ page }) => {
    const guards = attachGuards(page);
    await gotoReady(page, "/");
    await tapPin(page, "12");
    await page.getByRole("button", { name: "Backspace" }).click();
    expect(await filledDots(page)).toBe(1);
    await page.getByRole("button", { name: "Backspace" }).click();
    expect(await filledDots(page)).toBe(0);
    await page.getByRole("button", { name: "Backspace" }).click();
    expect(await filledDots(page)).toBe(0);
    await tapPin(page, "0425");
    await page.waitForURL(/\/today/, { timeout: 20_000 });
    await guards.assertClean();
  });

  test("Haley's PIN 1016 unlocks and the Log out button returns to the pad without a session", async ({ page, context }) => {
    // Safari brings the logged-out page back from history and logs its own line for the 401 its sync then gets.
    const guards = attachGuards(page, { allow: /status of 401/ });
    await gotoReady(page, "/");
    await tapPin(page, "1016");
    await page.waitForURL(/\/today/, { timeout: 20_000 });
    await page.getByRole("button", { name: "Log out" }).first().click();
    await page.waitForURL(/\/$/, { timeout: 20_000 });
    await expect(page.getByText("Enter your PIN")).toBeVisible();
    expect((await context.cookies()).map((c) => c.name)).toEqual([]);
    await page.goBack();
    await expect(page.getByText("Enter your PIN")).toBeVisible();
    await guards.assertClean();
  });

  test("fast taps of 0999 (Mother in law) land on her first allowed page", async ({ page }) => {
    const guards = attachGuards(page);
    await gotoReady(page, "/");
    // The first tap waits for the pad to be live; the rest fire as fast as a thumb can.
    await page.getByRole("button", { name: "0", exact: true }).click();
    await expect.poll(() => filledDots(page)).toBe(1);
    for (const digit of "999".split("")) {
      void page.getByRole("button", { name: digit, exact: true }).click({ noWaitAfter: true });
    }
    await page.waitForURL(/\/(today|plan|people|day|more)/, { timeout: 20_000 });
    await expect(page.locator("body")).not.toContainText("Enter your PIN");
    await guards.assertClean();
  });

  test("keyboard digits, Enter and Escape do nothing harmful on the pad", async ({ page }) => {
    const guards = attachGuards(page);
    await gotoReady(page, "/");
    await page.keyboard.type("0425");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(800);
    expect(page.url()).toMatch(/\/$/);
    await expect(pinAlert(page)).toHaveCount(0);
    await tapPin(page, "0425");
    await page.waitForURL(/\/today/, { timeout: 20_000 });
    await guards.assertClean();
  });

  test("an account with no modules lands on /no-access and cannot open /accounts", async ({ page, context }) => {
    // Leaving a page cuts the automatic offline sync's fetch short; that abort is not an app error.
    const guards = attachGuards(page, { allow: /Failed to fetch/ });
    await gotoReady(page, "/");
    await tapPin(page, RESTRICTED_PIN);
    await page.waitForURL(/\/no-access/, { timeout: 20_000 });
    // The unlock's page comes back in the same response; the next full load needs the stored cookie.
    expect((await context.cookies()).map((c) => c.name), "session cookie stored after unlock").toContain("ws_session");
    await expect(page.locator("body")).toContainText("does not have permission");
    await expectNoSidewaysScroll(page);
    // toHaveURL names the page actually landed on when it is not /no-access.
    await page.goto("/accounts");
    await expect(page).toHaveURL(/\/no-access/, { timeout: 20_000 });
    await page.goto("/today");
    await expect(page).toHaveURL(/\/no-access/, { timeout: 20_000 });
    await page.getByRole("button", { name: "Log out" }).click();
    await page.waitForURL(/\/$/, { timeout: 20_000 });
    await expect(page.getByText("Enter your PIN")).toBeVisible();
    await guards.assertClean();
  });

  // Judgement call for David (SWEEP-REPORT.md #2): the editor accepts 5–8 digit PINs, but the pad
  // auto-submits at the 4th digit and clears on the wrong-PIN result, so a longer PIN can never be
  // entered. This documents the trap until the product decision is made.
  test.fixme("an 8-digit PIN can be entered and unlocked from the pad", async ({ page }) => {
    await gotoReady(page, "/");
    await tapPin(page, LONG_PIN);
    await expect(page.getByRole("button", { name: /^Unlock/ })).toBeVisible();
    await page.getByRole("button", { name: /^Unlock/ }).click();
    await page.waitForURL(/\/today/, { timeout: 20_000 });
  });
});

// ---------------------------------------------------------------------------------------------
// /accounts
// ---------------------------------------------------------------------------------------------
test.describe("accounts editor", () => {
  const CREATED = "Sweep 🎉 \"quote\" 'single' `tick` <b>x</b>";

  test("add account: every field saves, comes back on reload and in the editor", async ({ page }) => {
    const guards = attachGuards(page);
    await gotoReady(page, "/accounts");
    await page.getByRole("button", { name: "Add account" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill(`  ${CREATED}  `);
    const pin = dialog.getByLabel("PIN", { exact: true });
    await pin.type("0");
    await pin.fill("");
    await pin.type("9");
    await expect(pin).toHaveValue("9");
    await pin.fill("");
    await pin.type("12345678", { delay: 0 });
    await expect(pin).toHaveValue("12345678");
    for (let i = 0; i < 8; i++) await pin.press("Backspace");
    await expect(pin).toHaveValue("");
    await pin.fill("7778");
    await dialog.getByLabel("Linked person").selectOption({ index: 1 });
    const linkedId = await dialog.getByLabel("Linked person").inputValue();
    expect(linkedId).not.toBe("");
    await dialog.getByRole("button", { name: /^Vendor/ }).click();
    await dialog.getByLabel("Guests see").check();
    await expect(dialog.locator("button.role-card[data-active=true]")).toContainText("Custom");
    const taskFilter = dialog.locator("fieldset", { hasText: "Task filter" }).locator("input[type=checkbox]").first();
    await taskFilter.check();
    const sharedTask = dialog.locator("fieldset", { hasText: "Shared tasks" }).locator("input[type=checkbox]").first();
    const hasTasks = (await sharedTask.count()) > 0;
    if (hasTasks) await sharedTask.check();
    // Preview tabs opens on top; Escape closes only the preview and keeps the typed name.
    await dialog.getByRole("button", { name: "Preview tabs" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(2);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await expect(page.getByRole("dialog").getByLabel("Name")).toHaveValue(`  ${CREATED}  `);
    await page.getByRole("dialog").getByRole("button", { name: "Add account" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 20_000 });

    const row = await prisma.pinAccount.findFirst({ where: { name: CREATED }, include: { taskShares: true } });
    expect(row, "account saved with the trimmed name").not.toBeNull();
    expect(row!.linkedPersonId).toBe(linkedId);
    expect(row!.canSeeGuests).toBe(true);
    expect(row!.canSeeTimeline).toBe(true);
    expect(row!.canSeeTasks).toBe(false);
    expect(JSON.parse(row!.assigneeFilterJson ?? "[]")).toHaveLength(1);
    if (hasTasks) expect(row!.taskShares).toHaveLength(1);

    await page.reload();
    const card = page.locator("article", { hasText: CREATED });
    await expect(card).toBeVisible();
    await expect(card).toContainText("Custom");
    await expect(card).toContainText("Linked:");
    await expect(card).toContainText("Filter:");
    await card.getByRole("button", { name: "Edit" }).click();
    const editor = page.getByRole("dialog");
    await expect(editor.getByLabel("Name")).toHaveValue(CREATED);
    await expect(editor.getByLabel("New PIN (optional reset)")).toHaveValue("");
    await expect(editor.getByLabel("Linked person")).toHaveValue(linkedId);
    await expect(editor.getByLabel("Guests see")).toBeChecked();
    await expect(editor.locator("fieldset", { hasText: "Task filter" }).locator("input:checked")).toHaveCount(1);
    await expectNoSidewaysScroll(page);
    await guards.assertClean();
  });

  test("edit: a non-digit PIN reset says PIN must be 4–8 digits instead of a production error blob", async ({ page }) => {
    const guards = attachGuards(page);
    await gotoReady(page, "/accounts");
    await page.locator("article", { hasText: CREATED }).getByRole("button", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("New PIN (optional reset)").fill("abc");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(dialog.locator(DANGER)).toHaveText("PIN must be 4–8 digits");
    await expect(dialog).toBeVisible();
    await guards.assertClean();
  });

  test("edit: required name, whitespace-only name, 3-digit and 9-digit PINs are refused with a message", async ({ page }) => {
    const guards = attachGuards(page);
    await gotoReady(page, "/accounts");
    await page.getByRole("button", { name: "Add account" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Add account" }).click();
    await expect(dialog.locator(DANGER)).toHaveText("Name is required");
    await dialog.getByLabel("Name").fill("   ");
    await dialog.getByRole("button", { name: "Add account" }).click();
    await expect(dialog.locator(DANGER)).toHaveText("Name is required");
    await dialog.getByLabel("Name").fill("Sweep temp");
    await dialog.getByRole("button", { name: "Add account" }).click();
    await expect(dialog.locator(DANGER)).toHaveText("PIN must be 4–8 digits");
    await dialog.getByLabel("PIN", { exact: true }).fill("007");
    await dialog.getByRole("button", { name: "Add account" }).click();
    await expect(dialog.locator(DANGER)).toHaveText("PIN must be 4–8 digits");
    await dialog.getByLabel("PIN", { exact: true }).fill("123456789");
    await dialog.getByRole("button", { name: "Add account" }).click();
    await expect(dialog.locator(DANGER)).toHaveText("PIN must be 4–8 digits");
    // Enter inside a field neither submits nor loses the text; Escape closes the editor.
    await dialog.getByLabel("Name").press("Enter");
    await expect(dialog.getByLabel("Name")).toHaveValue("Sweep temp");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await prisma.pinAccount.count({ where: { name: "Sweep temp" } })).toBe(0);
    await guards.assertClean();
  });

  test("edit: a 2000-character name saves, shows and does not scroll sideways; unlinking and unchecking everything saves as empty", async ({ page }) => {
    const guards = attachGuards(page);
    const LONG = `Sweep ${"L".repeat(1994)}`;
    await gotoReady(page, "/accounts");
    await page.locator("article", { hasText: CREATED }).getByRole("button", { name: "Edit" }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill(LONG);
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 20_000 });
    await page.reload();
    await expect(page.locator("article", { hasText: "LLLL" })).toBeVisible();
    await expectNoSidewaysScroll(page);
    expect((await prisma.pinAccount.findFirst({ where: { name: LONG } }))?.name).toBe(LONG);

    await page.locator("article", { hasText: "LLLL" }).getByRole("button", { name: "Edit" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("Sweep renamed");
    await dialog.getByLabel("Linked person").selectOption("");
    await dialog.getByRole("button", { name: /^Custom/ }).click();
    while ((await dialog.locator("input[type=checkbox]:checked").count()) > 0) {
      await dialog.locator("input[type=checkbox]:checked").first().uncheck();
    }
    await expect(dialog.locator(".border-t span").first()).toHaveText(/module change/);
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 20_000 });
    const row = await prisma.pinAccount.findFirst({ where: { name: "Sweep renamed" }, include: { taskShares: true } });
    expect(row).not.toBeNull();
    expect(row!.linkedPersonId).toBeNull();
    expect(row!.assigneeFilterJson).toBeNull();
    expect(row!.canSeeGuests).toBe(false);
    expect(row!.canSeeTimeline).toBe(false);
    expect(row!.taskShares).toHaveLength(0);
    // The New PIN field was left blank twice, so the PIN from Add account still unlocks this account.
    expect(await compare("7778", row!.pinHash)).toBe(true);
    await page.reload();
    await expect(page.locator("article", { hasText: "Sweep renamed" })).not.toContainText("Linked:");
    await guards.assertClean();
  });

  test("duplicate seeds '(copy)', delete asks first and only deletes on OK", async ({ page }) => {
    const guards = attachGuards(page);
    await gotoReady(page, "/accounts");
    await page.locator("article", { hasText: "Sweep renamed" }).getByRole("button", { name: "Duplicate" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator("h2")).toHaveText("Add account");
    await expect(dialog.getByLabel("Name")).toHaveValue("Sweep renamed (copy)");
    await dialog.getByLabel("PIN", { exact: true }).fill("4329");
    await dialog.getByRole("button", { name: "Add account" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 20_000 });
    expect(await prisma.pinAccount.count({ where: { name: "Sweep renamed (copy)" } })).toBe(1);

    await gotoReady(page, "/accounts");
    const copy = page.locator("article", { hasText: "Sweep renamed (copy)" });
    await expect(copy).toBeVisible();
    await copy.getByRole("button", { name: "Edit" }).click();
    page.once("dialog", (confirm) => confirm.dismiss());
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    expect(await prisma.pinAccount.count({ where: { name: "Sweep renamed (copy)" } })).toBe(1);
    page.once("dialog", (confirm) => confirm.accept());
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 20_000 });
    await expect(copy).toHaveCount(0);
    expect(await prisma.pinAccount.count({ where: { name: "Sweep renamed (copy)" } })).toBe(0);

    // The master card has no Duplicate or Delete, and its editor keeps everything on.
    const master = page.locator("article", { hasText: "Master" }).first();
    await expect(master.getByRole("button", { name: "Duplicate" })).toHaveCount(0);
    await master.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("dialog")).toContainText("Master accounts always have full access");
    await expect(page.getByRole("dialog").getByRole("button", { name: "Delete" })).toHaveCount(0);
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await guards.assertClean();
  });
});

// ---------------------------------------------------------------------------------------------
// /print
// ---------------------------------------------------------------------------------------------
test.describe("print center", () => {
  test("every packet opens, is highlighted and prints; sections toggle; reload returns to the binder", async ({ page }) => {
    const guards = attachGuards(page);
    await page.addInitScript(() => {
      (window as unknown as { __prints: number }).__prints = 0;
      window.print = () => {
        (window as unknown as { __prints: number }).__prints += 1;
      };
    });
    await gotoReady(page, "/print");
    for (const packet of PACKETS) {
      const card = page.getByTestId(`print-preset-${packet.id}`);
      await card.click();
      await expect(card).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator('[data-testid^="print-preset-"][aria-pressed="true"]')).toHaveCount(1);
      await expect(page.locator(".binder-kicker").first()).toHaveText(packet.kicker);
      expect(await page.locator("input[data-print-section]:checked").count()).toBeGreaterThan(0);
      await page.getByTestId("print-save-pdf").click();
    }
    expect(await page.evaluate(() => (window as unknown as { __prints: number }).__prints)).toBe(PACKETS.length);

    await page.getByTestId("print-preset-binder").click();
    const boxes = page.locator("input[data-print-section]");
    const count = await boxes.count();
    for (let i = 0; i < count; i++) {
      const box = boxes.nth(i);
      const was = await box.isChecked();
      await box.click();
      await expect(box).toBeChecked({ checked: !was });
      await box.click();
      await expect(box).toBeChecked({ checked: was });
    }
    for (let i = 0; i < count; i++) if (await boxes.nth(i).isChecked()) await boxes.nth(i).click();
    await expect(page.locator("input[data-print-section]:checked")).toHaveCount(0);
    await expect(page.locator(".binder-doc > *")).toHaveCount(1);
    await expectNoSidewaysScroll(page);
    await page.reload();
    await expect(page.getByTestId("print-preset-binder")).toHaveAttribute("aria-pressed", "true");
    expect(await page.locator("input[data-print-section]:checked").count()).toBeGreaterThan(0);
    await guards.assertClean();
  });
});

// ---------------------------------------------------------------------------------------------
// /more, /offline, /no-access
// ---------------------------------------------------------------------------------------------
test.describe("more, offline and no-access", () => {
  test("more: the install guide opens from Add to Home Screen and closes on Escape and on Close", async ({ page }) => {
    const guards = attachGuards(page);
    await gotoReady(page, "/more");
    await expect(page.getByRole("link", { name: /Wedding Binder & Print/ })).toBeVisible();
    const add = page.getByRole("button", { name: /Add to Home Screen|Install app/ });
    await add.click();
    await expect(page.getByRole("dialog", { name: "Add WeddingSquirrels to your phone" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await add.click();
    await page.getByRole("button", { name: "Close install guide" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expectNoSidewaysScroll(page);
    await guards.assertClean();
  });

  test("more: Update now refreshes the offline copy and Open offline copy shows its tabs", async ({ page }) => {
    const guards = attachGuards(page);
    await gotoReady(page, "/more");
    await expect(page.getByRole("status")).toContainText(/Offline copy ready|Saving your offline copy/, { timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Update now" })).toBeEnabled({ timeout: 20_000 });
    await page.getByRole("button", { name: "Update now" }).click();
    await expect(page.getByRole("status")).toContainText(/Offline copy ready/, { timeout: 20_000 });
    await page.getByRole("link", { name: "Open offline copy" }).click();
    await page.waitForURL(/\/offline/);
    const tabs = page.locator(".filter-pill");
    await expect(tabs.first()).toBeVisible({ timeout: 20_000 });
    const n = await tabs.count();
    for (let i = 0; i < n; i++) {
      await tabs.nth(i).click();
      await expect(tabs.nth(i)).toHaveAttribute("data-active", "true");
    }
    await expectNoSidewaysScroll(page);
    await page.getByRole("link", { name: "← Back to app" }).click();
    await page.waitForURL(/\/today/);
    await guards.assertClean();
  });

  test("no-access renders for a master and offers Log out", async ({ page }) => {
    const guards = attachGuards(page);
    await gotoReady(page, "/no-access");
    await expect(page.locator("body")).toContainText("does not have permission");
    await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
    await expectNoSidewaysScroll(page);
    await guards.assertClean();
  });
});
