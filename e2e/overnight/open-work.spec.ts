import { expect, test } from "@playwright/test";
import { overnightPrisma, resetOvernightData } from "./db";
import { PACKETS, openPacket } from "./helpers";

const prisma = overnightPrisma();
const DONE_STEP = "Confirm week-of plans with each other";
const OPEN_STEP = "Confirm final payments / tip envelopes ready";

test.beforeAll(async () => {
  await resetOvernightData(prisma);
  // One finished step in "Week before", and every step of "Day before" finished.
  await prisma.task.updateMany({ where: { title: DONE_STEP }, data: { status: "done", completedAt: new Date() } });
  const dayBefore = await prisma.task.findFirstOrThrow({ where: { title: "Day before", parentId: null } });
  await prisma.task.updateMany({ where: { parentId: dayBefore.id }, data: { status: "done", completedAt: new Date() } });
});
test.afterAll(async () => {
  await resetOvernightData(prisma);
  await prisma.$disconnect();
});

// David, 2026-10-10: the Open work pages should not list closed and completed work.
test("Open work prints only what is still open", async ({ page }) => {
  let withOpenWork = 0;
  for (const packet of PACKETS) {
    await openPacket(page, packet.id);
    const section = page.getByTestId("print-section-tasks");
    if ((await section.count()) === 0) continue;
    withOpenWork++;
    const text = await section.innerText();
    expect(text, packet.title).toContain(OPEN_STEP);
    expect(text, packet.title).not.toContain(DONE_STEP);
    expect(text, packet.title).not.toContain("☑");
    // A group with nothing left open leaves its heading out too.
    expect(text, packet.title).not.toMatch(/^Day before$/m);
    expect(text, packet.title).not.toContain("Rehearsal time + dinner locked");
  }
  expect(withOpenWork).toBeGreaterThan(0);
});

test("What's left prints only the open work, and completed work is its own section", async ({ page }) => {
  const text = await openPacket(page, "left");
  await expect(page.getByTestId("print-section-tasks")).toBeVisible();
  await expect(page.getByTestId("print-section-tasks-done")).toHaveCount(0);
  expect(text).toContain(OPEN_STEP);
  expect(text).not.toContain(DONE_STEP);
  expect(text).not.toContain("☑");
  // Only the open work: no run sheet, guests or money.
  await expect(page.locator(".binder-doc h2")).toHaveText(["Open work"]);

  // The binder leaves completed work out until it is ticked on; then it prints in its own section.
  await openPacket(page, "binder");
  const doneBox = page.locator('input[data-print-section="tasksDone"]');
  await expect(doneBox).not.toBeChecked();
  await expect(page.getByTestId("print-section-tasks-done")).toHaveCount(0);
  await doneBox.check();
  const done = page.getByTestId("print-section-tasks-done");
  await expect(done).toContainText("Completed work");
  await expect(done).toContainText(DONE_STEP);
  await expect(done).toContainText("Rehearsal time + dinner locked");
  await expect(done).not.toContainText(OPEN_STEP);
  await expect(page.getByTestId("print-section-tasks")).not.toContainText(DONE_STEP);
});
