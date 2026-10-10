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
