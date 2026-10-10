import { readFileSync } from "node:fs";
import { expect, test, type Browser } from "@playwright/test";
import { parseBlockNotes } from "../../src/lib/day-of-now";
import { BUNKS_NOTE, RECONCILED_RETIRED_SEED_KEYS, RECONCILED_TIMELINE, reconciledNotes } from "../../src/lib/reconciled-timeline";
import { BUNKS_NOTE_ON_JOB, NEW_TASKS } from "../../src/lib/task-corrections";
import { overnightPrisma, resetOvernightData, snapshotTasks } from "./db";
import { attachGuards } from "./helpers";

// David, 2026-10-10: "can you auto apply the changes so I stop needing to hit apply?"
const prisma = overnightPrisma();
test.describe.configure({ mode: "serial" });

let restoreTasks: (() => Promise<void>) | null = null;
test.beforeAll(async () => {
  restoreTasks = await snapshotTasks(prisma);
});
test.afterAll(async () => {
  await restoreTasks?.();
  await resetOvernightData(prisma);
  await prisma.$disconnect();
});

/** David's master account in a browser that has not run this build's pass yet. */
async function freshMaster(browser: Browser) {
  const saved = JSON.parse(readFileSync("test-artifacts/overnight/.auth/master.json", "utf8"));
  return browser.newContext({ storageState: { cookies: saved.cookies, origins: [] } });
}

const DOC_WEDDING = RECONCILED_TIMELINE.filter((moment) => moment.schedule === "wedding").length;

async function weddingTitles() {
  const rows = await prisma.timelineBlock.findMany({ where: { schedule: "wedding" } });
  return rows.map((row) => parseBlockNotes(row.notes).title);
}

test("the first page load applies every card's additions once and says what changed", async ({ browser }) => {
  await resetOvernightData(prisma, { reconciled: false });
  await restoreTasks?.();
  // His own note on a job a card also writes: the note he wrote stays.
  await prisma.task.create({ data: { title: "Send the check to Precious Peony", summary: "Mailed from the downtown branch" } });

  const context = await freshMaster(browser);
  const page = await context.newPage();
  const guards = attachGuards(page);
  await page.goto("/today");
  const applied = page.getByTestId("auto-applied");
  await expect(applied).toBeVisible({ timeout: 30_000 });
  await expect(applied).toContainText("Applied just now:");
  await applied.getByRole("button", { name: /Show all \d+/ }).click();
  await expect(applied).toContainText("Added to the Wedding Day timeline: 8:50 PM Night-sky photos and Barry finishes");
  await expect(applied).toContainText("Added “Total Wine: Pick up the alcohol order” (Mon, Oct 12)");
  await expect(applied).toContainText("Marked done: Send the check to Precious Peony");

  // Every new job once, the document's moments on the page, his note kept.
  for (const def of NEW_TASKS) {
    expect(await prisma.task.count({ where: { title: def.title } }), def.title).toBeLessThanOrEqual(1);
  }
  const check = await prisma.task.findFirstOrThrow({ where: { title: "Send the check to Precious Peony" } });
  expect(check.summary).toBe("Mailed from the downtown branch");
  expect(check.status).toBe("done");
  const wedding = await weddingTitles();
  expect(wedding.filter((title) => title === "Night-sky photos and Barry finishes")).toHaveLength(1);

  // Removing rows still waits for his tap: the folded-away moments are still there, on the card.
  const retired = await prisma.timelineBlock.count({ where: { seedKey: { in: RECONCILED_RETIRED_SEED_KEYS } } });
  expect(retired).toBeGreaterThan(0);
  await page.goto("/plan/timeline");
  const card = page.locator("section").filter({ hasText: "Reconciled timeline update ready" });
  await expect(card).toContainText("0 new moments");
  await expect(card).toContainText(`${retired} moment${retired === 1 ? "" : "s"} folded into others`);
  await card.getByRole("button", { name: "Apply to the timeline" }).click();
  await expect(page.getByRole("button", { name: /Apply(ing…| to the timeline)/ })).toHaveCount(0, { timeout: 20_000 });
  expect((await weddingTitles()).length).toBe(DOC_WEDDING);

  // The same browser does not run the pass again for this build.
  await page.goto("/today");
  await expect(page.getByRole("heading").first()).toBeVisible();
  await expect(page.getByTestId("auto-applied")).toHaveCount(0);
  await guards.assertClean();
  await context.close();
});

test("two phones loading at once add nothing twice", async ({ browser }) => {
  await resetOvernightData(prisma, { reconciled: false });
  await restoreTasks?.();
  const contexts = await Promise.all([freshMaster(browser), freshMaster(browser)]);
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  await Promise.all(pages.map((page) => page.goto("/plan/tasks")));
  // One of them reports the changes; the other finds nothing left to do.
  await expect.poll(async () => (await Promise.all(pages.map((page) => page.getByTestId("auto-applied").count()))).reduce((a, b) => a + b), { timeout: 30_000 }).toBe(1);

  for (const def of NEW_TASKS) {
    expect(await prisma.task.count({ where: { title: def.title } }), def.title).toBeLessThanOrEqual(1);
  }
  const seedKeys = (await prisma.timelineBlock.findMany({ select: { seedKey: true } })).map((row) => row.seedKey).filter(Boolean);
  expect(new Set(seedKeys).size).toBe(seedKeys.length);
  await Promise.all(contexts.map((context) => context.close()));
});

test("a job or moment he removes after it was applied stays removed", async ({ browser }) => {
  // Carries on from the test above: everything is applied and recorded.
  await prisma.task.deleteMany({ where: { title: "Total Wine: Pick up the alcohol order" } });
  const nightSky = await prisma.timelineBlock.findUniqueOrThrow({ where: { seedKey: "wedding_night_sky_photos" } });
  await prisma.timelineBlock.delete({ where: { id: nightSky.id } });
  const marked = await prisma.task.findFirstOrThrow({ where: { title: "Bank and post office before the post office closes at noon" } });
  await prisma.task.update({ where: { id: marked.id }, data: { status: "todo", completedAt: null } });

  const context = await freshMaster(browser);
  const page = await context.newPage();
  await page.goto("/plan/tasks");
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  // Give the pass time to run; it must find nothing.
  await page.waitForTimeout(3_000);
  await expect(page.getByTestId("auto-applied")).toHaveCount(0);
  await expect(page.getByTestId("task-corrections-card")).toHaveCount(0);
  expect(await prisma.task.count({ where: { title: "Total Wine: Pick up the alcohol order" } })).toBe(0);
  expect(await prisma.timelineBlock.count({ where: { seedKey: "wedding_night_sky_photos" } })).toBe(0);
  expect((await prisma.task.findUniqueOrThrow({ where: { id: marked.id } })).status).toBe("todo");
  // The Wedding Day card offers only the duplicate rows it still folds away, never the removed moment.
  await page.goto("/plan/timeline");
  const card = page.locator("section").filter({ hasText: "Reconciled timeline update ready" });
  await expect(card).toContainText("0 new moments");
  await card.getByRole("button", { name: "See what changes" }).click();
  await expect(card).not.toContainText("Night-sky photos");
  await context.close();
});

/** Thursday's check-in row: seeded with the key as its id, or carrying it as seedKey. */
const CHECKIN = { OR: [{ seedKey: "reh.checkin" }, { id: "reh.checkin" }] };

// David, 2026-10-10 20:32: "skila and Trinity and bri claimed their bunks make a note of that".
test("the bunks note lands on Thursday's check-in moment, or on the sleeping job when he reworded the moment", async ({ browser }) => {
  const moment = RECONCILED_TIMELINE.find((m) => m.seedKey === "reh.checkin")!;
  // As the app wrote it before his bunks note and his check-in's Airbnb address.
  const written = reconciledNotes({
    ...moment,
    location: undefined,
    openItems: "Confirm the Airbnb address and who has check-in access.",
    lines: moment.lines.filter((line) => line !== BUNKS_NOTE),
  });
  const job = { title: BUNKS_NOTE_ON_JOB.title, summary: BUNKS_NOTE_ON_JOB.before };

  // The moment still reads as the app wrote it: the note goes there, not on the job.
  await resetOvernightData(prisma);
  await restoreTasks?.();
  await prisma.timelineBlock.updateMany({ where: CHECKIN, data: { notes: written, startAt: moment.startAt, endAt: moment.endAt } });
  const sleeping = await prisma.task.create({ data: job });
  let context = await freshMaster(browser);
  let page = await context.newPage();
  await page.goto("/today");
  let applied = page.getByTestId("auto-applied");
  await applied.getByRole("button", { name: /Show all \d+/ }).click({ timeout: 30_000 });
  await expect(applied).toContainText("Corrected 1:00 PM Airbnb check in (bunks noted, Airbnb address)");
  expect((await prisma.timelineBlock.findFirstOrThrow({ where: CHECKIN })).notes).toBe(reconciledNotes(moment));
  expect((await prisma.task.findUniqueOrThrow({ where: { id: sleeping.id } })).summary).toBe(BUNKS_NOTE_ON_JOB.before);
  await context.close();

  // He reworded the moment himself: it stays his, and the note goes on the job instead.
  await resetOvernightData(prisma);
  await restoreTasks?.();
  const edited = `${written}\nBring the air mattress`;
  await prisma.timelineBlock.updateMany({ where: CHECKIN, data: { notes: edited, startAt: moment.startAt, endAt: moment.endAt } });
  const sleeping2 = await prisma.task.create({ data: job });
  context = await freshMaster(browser);
  page = await context.newPage();
  await page.goto("/today");
  applied = page.getByTestId("auto-applied");
  await applied.getByRole("button", { name: /Show all \d+/ }).click({ timeout: 30_000 });
  await expect(applied).toContainText("Updated the note on “Finish Airbnb Sleeping Assignments”");
  expect((await prisma.timelineBlock.findFirstOrThrow({ where: CHECKIN })).notes).toBe(edited);
  expect((await prisma.task.findUniqueOrThrow({ where: { id: sleeping2.id } })).summary).toBe(BUNKS_NOTE_ON_JOB.summary);
  await context.close();
});
