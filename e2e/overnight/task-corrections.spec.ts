import { expect, test } from "@playwright/test";
import { overnightPrisma, resetOvernightData, snapshotTasks } from "./db";
import { openPacket } from "./helpers";
import { NEW_TASKS } from "../../src/lib/task-corrections";

const prisma = overnightPrisma();

test.describe.configure({ mode: "serial" });

let restoreTasks: (() => Promise<void>) | null = null;

async function seedCards() {
  if (restoreTasks) await restoreTasks();
  else {
    await resetOvernightData(prisma);
    restoreTasks = await snapshotTasks(prisma);
  }
  // The test copy has no curated cards, so add two the way the app's own cards are shaped.
  const sword = await prisma.task.create({ data: { title: "Ceremony Flower Sword" } });
  await prisma.task.create({ data: { title: "Receive the ordered sword", parentId: sword.id } });
  await prisma.task.create({ data: { title: "Decorate the sword with faux flowers", parentId: sword.id } });
  const drinks = await prisma.task.create({ data: { title: "Wedding Drinks & Serving Supplies" } });
  await prisma.task.create({ data: { title: "Finalize the complete wedding drink menu", parentId: drinks.id } });
  await prisma.task.create({ data: { title: "Order the remaining s'mores ingredients", parentId: drinks.id } });
  // A job added by hand with its own wording note: Apply must not add it again or touch it.
  await prisma.task.create({
    data: { title: "Alpine Events: Pick up the rentals", planNotes: "Kept as typed", dueDate: new Date("2026-10-14T12:00:00") },
  });
  // Pam and Bryan share one guest household with Bryan's number on it; Pam has no number of her own yet.
  await removePeople();
  await prisma.person.create({ data: { id: "e2e-pam", name: "Pam Balasa", directoryList: "guests" } });
  await prisma.person.create({ data: { id: "e2e-bryan", name: "Bryan Balasa", directoryList: "guests" } });
  await prisma.guest.create({
    data: {
      id: "e2e-balasa-house",
      nameLine1: "Bryan & Pam Balasa",
      phone: HOUSE_PHONE,
      people: {
        create: [
          { name: "Bryan Balasa", personId: "e2e-bryan" },
          { name: "Pam Balasa", personId: "e2e-pam" },
        ],
      },
    },
  });
}

const HOUSE_PHONE = "616-555-0142";

async function removePeople() {
  await prisma.contact.deleteMany({ where: { personId: { in: ["e2e-pam", "e2e-bryan"] } } });
  await prisma.guest.deleteMany({ where: { id: "e2e-balasa-house" } });
  await prisma.person.deleteMany({ where: { id: { in: ["e2e-pam", "e2e-bryan"] } } });
}
test.afterAll(async () => {
  await restoreTasks?.();
  await removePeople();
  await prisma.$disconnect();
});

test("Apply adds the dated jobs once and ticks only the marked steps", async ({ page }) => {
  // Each run (desktop, phone) starts from the same test copy.
  await seedCards();
  await page.goto("/plan/tasks");
  const card = page.getByTestId("task-corrections-card");
  await expect(card).toContainText("Task update ready");
  await card.getByRole("button", { name: "See what changes" }).click();
  await expect(card).toContainText("Total Wine: Pick up the alcohol order");
  await expect(card).not.toContainText("Alpine Events");
  await expect(card).toContainText("Ceremony Flower Sword · Receive the ordered sword");
  await expect(card).toContainText("Pam Balasa · 269-475-3751");
  // The card reloads the page once the write is done; wait for that load so the next visit is not cut short.
  const reloaded = page.waitForEvent("load");
  await card.getByRole("button", { name: "Apply to tasks" }).click();
  await reloaded;
  await expect(page.getByTestId("task-corrections-card")).toHaveCount(0);

  for (const def of NEW_TASKS) {
    const rows = await prisma.task.findMany({ where: { title: def.title } });
    expect(rows, def.title).toHaveLength(1);
  }
  const alpine = await prisma.task.findFirstOrThrow({ where: { title: "Alpine Events: Pick up the rentals" } });
  expect(alpine.planNotes).toBe("Kept as typed");
  expect(alpine.dueDate?.getDate()).toBe(14);
  const totalWine = await prisma.task.findFirstOrThrow({ where: { title: "Total Wine: Pick up the alcohol order" } });
  expect(totalWine.dueDate?.getDate()).toBe(12);

  const status = async (title: string) => (await prisma.task.findFirstOrThrow({ where: { title } })).status;
  expect(await status("Receive the ordered sword")).toBe("done");
  expect(await status("Ceremony Flower Sword")).toBe("done");
  expect(await status("Order the remaining s'mores ingredients")).toBe("done");
  expect(await status("Finalize the complete wedding drink menu")).toBe("todo");
  expect(await status("Wedding Drinks & Serving Supplies")).toBe("todo");
  expect(await status("Confirm final payments / tip envelopes ready")).toBe("todo");
  expect(await status("Confirm week-of plans with each other")).toBe("done");

  // Pam's number is on her own contact; the household number Bryan uses is untouched.
  const pam = await prisma.contact.findFirstOrThrow({ where: { personId: "e2e-pam" } });
  expect(pam.phone).toBe("269-475-3751");
  expect(pam.name).toBe("Pam Balasa");
  expect((await prisma.guest.findUniqueOrThrow({ where: { id: "e2e-balasa-house" } })).phone).toBe(HOUSE_PHONE);
  expect(await prisma.contact.count({ where: { personId: "e2e-bryan" } })).toBe(0);
  await page.goto("/people/" + encodeURIComponent("person:e2e-pam"));
  await expect(page.locator("main")).toContainText("269-475-3751");
  await page.goto("/people/" + encodeURIComponent("person:e2e-bryan"));
  await expect(page.locator("main")).toContainText(HOUSE_PHONE);
  await expect(page.locator("main")).not.toContainText("269-475-3751");
  await page.goto("/plan/tasks");

  // Nothing left to apply: the card stays away after a reload.
  await page.reload();
  await expect(page.getByTestId("print-section-tasks")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  await expect(page.getByTestId("task-corrections-card")).toHaveCount(0);
});

test("What's left prints the Monday and Tuesday jobs under their days", async ({ page }) => {
  await openPacket(page, "left");
  const day = (name: string) => page.locator(".binder-block", { has: page.locator("h3", { hasText: name }) });
  await expect(day("Monday, October 12")).toContainText("Total Wine: Pick up the alcohol order");
  await expect(day("Tuesday, October 13")).toContainText("Robinette’s: Get 5–7 gallons of cider for serving hot");
  await expect(day("Tuesday, October 13")).toContainText("A Perfect Fit Alterations: Pick up Haley’s dress with the bustle completed");
  await expect(day("Wednesday, October 14")).toContainText("Alpine Events: Pick up the rentals");
  await expect(page.getByTestId("print-section-tasks")).not.toContainText("Receive the ordered sword");
});

test("a different number already saved is shown beside Pam's new one, and only her pick replaces it", async ({ page }) => {
  await seedCards();
  await prisma.contact.create({ data: { name: "Pam Balasa", personId: "e2e-pam", phone: "231-555-0100", directoryList: "guests" } });
  await page.goto("/plan/tasks");
  const card = page.getByTestId("task-corrections-card");
  await card.getByRole("button", { name: "See what changes" }).click();
  await expect(card).toContainText("Pam Balasa · saved: 231-555-0100");
  const reloaded = page.waitForEvent("load");
  await card.getByRole("button", { name: "Apply to tasks" }).click();
  await reloaded;
  await expect(card).toContainText("Pam Balasa · saved: 231-555-0100");
  expect((await prisma.contact.findFirstOrThrow({ where: { personId: "e2e-pam" } })).phone).toBe("231-555-0100");
  await card.getByRole("button", { name: "Use 269-475-3751 instead" }).click();
  await expect(page.getByTestId("task-corrections-card")).toHaveCount(0);
  expect((await prisma.contact.findFirstOrThrow({ where: { personId: "e2e-pam" } })).phone).toBe("269-475-3751");
  expect(await prisma.contact.count({ where: { personId: "e2e-pam" } })).toBe(1);
});
