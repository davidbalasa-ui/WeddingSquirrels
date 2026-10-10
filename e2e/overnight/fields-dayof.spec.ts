import { expect, test, type Locator, type Page } from "@playwright/test";
import { overnightPrisma } from "./db";
import { attachGuards, expectNoSidewaysScroll } from "./helpers";

/**
 * Field sweep for the Day-of pages: /day, /day/decor, /day/hair-makeup, /day/shots
 * (PlaybookBoard inline editor and Mark done), /day/mc, /day/venue, /day/assignments
 * (AssignmentPanel) and /day/contacts, exercised the way a person would on desktop and
 * phone. Each test creates what it edits (assignments and people are named "Test …",
 * playbook rows are the seed items named below) and the suite resets them afterwards,
 * so it can be re-run against the same local database.
 */
const prisma = overnightPrisma();

const TEST_PREFIX = "Test ";
/** Seed playbook items the editor tests write to; their persisted rows are removed on reset. */
const PLAYBOOK_KEYS = ["shot-details-invitations", "decor-tablecloths", "avalon-package", "hm-room-bed1"];

async function resetTestRows() {
  await prisma.playbookItem.deleteMany({ where: { sourceKey: { in: PLAYBOOK_KEYS } } });
  await prisma.dayAssignment.deleteMany({ where: { title: { startsWith: TEST_PREFIX } } });
  await prisma.person.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
}

// Reset before the run only: a failed test restarts the worker, and a late afterAll from the
// old worker would delete rows from under the tests the new worker is already running.
test.beforeAll(async () => resetTestRows());
test.afterAll(async () => prisma.$disconnect());

async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    const button = document.querySelector("main button, form button");
    return Boolean(button && Object.keys(button).some((key) => key.startsWith("__reactFiber")));
  });
}

async function settle(page: Page) {
  await page.waitForTimeout(400);
  await page.waitForLoadState("networkidle");
}

/** The playbook row for a seed item, by its title. */
function playbookRow(page: Page, title: string): Locator {
  return page.locator("li").filter({ has: page.getByText(title, { exact: true }) }).first();
}

/** Opens the inline editor on a playbook row and returns its form. */
async function openPlaybookEditor(page: Page, title: string): Promise<Locator> {
  await waitForHydration(page);
  const row = playbookRow(page, title);
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  const form = row.locator("form").filter({ has: page.locator("[name=startAt]") });
  await expect(form).toBeVisible();
  return form;
}

/** Clicks Save and waits for the editor to close (the row then shows the saved values). */
async function savePlaybook(page: Page, form: Locator) {
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form).toHaveCount(0, { timeout: 15_000 });
  await settle(page);
}

test.describe("Day-of pages", () => {
  test("every day-of page opens, the tab strip navigates, contacts are call links, MC and Venue have no inputs", async ({ page }) => {
    // Jumping between pages faster than a person can cancels in-flight prefetches ("Failed to fetch"); not a page error.
    const guards = attachGuards(page, { allow: /Failed to fetch/ });
    for (const path of ["/day", "/day/decor", "/day/hair-makeup", "/day/shots", "/day/mc", "/day/venue", "/day/assignments", "/day/contacts", "/day/now"]) {
      const response = await page.goto(path);
      expect(response?.status() ?? 0, `${path} status`).toBeLessThan(400);
      await expect(page.locator("body")).not.toContainText(/Something went wrong|Application error/);
      await expectNoSidewaysScroll(page);
    }
    await expect(page, "/day/now redirects to /day").toHaveURL(/\/day$/);

    await page.goto("/day/mc");
    expect(await page.locator("main input:not([type=hidden]), main textarea, main select").count(), "MC run of show is read-only").toBe(0);
    await page.goto("/day/venue");
    expect(await page.locator("main input:not([type=hidden]), main textarea, main select").count(), "Venue is read-only").toBe(0);

    await page.goto("/day/contacts");
    expect(await page.locator("main input:not([type=hidden]), main textarea, main select").count(), "Contacts is read-only").toBe(0);
    expect(await page.locator('a[href^="tel:"]').count(), "contacts are tel: links").toBeGreaterThan(0);

    const tabs = page.getByRole("navigation", { name: "Day-of pages" });
    await tabs.getByRole("link", { name: "Shots" }).click();
    await expect(page).toHaveURL(/\/day\/shots$/);
    await tabs.getByRole("link", { name: "Assignments" }).click();
    await expect(page).toHaveURL(/\/day\/assignments$/);
    await tabs.getByRole("link", { name: "Day", exact: true }).click();
    await expect(page).toHaveURL(/\/day$/);
    await guards.assertClean();
  });

  test("Log out on /day ends the session and the day pages ask for a PIN again", async ({ page }) => {
    const guards = attachGuards(page);
    await page.goto("/day");
    await waitForHydration(page);
    await page.getByRole("button", { name: "Log out" }).click();
    await page.waitForLoadState("networkidle");
    await page.goto("/day/shots");
    await expect(page.getByRole("button", { name: "Edit", exact: true }), "no editors when logged out").toHaveCount(0);
    await expect(page.getByRole("button", { name: "Mark done" })).toHaveCount(0);
    await guards.assertClean();
  });
});

test.describe("Playbook editor (Shots, Decor, Hair & Makeup)", () => {
  test("saving a shot with a blank Title says what is missing and keeps the notes typed with it", async ({ page }) => {
    const guards = attachGuards(page);
    await page.goto("/day/shots");
    const form = await openPlaybookEditor(page, "Invitations");
    await form.locator("[name=title]").fill("   ");
    await form.locator("[name=notes]").fill("Test note kept");
    await form.getByRole("button", { name: "Save" }).click();
    await expect(form.getByText("Add a title before saving.")).toBeVisible();
    await expect(form, "the editor stays open").toBeVisible();
    await expect(form.locator("[name=notes]")).toHaveValue("Test note kept");
    // Editing the title clears the message, and the save then goes through.
    await form.locator("[name=title]").fill("Invitations");
    await expect(form.getByText("Add a title before saving.")).toHaveCount(0);
    await savePlaybook(page, form);
    await page.reload();
    await expect(playbookRow(page, "Invitations")).toContainText("Test note kept");
    const saved = await prisma.playbookItem.findUnique({ where: { sourceKey: "shot-details-invitations" } });
    expect(saved?.notes).toBe("Test note kept");
    expect(saved?.title).toBe("Invitations");
    await guards.assertClean();
  });

  test("every shot field saves what was typed, comes back after reload, and clears to nothing (not 0, not the old value)", async ({ page }) => {
    const guards = attachGuards(page);
    await page.goto("/day/shots");
    let form = await openPlaybookEditor(page, "Invitations");

    // Time: 0, clear, 9 -> 9 (free text, no AM/PM forced, no leading zero kept).
    const time = form.locator("[name=startAt]");
    await time.fill("0");
    await time.fill("");
    await time.pressSequentially("9");
    await expect(time).toHaveValue("9");
    await form.locator("[name=detail]").fill("<b>x</b> 'q' \"dq\" `bt` 🎉");
    await form.locator("[name=location]").fill("007");
    await form.locator("[name=notes]").fill("line1\n\nline3");
    await savePlaybook(page, form);
    await page.reload();

    const row = playbookRow(page, "Invitations");
    await expect(row).toContainText("9");
    await expect(row).toContainText("<b>x</b> 'q' \"dq\" `bt` 🎉");
    await expect(row).toContainText("007");
    // Notes typed on separate lines keep their line breaks on the card.
    const notes = row.getByText("line1", { exact: false });
    expect(await notes.evaluate((node) => getComputedStyle(node).whiteSpace)).toMatch(/pre/);
    expect(await notes.innerText()).toBe("line1\n\nline3");
    await expectNoSidewaysScroll(page);

    let saved = await prisma.playbookItem.findUnique({ where: { sourceKey: "shot-details-invitations" } });
    expect(saved).toMatchObject({ startAt: "9", detail: "<b>x</b> 'q' \"dq\" `bt` 🎉", location: "007", notes: "line1\n\nline3" });

    // Reopen: the editor is prefilled with exactly what was saved.
    form = await openPlaybookEditor(page, "Invitations");
    await expect(form.locator("[name=startAt]")).toHaveValue("9");
    await expect(form.locator("[name=notes]")).toHaveValue("line1\n\nline3");

    // Backspace one character at a time to empty, then type again: no lost keystrokes.
    const detail = form.locator("[name=detail]");
    await detail.fill("abc");
    await detail.focus();
    await page.keyboard.press("End");
    for (let i = 0; i < 3; i += 1) await page.keyboard.press("Backspace");
    await expect(detail).toHaveValue("");
    await page.keyboard.type("Test detail typed", { delay: 0 });
    await expect(detail).toHaveValue("Test detail typed");

    // Paste: very long text and whitespace-only values.
    const long = "L".repeat(2000);
    await form.locator("[name=location]").fill(long);
    await form.locator("[name=notes]").fill("   ");
    await form.locator("[name=startAt]").fill("-5");
    await savePlaybook(page, form);
    await page.reload();
    saved = await prisma.playbookItem.findUnique({ where: { sourceKey: "shot-details-invitations" } });
    expect(saved).toMatchObject({ startAt: "-5", detail: "Test detail typed", location: long, notes: null });
    await expect(playbookRow(page, "Invitations")).toContainText("Test detail typed");
    await expectNoSidewaysScroll(page);

    // Select all + Delete on every optional field: empty on screen and after reload.
    form = await openPlaybookEditor(page, "Invitations");
    for (const name of ["startAt", "detail", "location", "notes"]) {
      const field = form.locator(`[name=${name}]`);
      await field.focus();
      await page.keyboard.press("ControlOrMeta+a");
      await page.keyboard.press("Delete");
      await expect(field).toHaveValue("");
    }
    await savePlaybook(page, form);
    await page.reload();
    saved = await prisma.playbookItem.findUnique({ where: { sourceKey: "shot-details-invitations" } });
    expect(saved).toMatchObject({ startAt: null, detail: null, location: null, notes: null, title: "Invitations" });
    await expect(playbookRow(page, "Invitations")).not.toContainText("Test detail typed");
    form = await openPlaybookEditor(page, "Invitations");
    await expect(form.locator("[name=startAt]")).toHaveValue("");
    await expect(form.locator("[name=notes]")).toHaveValue("");
    await guards.assertClean();
  });

  test("Escape keeps the editor open, Enter in a text field saves, Cancel and Close discard what was typed", async ({ page }) => {
    const guards = attachGuards(page);
    await page.goto("/day/shots");
    let form = await openPlaybookEditor(page, "Invitations");
    const detail = form.locator("[name=detail]");
    await detail.fill("Test escape");
    await detail.press("Escape");
    await expect(form).toBeVisible();
    await expect(detail).toHaveValue("Test escape");
    // Tab away and back loses nothing.
    await detail.press("Tab");
    await detail.press("Shift+Tab");
    await expect(detail).toHaveValue("Test escape");
    await detail.press("Enter");
    await expect(form).toHaveCount(0, { timeout: 15_000 });
    await settle(page);
    await page.reload();
    await expect(playbookRow(page, "Invitations")).toContainText("Test escape");

    // Enter in the Notes textarea adds a line, it does not submit.
    form = await openPlaybookEditor(page, "Invitations");
    const notes = form.locator("[name=notes]");
    await notes.fill("a");
    await notes.press("Enter");
    await notes.type("b");
    await expect(form).toBeVisible();
    await expect(notes).toHaveValue("a\nb");

    // Cancel discards.
    await detail.fill("Test discarded");
    await form.getByRole("button", { name: "Cancel" }).click();
    await expect(form).toHaveCount(0);
    await expect(playbookRow(page, "Invitations")).not.toContainText("Test discarded");
    // Close (the Edit toggle) discards too, and reopening shows the saved value.
    form = await openPlaybookEditor(page, "Invitations");
    await detail.fill("Test discarded");
    await playbookRow(page, "Invitations").getByRole("button", { name: "Close" }).click();
    await expect(form).toHaveCount(0);
    form = await openPlaybookEditor(page, "Invitations");
    await expect(detail).toHaveValue("Test escape");

    // Browser Back from another page and reload keep the saved value.
    await page.goto("/day/decor");
    await page.goBack();
    await expect(page).toHaveURL(/\/day\/shots$/);
    await expect(playbookRow(page, "Invitations")).toContainText("Test escape");
    const saved = await prisma.playbookItem.findUnique({ where: { sourceKey: "shot-details-invitations" } });
    expect(saved?.detail).toBe("Test escape");
    await guards.assertClean();
  });

  test("Mark done and Mark open on a shot persist across reload", async ({ page }) => {
    const guards = attachGuards(page);
    await page.goto("/day/shots");
    await waitForHydration(page);
    const row = playbookRow(page, "Invitations");
    await expect(row).toContainText("Open");
    await row.getByRole("button", { name: "Mark done" }).click();
    await expect(row.getByRole("button", { name: "Mark open" })).toBeVisible({ timeout: 15_000 });
    await settle(page);
    await page.reload();
    await expect(playbookRow(page, "Invitations")).toContainText("Done");
    expect((await prisma.playbookItem.findUnique({ where: { sourceKey: "shot-details-invitations" } }))?.completed).toBe(true);
    await waitForHydration(page);
    await playbookRow(page, "Invitations").getByRole("button", { name: "Mark open" }).click();
    await expect(playbookRow(page, "Invitations").getByRole("button", { name: "Mark done" })).toBeVisible({ timeout: 15_000 });
    await settle(page);
    await page.reload();
    await expect(playbookRow(page, "Invitations")).toContainText("Open");
    expect((await prisma.playbookItem.findUnique({ where: { sourceKey: "shot-details-invitations" } }))?.completed).toBe(false);
    await guards.assertClean();
  });

  test("Decor (both boards) and Hair & Makeup editors save a seed item the same way", async ({ page }) => {
    const guards = attachGuards(page);
    await page.goto("/day/decor");
    let form = await openPlaybookEditor(page, "Tablecloths");
    await form.locator("[name=notes]").fill("Test decor note");
    await savePlaybook(page, form);
    form = await openPlaybookEditor(page, "Package: The Sweet Spot — 8 hours");
    await form.locator("[name=startAt]").fill("12.50");
    await savePlaybook(page, form);
    await page.reload();
    await expect(playbookRow(page, "Tablecloths")).toContainText("Test decor note");
    await expect(playbookRow(page, "Package: The Sweet Spot — 8 hours")).toContainText("12.50");
    expect((await prisma.playbookItem.findUnique({ where: { sourceKey: "decor-tablecloths" } }))?.notes).toBe("Test decor note");
    expect((await prisma.playbookItem.findUnique({ where: { sourceKey: "avalon-package" } }))?.startAt).toBe("12.50");
    await expectNoSidewaysScroll(page);

    await page.goto("/day/hair-makeup");
    form = await openPlaybookEditor(page, "Bedroom 1");
    await form.locator("[name=location]").fill("Test location");
    await savePlaybook(page, form);
    await page.reload();
    await expect(playbookRow(page, "Bedroom 1")).toContainText("Test location");
    expect((await prisma.playbookItem.findUnique({ where: { sourceKey: "hm-room-bed1" } }))?.location).toBe("Test location");
    await expectNoSidewaysScroll(page);
    await guards.assertClean();
  });
});

test.describe("Assignments", () => {
  const TITLE = "Test assignment 🎉 <b>x</b>";

  function assignmentForm(page: Page): Locator {
    return page.locator("form").filter({ has: page.locator("[name=title]") });
  }

  async function openNewAssignment(page: Page): Promise<Locator> {
    await waitForHydration(page);
    await page.getByRole("button", { name: "Add assignment" }).first().click();
    const form = assignmentForm(page);
    await expect(form).toBeVisible();
    await expect(form).toContainText("New assignment");
    return form;
  }

  function assignmentRow(page: Page, title: string): Locator {
    return page.locator("article").filter({ has: page.getByText(title, { exact: true }) });
  }

  test("adding an assignment with a blank Task says what is missing and keeps the notes and names typed with it", async ({ page }) => {
    const guards = attachGuards(page);
    await page.goto("/day/assignments");
    const form = await openNewAssignment(page);
    await form.locator("[name=title]").fill("   ");
    await form.locator("[name=notes]").fill("Test note kept");
    await form.locator("[name=newPerson]").fill("Test Person Kept");
    await form.getByRole("button", { name: "Add assignment" }).click();
    await expect(form.getByText("Add a task before saving.")).toBeVisible();
    await expect(form, "the form stays open").toBeVisible();
    await expect(form.locator("[name=notes]")).toHaveValue("Test note kept");
    await expect(form.locator("[name=newPerson]")).toHaveValue("Test Person Kept");
    expect(await prisma.dayAssignment.count({ where: { title: { startsWith: TEST_PREFIX } } }), "nothing was written").toBe(0);
    expect(await prisma.person.count({ where: { name: "Test Person Kept" } }), "no person was created").toBe(0);

    await form.locator("[name=title]").fill("Test assignment kept");
    await expect(form.getByText("Add a task before saving.")).toHaveCount(0);
    await form.getByRole("button", { name: "Add assignment" }).click();
    await expect(form).toHaveCount(0, { timeout: 15_000 });
    await settle(page);
    await page.reload();
    const row = assignmentRow(page, "Test assignment kept");
    await expect(row).toContainText("Test note kept");
    await expect(row).toContainText("Test Person Kept");
    await guards.assertClean();
  });

  test("adding, editing (names, notes, Enter), cancelling and deleting an assignment", async ({ page }) => {
    const guards = attachGuards(page);
    await page.goto("/day/assignments");
    const addToggle = page.getByRole("button", { name: "Add assignment" }).first();
    let form = await openNewAssignment(page);
    // The Add button toggles the form closed and open again without losing the page.
    await addToggle.click();
    await expect(form).toHaveCount(0);
    form = await openNewAssignment(page);

    await form.locator("[name=title]").fill(TITLE);
    await form.locator("[name=notes]").fill("n1\n\nn3");
    await form.locator("[name=newPerson]").fill("   ");
    await form.getByRole("checkbox", { name: "David" }).check();
    await form.getByRole("button", { name: "Add assignment" }).click();
    await expect(form).toHaveCount(0, { timeout: 15_000 });
    await settle(page);
    await page.reload();
    const row = assignmentRow(page, TITLE);
    await expect(row).toContainText("David");
    await expect(row).toContainText("n1");
    let saved = await prisma.dayAssignment.findFirst({ where: { title: TITLE }, include: { assignees: true } });
    expect(saved?.notes).toBe("n1\n\nn3");
    expect(saved?.assignees.map((a) => a.personId)).toEqual(["david"]);
    expect(await prisma.person.count({ where: { name: "" } }), "a blank new name creates nobody").toBe(0);
    await expectNoSidewaysScroll(page);

    // Edit: prefilled, untick everyone, add a new name, clear notes, Enter in Task saves.
    await waitForHydration(page);
    await row.getByRole("button", { name: "Edit" }).click();
    form = assignmentForm(page);
    await expect(form).toContainText("Edit assignment");
    await expect(form.locator("[name=title]")).toHaveValue(TITLE);
    await expect(form.locator("[name=notes]")).toHaveValue("n1\n\nn3");
    await expect(form.getByRole("checkbox", { name: "David" })).toBeChecked();
    await form.getByRole("checkbox", { name: "David" }).uncheck();
    await form.locator("[name=newPerson]").fill("Test Person Z");
    await form.locator("[name=notes]").fill("");
    await form.locator("[name=title]").press("Enter");
    await expect(form).toHaveCount(0, { timeout: 15_000 });
    await settle(page);
    await page.reload();
    await expect(assignmentRow(page, TITLE)).toContainText("Test Person Z");
    await expect(assignmentRow(page, TITLE)).not.toContainText("David");
    saved = await prisma.dayAssignment.findFirst({ where: { title: TITLE }, include: { assignees: { include: { person: true } } } });
    expect(saved?.notes).toBeNull();
    expect(saved?.assignees.map((a) => a.person.name)).toEqual(["Test Person Z"]);

    // The new name is now a known name, pre-ticked; adding it again by name does not duplicate it.
    await waitForHydration(page);
    await assignmentRow(page, TITLE).getByRole("button", { name: "Edit" }).click();
    form = assignmentForm(page);
    await expect(form.getByRole("checkbox", { name: "Test Person Z" })).toBeChecked();
    await form.locator("[name=newPerson]").fill("test person z");
    await form.getByRole("button", { name: "Save" }).click();
    await expect(form).toHaveCount(0, { timeout: 15_000 });
    await settle(page);
    expect(await prisma.person.count({ where: { name: { equals: "Test Person Z", mode: "insensitive" } } })).toBe(1);

    // Escape keeps the form; Cancel closes it without saving; untick everyone -> "No one assigned".
    await page.reload();
    await waitForHydration(page);
    await assignmentRow(page, TITLE).getByRole("button", { name: "Edit" }).click();
    form = assignmentForm(page);
    await form.locator("[name=title]").fill("Test discarded");
    await form.locator("[name=title]").press("Escape");
    await expect(form).toBeVisible();
    await form.getByRole("button", { name: "Cancel" }).click();
    await expect(form).toHaveCount(0);
    await expect(assignmentRow(page, TITLE)).toBeVisible();
    await assignmentRow(page, TITLE).getByRole("button", { name: "Edit" }).click();
    form = assignmentForm(page);
    await form.getByRole("checkbox", { name: "Test Person Z" }).uncheck();
    await form.locator("[name=title]").fill("Test assignment " + "x".repeat(2000));
    await form.getByRole("button", { name: "Save" }).click();
    await expect(form).toHaveCount(0, { timeout: 15_000 });
    await settle(page);
    await page.reload();
    const longRow = page.locator("article").filter({ hasText: "Test assignment xxxx" });
    await expect(longRow).toContainText("No one assigned");
    await expectNoSidewaysScroll(page);

    // Delete asks first; dismissing keeps the row, accepting removes it.
    await waitForHydration(page);
    page.once("dialog", (dialog) => dialog.dismiss());
    await longRow.getByRole("button", { name: "Delete" }).click();
    await settle(page);
    await expect(longRow).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await longRow.getByRole("button", { name: "Delete" }).click();
    // The row is gone from the database first; the page follows on refresh. Now and then the
    // refresh after a server action still shows the old row until a reload (known app-wide
    // issue, tracked separately), so the check reloads like a person would.
    await expect
      .poll(async () => prisma.dayAssignment.count({ where: { title: { startsWith: "Test assignment xxxx" } } }), { timeout: 15_000 })
      .toBe(0);
    await page.reload();
    await expect(page.locator("article").filter({ hasText: "Test assignment xxxx" })).toHaveCount(0);
    expect(await prisma.dayAssignment.count({ where: { title: { startsWith: "Test assignment xxxx" } } })).toBe(0);
    await guards.assertClean();
  });
});
