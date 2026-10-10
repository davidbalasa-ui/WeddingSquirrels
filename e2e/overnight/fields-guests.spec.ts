import { expect, test, type Page } from "@playwright/test";
import { overnightPrisma } from "./db";
import { tableSeatingLabel } from "../../src/lib/guest-seating-chart";
import { attachGuards, expectNoSidewaysScroll } from "./helpers";

/**
 * Field sweep for the guest list: /people?tab=guests&manage=1, the per-person
 * card (name, role, RSVP, photo, phone, address, table, seat, gifts), the table
 * view and the gift print page. There is no screen that creates a household, so
 * the test households are seeded straight into the local test database.
 */
const prisma = overnightPrisma();

// A valid 8x8 red PNG (what the browser can decode) and bytes that only claim to be one.
const RED_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAEklEQVR4nGM4ISf3Hx9mGBkKAFNGgMHUn6b2AAAAAElFTkSuQmCC",
  "base64",
);
const NOT_A_PNG = Buffer.from("this is not an image at all");

const ONE = "Test Guest One";
const TWO = "Test Guest Two";
const THREE = "Test Guest Three";

async function seedHouseholds() {
  await prisma.guest.deleteMany({ where: { nameLine1: { startsWith: "Test Guest" } } });
  const pair = await prisma.guest.create({
    data: {
      nameLine1: ONE,
      nameLine2: TWO,
      invitedCount: 2,
      people: { create: [{ name: ONE, sortOrder: 0 }, { name: TWO, sortOrder: 1 }] },
    },
    include: { people: true },
  });
  const single = await prisma.guest.create({
    data: { nameLine1: THREE, invitedCount: 1, people: { create: [{ name: THREE, sortOrder: 0 }] } },
    include: { people: true },
  });
  return { pair, single };
}

function personByName(guest: { people: Array<{ id: string; name: string }> }, name: string) {
  const person = guest.people.find((row) => row.name === name);
  if (!person) throw new Error(`no seeded person named ${name}`);
  return person;
}

async function dbPerson(id: string) {
  return prisma.guestPerson.findUnique({ where: { id } });
}

/** Opens the manage list, turns on editing for one person's card and expands its details. */
async function openCard(page: Page, name: string) {
  await page.goto("/people?tab=guests&manage=1");
  await page.locator("article", { hasText: name }).first().getByRole("button", { name: "Edit guest" }).click();
  const card = page.locator("article.is-editing");
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: "Expand details" }).click();
  await expect(card.getByRole("button", { name: "Save guests" })).toBeVisible();
  return card;
}

function inlineName(card: ReturnType<Page["locator"]>) {
  return card.locator("input").first();
}

test.afterAll(async () => prisma.$disconnect());

test.describe("Guest list fields", () => {
  test("typing a new name and pressing Enter saves it; Escape puts the old name back instead of saving the draft", async ({ page }) => {
    const guards = attachGuards(page);
    const { pair } = await seedHouseholds();
    const one = personByName(pair, ONE);
    const card = await openCard(page, ONE);
    const name = inlineName(card);

    await name.click();
    await name.fill("");
    await page.keyboard.type("Test Guest One Renamed", { delay: 0 });
    await expect(name).toHaveValue("Test Guest One Renamed");
    await name.press("Enter");
    await expect.poll(async () => (await dbPerson(one.id))?.name).toBe("Test Guest One Renamed");

    await name.click();
    await name.fill("Test Guest One Escaped");
    await name.press("Escape");
    await expect(name).toHaveValue("Test Guest One Renamed");
    await page.waitForTimeout(800);
    expect((await dbPerson(one.id))?.name).toBe("Test Guest One Renamed");

    await page.reload();
    await expect(page.locator("article", { hasText: "Test Guest One Renamed" })).toHaveCount(1);
    await expectNoSidewaysScroll(page);
    guards.assertClean();
  });

  test("clearing the name and tabbing away keeps the saved name (a person cannot be nameless)", async ({ page }) => {
    const guards = attachGuards(page);
    const { pair } = await seedHouseholds();
    const one = personByName(pair, ONE);
    const card = await openCard(page, ONE);
    const name = inlineName(card);
    await name.click();
    await name.fill("");
    await name.press("Tab");
    await expect(name).toHaveValue(ONE);
    await page.waitForTimeout(500);
    expect((await dbPerson(one.id))?.name).toBe(ONE);
    guards.assertClean();
  });

  test("wiping a person's name in the seat form and tapping Save guests says a name is needed instead of deleting the person", async ({ page }) => {
    const guards = attachGuards(page);
    const { pair } = await seedHouseholds();
    const one = personByName(pair, ONE);
    const card = await openCard(page, ONE);
    const seatName = card.getByLabel("Name", { exact: true });
    await expect(seatName).toHaveValue(ONE);
    await seatName.fill("");
    await card.getByRole("button", { name: "Save guests" }).click();
    await expect(card.getByText("Every person needs a name.")).toBeVisible();
    await page.waitForTimeout(500);
    expect(await dbPerson(one.id), "the person is still in the database").not.toBeNull();
    expect((await dbPerson(personByName(pair, TWO).id))?.name).toBe(TWO);

    // Typing the name back and saving works as before.
    await seatName.fill("Test Guest One Again");
    await card.getByRole("button", { name: "Save guests" }).click();
    await expect.poll(async () => (await dbPerson(one.id))?.name).toBe("Test Guest One Again");
    await expect(card.getByText("Every person needs a name.")).toHaveCount(0);
    guards.assertClean();
  });

  test("Table # shows exactly what is typed: 0 stays 0, 007 saves as 7, 12b is refused with a message, blank means no table", async ({ page }) => {
    const guards = attachGuards(page);
    const { pair } = await seedHouseholds();
    const one = personByName(pair, ONE);
    const card = await openCard(page, ONE);
    const table = card.getByLabel("Table #");
    const save = card.getByRole("button", { name: "Save guests" });

    await table.click();
    await table.pressSequentially("0");
    await expect(table).toHaveValue("0");
    await table.pressSequentially("9");
    await expect(table).toHaveValue("09");
    await table.press("Backspace");
    await table.press("Backspace");
    await expect(table).toHaveValue("");
    await table.pressSequentially("9");
    await expect(table).toHaveValue("9");
    await save.click();
    await expect.poll(async () => (await dbPerson(one.id))?.tableNumber).toBe(9);

    await table.fill("007");
    await expect(table).toHaveValue("007");
    await save.click();
    await expect.poll(async () => (await dbPerson(one.id))?.tableNumber).toBe(7);
    // The box shows the stored value once the household refreshes after the save.
    await expect(table).toHaveValue("7", { timeout: 20_000 });

    await table.fill("12b");
    await expect(table).toHaveValue("12b");
    await save.click();
    await expect(card.getByText("Table # must be a whole number, like 9.")).toBeVisible();
    await page.waitForTimeout(500);
    expect((await dbPerson(one.id))?.tableNumber).toBe(7);

    await table.fill("0");
    await save.click();
    await expect.poll(async () => (await dbPerson(one.id))?.tableNumber).toBe(0);

    await table.fill("");
    await save.click();
    await expect.poll(async () => (await dbPerson(one.id))?.tableNumber).toBeNull();
    await page.reload();
    const again = await openCard(page, ONE);
    await expect(again.getByLabel("Table #")).toHaveValue("");
    guards.assertClean();
  });

  test("an address typed but not yet saved survives tapping the RSVP pill and Add gift on the same card", async ({ page }) => {
    const guards = attachGuards(page);
    const { pair } = await seedHouseholds();
    const one = personByName(pair, ONE);
    const card = await openCard(page, ONE);
    await card.getByLabel("Street").fill("Draft street");
    await card.getByLabel("Table #").fill("3");
    await card.getByLabel("Seat / spot").fill("head");

    await card.getByRole("button", { name: /awaiting rsvp/i }).click();
    await expect(card.getByRole("button", { name: /^attending$/i })).toBeVisible();
    await expect.poll(async () => (await dbPerson(one.id))?.rsvpStatus).toBe("attending");
    await expect(card.getByLabel("Street")).toHaveValue("Draft street");
    await expect(card.getByLabel("Table #")).toHaveValue("3");

    await card.getByRole("button", { name: "+ Add gift" }).click();
    await expect(card.getByPlaceholder("Gift, card, or cash note")).toHaveCount(1);
    await expect(card.getByLabel("Street")).toHaveValue("Draft street");
    await expect(card.getByLabel("Seat / spot")).toHaveValue("head");

    await card.getByRole("button", { name: "Save guests" }).click();
    await expect.poll(async () => (await prisma.guest.findUnique({ where: { id: pair.id } }))?.street).toBe("Draft street");
    expect((await dbPerson(one.id))?.tableNumber).toBe(3);
    expect((await dbPerson(one.id))?.tableSpot).toBe("head");
    guards.assertClean();
  });

  test("address, seat and phone round-trip through Save guests and reload, and clearing them stores nothing", async ({ page }) => {
    const guards = attachGuards(page);
    const { pair } = await seedHouseholds();
    const one = personByName(pair, ONE);
    let card = await openCard(page, ONE);
    const long = "L".repeat(2000);
    await card.getByLabel("Street").fill(long);
    await card.getByLabel("City").fill('Test 🎉 "City" <b>x</b>');
    await card.getByLabel("State").fill("   ");
    await card.getByLabel("ZIP").fill("007");
    await card.getByLabel("Table #").fill("12");
    await card.getByLabel("Seat / spot").fill("  head  ");
    await card.getByRole("button", { name: "Save guests" }).click();
    await expect.poll(async () => (await prisma.guest.findUnique({ where: { id: pair.id } }))?.zip).toBe("007");
    const saved = await prisma.guest.findUniqueOrThrow({ where: { id: pair.id } });
    expect(saved.street).toBe(long);
    expect(saved.city).toBe('Test 🎉 "City" <b>x</b>');
    expect(saved.state, "whitespace-only state is stored as nothing").toBeNull();
    expect((await dbPerson(one.id))?.tableSpot).toBe("head");
    await expectNoSidewaysScroll(page);

    const phone = card.getByLabel("Phone");
    await phone.fill("555-0100");
    await phone.press("Tab");
    await expect.poll(async () => (await prisma.guest.findUnique({ where: { id: pair.id } }))?.phone).toBe("555-0100");

    await page.reload();
    card = await openCard(page, ONE);
    await expect(card.getByLabel("Street")).toHaveValue(long);
    await expect(card.getByLabel("City")).toHaveValue('Test 🎉 "City" <b>x</b>');
    await expect(card.getByLabel("State")).toHaveValue("");
    await expect(card.getByLabel("ZIP")).toHaveValue("007");
    await expect(card.getByLabel("Table #")).toHaveValue("12");
    await expect(card.getByLabel("Seat / spot")).toHaveValue("head");
    await expect(card.getByLabel("Phone")).toHaveValue("555-0100");
    await expectNoSidewaysScroll(page);

    await card.getByLabel("Street").fill("");
    await card.getByLabel("City").fill("");
    await card.getByLabel("ZIP").fill("");
    await card.getByLabel("Seat / spot").fill("");
    await card.getByRole("button", { name: "Save guests" }).click();
    await expect.poll(async () => (await prisma.guest.findUnique({ where: { id: pair.id } }))?.street).toBeNull();
    const cleared = await prisma.guest.findUniqueOrThrow({ where: { id: pair.id } });
    expect([cleared.city, cleared.zip]).toEqual([null, null]);
    expect((await dbPerson(one.id))?.tableSpot).toBeNull();

    await card.getByLabel("Phone").fill("   ");
    await card.getByLabel("Phone").press("Tab");
    await expect.poll(async () => (await prisma.guest.findUnique({ where: { id: pair.id } }))?.phone).toBeNull();
    guards.assertClean();
  });

  test("gifts: Add gift focuses the new row, Enter saves the text, Written and Sent stick, Remove gift deletes it", async ({ page }) => {
    const guards = attachGuards(page);
    const { single } = await seedHouseholds();
    const card = await openCard(page, THREE);
    await card.getByRole("button", { name: "+ Add gift" }).click();
    const gift = card.getByPlaceholder("Gift, card, or cash note");
    await expect(gift).toBeFocused();
    await gift.pressSequentially("Test gift 'q' \"dq\" 🎁", { delay: 5 });
    await gift.press("Enter");
    await expect.poll(async () => (await prisma.guestGift.findMany({ where: { guestId: single.id } })).map((g) => g.description)).toEqual([
      "Test gift 'q' \"dq\" 🎁",
    ]);

    await card.getByLabel("Written").check();
    await card.getByLabel("Sent").check();
    await expect.poll(async () => {
      const row = await prisma.guestGift.findFirst({ where: { guestId: single.id } });
      return [row?.thankYouWritten, row?.thankYouSent, row?.thanked];
    }).toEqual([true, true, true]);

    await page.reload();
    const again = await openCard(page, THREE);
    await expect(again.getByPlaceholder("Gift, card, or cash note")).toHaveValue("Test gift 'q' \"dq\" 🎁");
    await expect(again.getByLabel("Written")).toBeChecked();
    await expect(again.getByLabel("Sent")).toBeChecked();

    await again.getByRole("button", { name: "Remove gift" }).click();
    await expect(again.getByPlaceholder("Gift, card, or cash note")).toHaveCount(0);
    await expect.poll(async () => prisma.guestGift.count({ where: { guestId: single.id } })).toBe(0);
    guards.assertClean();
  });

  test("role and RSVP pills cycle, save and come back after reload", async ({ page }) => {
    const guards = attachGuards(page);
    const { single } = await seedHouseholds();
    const three = personByName(single, THREE);
    const card = await openCard(page, THREE);
    await card.getByRole("button", { name: /awaiting rsvp/i }).click();
    await expect(card.getByRole("button", { name: /^attending$/i })).toBeVisible();
    await expect.poll(async () => (await dbPerson(three.id))?.rsvpStatus).toBe("attending");
    const rolePill = card.getByRole("button", { name: "Guest", exact: true });
    await rolePill.click();
    await expect(rolePill).toHaveCount(0);
    await expect.poll(async () => (await dbPerson(three.id))?.directoryLabel, { timeout: 15_000 }).not.toBeNull();
    const label = (await dbPerson(three.id))?.directoryLabel ?? "";

    await page.reload();
    const again = await openCard(page, THREE);
    await expect(again.getByRole("button", { name: /^attending$/i })).toBeVisible();
    await expect(again.getByRole("button", { name: label, exact: true })).toBeVisible();
    guards.assertClean();
  });

  test("uploading a photo saves it; a file that is not really an image shows a message instead of breaking the page", async ({ page }) => {
    const guards = attachGuards(page, { allow: /could not be decoded/ });
    const { single } = await seedHouseholds();
    const three = personByName(single, THREE);
    const card = await openCard(page, THREE);

    await card.getByRole("button", { name: /photo for/ }).click();
    const [goodChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByRole("button", { name: "Upload photo" }).click(),
    ]);
    await goodChooser.setFiles({ name: "red.png", mimeType: "image/png", buffer: RED_PNG });
    await expect.poll(async () => (await dbPerson(three.id))?.photoData?.slice(0, 15)).toBe("data:image/jpeg");

    await card.getByRole("button", { name: /photo for/ }).click();
    const [badChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByRole("button", { name: "Upload photo" }).click(),
    ]);
    await badChooser.setFiles({ name: "broken.png", mimeType: "image/png", buffer: NOT_A_PNG });
    await expect(card.getByRole("alert")).toContainText("couldn’t be read");
    await expect(page.getByLabel("Search guests")).toBeVisible();
    expect((await dbPerson(three.id))?.photoData?.slice(0, 15), "the good photo is kept").toBe("data:image/jpeg");
    guards.assertClean();
  });

  test("search filters the cards, the table view groups by table and the print page lists names and gifts", async ({ page }) => {
    const guards = attachGuards(page);
    const { pair, single } = await seedHouseholds();
    await prisma.guestPerson.update({ where: { id: personByName(pair, ONE).id }, data: { tableNumber: 4, tableSpot: "2" } });
    await prisma.guestGift.create({ data: { guestId: single.id, description: "Test gift card" } });

    await page.goto("/people?tab=guests&manage=1");
    const search = page.getByLabel("Search guests");
    await search.fill("Three");
    await expect(page.locator("article")).toHaveCount(1);
    await search.fill("zzz-no-such-guest");
    await expect(page.getByText("No guests matching your search.")).toBeVisible();
    await search.fill("");
    await expect(page.locator("article").filter({ hasText: /Test Guest/ })).toHaveCount(3);

    await page.goto("/people?tab=guests&view=table");
    await expect(page.getByText(tableSeatingLabel(4), { exact: true })).toBeVisible();
    await expect(page.getByText("Seat 2")).toBeVisible();
    await expectNoSidewaysScroll(page);

    await page.goto("/guests/print");
    const table = page.locator("table");
    await expect(table).toContainText(THREE);
    await expect(table).toContainText("Test gift card");
    await expect(table).toContainText(ONE);
    await expect(page.getByRole("button", { name: "Print" })).toBeVisible();
    await expectNoSidewaysScroll(page);
    guards.assertClean();
  });
});
