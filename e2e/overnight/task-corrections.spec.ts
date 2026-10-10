import { expect, test } from "@playwright/test";
import { overnightPrisma, resetOvernightData, snapshotTasks } from "./db";
import { openPacket } from "./helpers";
import { NEW_TASKS } from "../../src/lib/task-corrections";

const prisma = overnightPrisma();

test.describe.configure({ mode: "serial" });

let restoreTasks: (() => Promise<void>) | null = null;

async function seedCards() {
  await resetOvernightData(prisma);
  restoreTasks = await snapshotTasks(prisma);
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
}
test.afterAll(async () => {
  await restoreTasks?.();
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
  await card.getByRole("button", { name: "Apply to tasks" }).click();
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
