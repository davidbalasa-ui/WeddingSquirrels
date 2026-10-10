import { expect, test, type Page } from "@playwright/test";
import { overnightPrisma } from "./db";
import { attachGuards, expectNoSidewaysScroll } from "./helpers";

/**
 * Field sweep for People and contacts: every input on /people (All, Vendors, Day-of tabs),
 * /people/vendors, /people/family, /people/party and /people/[profileId], exercised the way
 * a person would. Each test creates the rows it edits (names start with "Test ") and the
 * suite removes them afterwards, so it can be re-run against the same local database.
 */
const prisma = overnightPrisma();

const TEST_PREFIX = "Test ";

async function removeTestRows() {
  await prisma.contact.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
  await prisma.guest.deleteMany({ where: { nameLine1: { startsWith: TEST_PREFIX } } });
  await prisma.guestPerson.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
  await prisma.person.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
}

test.beforeAll(async () => removeTestRows());
test.afterAll(async () => {
  await removeTestRows();
  await prisma.$disconnect();
});

/** A 2x2 red PNG, enough for the photo pickers. */
const RED_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP4z8AARAwQCgAf7gP9i18U1AAAAABJRU5ErkJggg==",
  "base64",
);
const PNG_FILE = { name: "test.png", mimeType: "image/png", buffer: RED_PNG };

function profileUrl(profileId: string) {
  return `/people/${encodeURIComponent(profileId)}`;
}

async function settle(page: Page) {
  await page.waitForTimeout(400);
  await page.waitForLoadState("networkidle");
}

async function openEditSection(page: Page) {
  const summary = page.locator("summary").filter({ hasText: /^Edit / });
  const details = summary.locator("..");
  if (!(await details.evaluate((node) => (node as HTMLDetailsElement).open))) await summary.click();
}

test.describe("People hub lists", () => {
  test("every people list page opens, the tabs switch, and the search box filters without errors", async ({ page }) => {
    // Jumping between pages faster than a person can cancels in-flight prefetches ("Failed to fetch"); not a page error.
    const guards = attachGuards(page, { allow: /Failed to fetch/ });
    await prisma.contact.create({
      data: { name: "Test Vendor Search", directoryList: "vendors", isDayOfContact: false, sortOrder: 900 },
    });

    for (const path of ["/people", "/people?tab=vendors", "/people?tab=day-of", "/people/vendors", "/people/family", "/people/party"]) {
      const response = await page.goto(path);
      expect(response?.status() ?? 0, `${path} status`).toBeLessThan(400);
      await expect(page.locator("body")).not.toContainText(/Something went wrong|Application error/);
      await expectNoSidewaysScroll(page);
    }

    await page.goto("/people");
    await page.getByRole("link", { name: /^Vendors/ }).click();
    await expect(page).toHaveURL(/tab=vendors/);
    const search = page.getByRole("searchbox", { name: "Search people" });
    await expect(search).toHaveAttribute("placeholder", "Search vendors");
    await expect(page.getByRole("link", { name: /Test Vendor Search/ })).toBeVisible();

    await search.fill("zzzz-no-match");
    await expect(page.getByText("No vendor contacts match that search.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Test Vendor Search/ })).toHaveCount(0);
    await search.fill("   ");
    await expect(page.getByRole("link", { name: /Test Vendor Search/ })).toBeVisible();
    await search.fill("test vendor");
    await expect(page.getByRole("link", { name: /Test Vendor Search/ })).toBeVisible();
    await search.press("Enter");
    await expect(page).toHaveURL(/tab=vendors/);
    await search.press("Escape");
    await search.selectText();
    await search.press("Delete");
    await expect(search).toHaveValue("");
    await expect(page.getByRole("link", { name: /Test Vendor Search/ })).toBeVisible();
    await expectNoSidewaysScroll(page);

    await page.getByRole("link", { name: /^Day-of/ }).click();
    await expect(page).toHaveURL(/tab=day-of/);
    await page.getByRole("link", { name: /^All/ }).click();
    await expect(page).not.toHaveURL(/tab=/);
    await guards.assertClean();
  });
});

test.describe("Day-of tab · add or edit day-of contacts", () => {
  test("submitting the new-contact form with a blank name says so and keeps the phone typed", async ({ page }) => {
    const guards = attachGuards(page);
    await page.goto("/people?tab=day-of");
    await page.getByText("Add or edit day-of contacts").click();
    await page.getByRole("button", { name: "Add day-of contact" }).click();
    await page.getByRole("textbox", { name: "Name" }).fill("   ");
    await page.getByRole("textbox", { name: "Phone" }).fill("123");
    await page.getByRole("button", { name: "Add person" }).click();
    await expect(page.getByText("Add a name before saving.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Phone" })).toHaveValue("123");
    expect(await prisma.contact.count({ where: { phone: "123" } })).toBe(0);
    await page.getByRole("textbox", { name: "Name" }).fill("Test Dayof Blank");
    await expect(page.getByText("Add a name before saving.")).toHaveCount(0);
    await page.getByRole("button", { name: "Add person" }).click();
    await expect.poll(() => prisma.contact.count({ where: { name: "Test Dayof Blank", phone: "123" } })).toBe(1);
    await page.reload(); // see SWEEP-REPORT finding 6: the refreshed page can briefly show the old data
    await page.getByText("Add or edit day-of contacts").click();
    await expect(page.getByText("Test Dayof Blank")).toBeVisible();
    await guards.assertClean();
  });

  test("adds a contact with odd characters, edits it with Enter, clears the phone, swaps the photo, and deletes it", async ({ page }) => {
    const guards = attachGuards(page);
    page.on("dialog", (dialog) => dialog.accept());
    const name = `Test Dayof <b>x</b> ' " \` 🎉`;
    await page.goto("/people?tab=day-of");
    await page.getByText("Add or edit day-of contacts").click();
    await page.getByRole("button", { name: "Add day-of contact" }).click();
    await page.getByRole("textbox", { name: "Name" }).fill(name);
    await page.getByRole("textbox", { name: "Phone" }).fill(" 007 ");
    await page.getByRole("textbox", { name: "Email" }).fill("test@example.com");
    await page.getByRole("button", { name: "Add photo" }).click().catch(() => undefined);
    await page.locator('input[type="file"]').first().setInputFiles(PNG_FILE);
    await expect(page.getByRole("button", { name: "Change photo" })).toBeVisible();
    await page.getByRole("button", { name: "Add person" }).click();
    await expect.poll(() => prisma.contact.count({ where: { name } })).toBe(1);
    const created = await prisma.contact.findFirst({ where: { name } });
    expect(created).toMatchObject({ phone: "007", email: "test@example.com", isDayOfContact: true });
    expect(created?.photoData?.startsWith("data:image/")).toBe(true);

    await page.reload();
    await page.getByText("Add or edit day-of contacts").click();
    await expect(page.getByText(name)).toBeVisible();
    await expect(page.getByRole("link", { name: `Call ${name}` }).first()).toHaveText("007");

    // Edit: clear the phone, change the email, press Enter in the name field.
    const row = page.locator("article").filter({ hasText: name });
    await row.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("textbox", { name: "Phone" }).fill("");
    await page.getByRole("textbox", { name: "Email" }).fill("");
    await page.getByRole("button", { name: "Remove photo" }).click();
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled();
    await page.getByRole("textbox", { name: "Name" }).press("Enter");
    await expect(page.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
    await expect.poll(async () => {
      const row = await prisma.contact.findUnique({ where: { id: created!.id } });
      return { phone: row?.phone, email: row?.email, photo: row?.photoData };
    }).toEqual({ phone: null, email: null, photo: null });

    // Escape does not throw the form away; Cancel closes it without saving.
    await row.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("textbox", { name: "Phone" }).fill("999");
    await page.getByRole("textbox", { name: "Phone" }).press("Escape");
    await expect(page.getByRole("textbox", { name: "Phone" })).toHaveValue("999");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
    expect((await prisma.contact.findUnique({ where: { id: created!.id } }))?.phone).toBeNull();

    await row.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText(name)).toHaveCount(0);
    await expect.poll(() => prisma.contact.count({ where: { id: created!.id } })).toBe(0);
    await expectNoSidewaysScroll(page);
    await guards.assertClean();
  });
});

test.describe("Person profile · contact (vendor) record", () => {
  test("contact info, role, list, photo and delete all save what was typed and clear to empty", async ({ page }) => {
    const guards = attachGuards(page);
    page.on("dialog", (dialog) => dialog.accept());
    const contact = await prisma.contact.create({
      data: { name: "Test Contact Edit", phone: "111", email: "old@example.com", directoryList: "vendors", directoryLabel: "Old role", sortOrder: 901 },
    });
    await page.goto(profileUrl(`contact:${contact.id}`));
    await expect(page.locator("h1")).toHaveText("Test Contact Edit");

    // Edit contact info: blank name disables Save; 0 → clear → 9; bad email blocked by the browser.
    await page.getByRole("button", { name: "Edit contact info" }).click();
    const name = page.getByRole("textbox", { name: "Name" });
    const phone = page.getByRole("textbox", { name: "Phone" });
    const email = page.getByRole("textbox", { name: "Email" });
    await name.fill("   ");
    await expect(page.getByRole("button", { name: "Save contact" })).toBeDisabled();
    await name.fill("Test Contact Nine 🎉");
    await phone.fill("0");
    await phone.fill("");
    await phone.pressSequentially("9");
    await email.fill("not-an-email");
    await page.getByRole("button", { name: "Save contact" }).click();
    await expect(page.getByRole("button", { name: "Save contact" })).toBeVisible();
    await email.fill("new@example.com");
    await page.getByRole("button", { name: "Save contact" }).click();
    await expect.poll(async () => {
      const row = await prisma.contact.findUnique({ where: { id: contact.id } });
      return [row?.name, row?.phone, row?.email];
    }).toEqual(["Test Contact Nine 🎉", "9", "new@example.com"]);
    await page.reload(); // finding 6
    await expect(page.locator("h1")).toHaveText("Test Contact Nine 🎉");
    await expect(page.getByRole("link", { name: "9" })).toBeVisible();

    // Clear phone and email, Enter in the phone field submits.
    await page.getByRole("button", { name: "Edit contact info" }).click();
    await phone.fill("");
    await email.fill("");
    await expect(page.getByRole("button", { name: "Save contact" })).toBeEnabled();
    await phone.press("Enter");
    await expect.poll(async () => {
      const row = await prisma.contact.findUnique({ where: { id: contact.id } });
      return [row?.phone, row?.email];
    }).toEqual([null, null]);
    await page.reload(); // finding 6
    await expect(page.getByText("No phone yet.")).toBeVisible();

    // Role: Enter saves; whitespace clears to null.
    await openEditSection(page);
    await page.getByRole("button", { name: "Edit role" }).click();
    const role = page.getByRole("textbox", { name: /^Role/ });
    await expect(role).toHaveValue("Old role");
    await role.fill("Test role <i>");
    await expect(page.getByRole("button", { name: "Save role" })).toBeEnabled();
    await role.press("Enter");
    await expect.poll(async () => (await prisma.contact.findUnique({ where: { id: contact.id } }))?.directoryLabel).toBe("Test role <i>");
    await page.reload(); // finding 6
    await expect(page.getByText("Test role <i>").first()).toBeVisible();
    await openEditSection(page);
    await page.getByRole("button", { name: "Edit role" }).click();
    await role.fill("   ");
    await page.getByRole("button", { name: "Save role" }).click();
    await expect.poll(async () => (await prisma.contact.findUnique({ where: { id: contact.id } }))?.directoryLabel).toBeNull();
    await page.reload();
    await openEditSection(page);
    await expect(page.getByText("Test role <i>")).toHaveCount(0);

    // Primary list select shows the current list; re-selecting it is a no-op.
    const list = page.getByRole("combobox", { name: "Add a role" });
    await expect(list).toHaveValue("vendors");
    await list.selectOption("vendors");
    await settle(page);
    expect((await prisma.contact.findUnique({ where: { id: contact.id } }))?.directoryList).toBe("vendors");

    // Photo add and remove.
    await page.getByRole("button", { name: "Add photo" }).click();
    await page.locator('input[type="file"]').first().setInputFiles(PNG_FILE);
    await expect(page.getByRole("button", { name: "Change photo" })).toBeVisible();
    await expect.poll(async () => (await prisma.contact.findUnique({ where: { id: contact.id } }))?.photoData?.slice(0, 11)).toBe("data:image/");
    await page.reload();
    await page.getByRole("button", { name: "Remove photo" }).click();
    await expect(page.getByRole("button", { name: "Add photo" })).toBeVisible();
    await expect.poll(async () => (await prisma.contact.findUnique({ where: { id: contact.id } }))?.photoData).toBeNull();
    await expectNoSidewaysScroll(page);

    // Delete person.
    await openEditSection(page);
    await page.getByRole("button", { name: "Delete person" }).click();
    await expect(page).toHaveURL(/\/people$/);
    await expect.poll(() => prisma.contact.count({ where: { id: contact.id } })).toBe(0);
    await guards.assertClean();
  });

  test("Remove from Day-of Contacts on a contact added from the Day-of tab actually takes it off the call list", async ({ page }) => {
    const guards = attachGuards(page);
    // Exactly what createContact writes for a contact added on the Day-of tab.
    const contact = await prisma.contact.create({
      data: { name: "Test Dayof Remove", directoryList: "day-of", isDayOfContact: true, sortOrder: 902 },
    });
    await page.goto(profileUrl(`contact:${contact.id}`));
    const toggle = page.getByRole("button", { name: /Day-of Contacts/ }).first();
    await expect(toggle).toHaveText("Remove from Day-of Contacts");
    await toggle.click();
    await expect(toggle).toHaveText("Add to Day-of Contacts");
    await settle(page);
    await page.reload();
    await expect(page.getByRole("button", { name: /Day-of Contacts/ }).first()).toHaveText("Add to Day-of Contacts");
    await page.goto("/people?tab=day-of");
    await page.getByText("Add or edit day-of contacts").click();
    await expect(page.getByText("Test Dayof Remove")).toHaveCount(0);

    // And back on again.
    await page.goto(profileUrl(`contact:${contact.id}`));
    await page.getByRole("button", { name: "Add to Day-of Contacts" }).first().click();
    await expect(page.getByRole("button", { name: /Day-of Contacts/ }).first()).toHaveText("Remove from Day-of Contacts");
    await settle(page);
    await page.reload();
    await expect(page.getByRole("button", { name: /Day-of Contacts/ }).first()).toHaveText("Remove from Day-of Contacts");
    expect((await prisma.contact.findUnique({ where: { id: contact.id } }))?.isDayOfContact).toBe(true);
    await guards.assertClean();
  });
});

test.describe("Person profile · guest record", () => {
  test("name, household phone, mailing address, RSVP, day-of toggle, photo and delete save and clear correctly", async ({ page }) => {
    const guards = attachGuards(page);
    page.on("dialog", (dialog) => dialog.accept());
    const guest = await prisma.guest.create({
      data: { nameLine1: "Test Guest Edit", sortOrder: 900, people: { create: { name: "Test Guest Edit" } } },
      include: { people: true },
    });
    const guestPersonId = guest.people[0]!.id;
    await page.goto(profileUrl(`guest:${guestPersonId}`));
    await expect(page.locator("h1")).toHaveText("Test Guest Edit");

    // Name: blank disables Save; surrounding spaces are trimmed; Enter saves.
    await page.getByRole("button", { name: "Edit name" }).click();
    const name = page.getByRole("textbox", { name: "Name" });
    await name.fill("");
    await expect(page.getByRole("button", { name: "Save name" })).toBeDisabled();
    await name.fill("  Test Guest Renamed 🎉  ");
    await expect(page.getByRole("button", { name: "Save name" })).toBeEnabled();
    await name.press("Enter");
    await expect.poll(async () => (await prisma.guestPerson.findUnique({ where: { id: guestPersonId } }))?.name).toBe("Test Guest Renamed 🎉");
    await page.reload(); // finding 6
    await expect(page.locator("h1")).toHaveText("Test Guest Renamed 🎉");

    // Household phone: 0 → clear → 9 saves "9"; whitespace clears to null.
    await page.getByRole("button", { name: "Add household phone" }).click();
    const phone = page.getByRole("textbox", { name: "Household phone" });
    await phone.fill("0");
    await phone.fill("");
    await phone.pressSequentially("9");
    await page.getByRole("button", { name: "Save phone" }).click();
    await expect.poll(async () => (await prisma.guest.findUnique({ where: { id: guest.id } }))?.phone).toBe("9");
    await page.reload(); // finding 6
    await expect(page.getByRole("link", { name: "9" })).toBeVisible();
    await page.getByRole("button", { name: "Edit household phone" }).click();
    await phone.fill("   ");
    await expect(page.getByRole("button", { name: "Save phone" })).toBeEnabled();
    await phone.press("Enter");
    await expect.poll(async () => (await prisma.guest.findUnique({ where: { id: guest.id } }))?.phone).toBeNull();
    await page.reload(); // finding 6
    await expect(page.getByText("No phone yet.")).toBeVisible();

    // Mailing address: Enter in ZIP saves all four; clearing all four stores null.
    await page.getByRole("button", { name: "Add mailing address" }).click();
    await page.getByRole("textbox", { name: "Street" }).fill("1 Test St <b>");
    await page.getByRole("textbox", { name: "City" }).fill("Testville");
    await page.getByRole("textbox", { name: "State" }).fill("MI");
    await page.getByRole("textbox", { name: "ZIP" }).fill("00700");
    await expect(page.getByRole("button", { name: "Save address" })).toBeEnabled();
    await page.getByRole("textbox", { name: "ZIP" }).press("Enter");
    await expect.poll(async () => {
      const row = await prisma.guest.findUnique({ where: { id: guest.id } });
      return [row?.street, row?.city, row?.state, row?.zip];
    }).toEqual(["1 Test St <b>", "Testville", "MI", "00700"]);
    await page.reload(); // finding 6
    await expect(page.getByText("1 Test St <b>, Testville, MI 00700")).toBeVisible();
    await page.getByRole("button", { name: "Edit mailing address" }).click();
    for (const field of ["Street", "City", "State", "ZIP"]) await page.getByRole("textbox", { name: field }).fill("");
    await page.getByRole("button", { name: "Save address" }).click();
    await expect.poll(async () => {
      const row = await prisma.guest.findUnique({ where: { id: guest.id } });
      return [row?.street, row?.city, row?.state, row?.zip];
    }).toEqual([null, null, null, null]);
    await page.reload(); // finding 6
    await expect(page.getByText("No mailing address yet.")).toBeVisible();

    // RSVP radios.
    await page.getByRole("radio", { name: "Attending" }).click();
    await expect(page.getByRole("radio", { name: "Attending" })).toHaveAttribute("aria-checked", "true");
    await expect.poll(async () => (await prisma.guestPerson.findUnique({ where: { id: guestPersonId } }))?.rsvpStatus).toBe("attending");
    await page.reload();
    await expect(page.getByRole("radio", { name: "Attending" })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("radio", { name: "Declined" }).click();
    await expect.poll(async () => (await prisma.guestPerson.findUnique({ where: { id: guestPersonId } }))?.rsvpStatus).toBe("not_attending");

    // Day-of toggle on, then off.
    const toggle = page.getByRole("button", { name: /Day-of Contacts/ }).first();
    await toggle.click();
    await expect(toggle).toHaveText("Remove from Day-of Contacts");
    await expect.poll(async () => (await prisma.guestPerson.findUnique({ where: { id: guestPersonId } }))?.isDayOfContact).toBe(true);
    await settle(page);
    await page.reload();
    await page.getByRole("button", { name: "Remove from Day-of Contacts" }).first().click();
    await expect(page.getByRole("button", { name: /Day-of Contacts/ }).first()).toHaveText("Add to Day-of Contacts");
    await expect.poll(async () => (await prisma.guestPerson.findUnique({ where: { id: guestPersonId } }))?.isDayOfContact).toBe(false);

    // Photo add and remove.
    await page.getByRole("button", { name: "Add photo" }).click();
    await page.locator('input[type="file"]').first().setInputFiles(PNG_FILE);
    await expect(page.getByRole("button", { name: "Change photo" })).toBeVisible();
    await expect.poll(async () => (await prisma.guestPerson.findUnique({ where: { id: guestPersonId } }))?.photoData?.slice(0, 11)).toBe("data:image/");
    await page.reload();
    await page.getByRole("button", { name: "Remove photo" }).click();
    await expect(page.getByRole("button", { name: "Add photo" })).toBeVisible();
    await expect.poll(async () => (await prisma.guestPerson.findUnique({ where: { id: guestPersonId } }))?.photoData).toBeNull();

    // Role label on a guest, then delete.
    await openEditSection(page);
    await page.getByRole("button", { name: "Edit role" }).click();
    await page.getByRole("textbox", { name: /^Role/ }).fill("Test guest role");
    await page.getByRole("button", { name: "Save role" }).click();
    await expect.poll(async () => (await prisma.guestPerson.findUnique({ where: { id: guestPersonId } }))?.directoryLabel).toBe("Test guest role");
    await expectNoSidewaysScroll(page);
    await openEditSection(page);
    await page.getByRole("button", { name: "Delete person" }).click();
    await expect(page).toHaveURL(/\/people$/);
    await expect.poll(() => prisma.guestPerson.count({ where: { id: guestPersonId } })).toBe(0);
    await guards.assertClean();
  });

  test("Log out on a profile ends the session", async ({ browser }) => {
    const context = await browser.newContext({ storageState: "test-artifacts/overnight/.auth/master.json" });
    const page = await context.newPage();
    const guards = attachGuards(page);
    await page.goto(profileUrl("person:kurt_huizenga"));
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page.locator("body")).toContainText(/PIN/i);
    await guards.assertClean();
    await context.close();
  });
});
