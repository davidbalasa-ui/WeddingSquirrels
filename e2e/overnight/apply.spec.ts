import { expect, test } from "@playwright/test";
import { parseBlockNotes } from "../../src/lib/day-of-now";
import { RECONCILED_TIMELINE, reconciledNotes } from "../../src/lib/reconciled-timeline";
import { overnightPrisma, resetOvernightData, snapshotTasks } from "./db";
import { attachGuards, blockByTitle, editCard, expectAllSaved, openPacket, openTimelineEditor } from "./helpers";

const prisma = overnightPrisma();
test.afterAll(async () => prisma.$disconnect());

const DOC_WEDDING = RECONCILED_TIMELINE.filter((m) => m.schedule === "wedding").length;
const DOC_REHEARSAL = RECONCILED_TIMELINE.filter((m) => m.schedule === "rehearsal").length;

async function titles(schedule: "wedding" | "rehearsal") {
  const rows = await prisma.timelineBlock.findMany({ where: { schedule } });
  return rows.map((row) => parseBlockNotes(row.notes).title);
}

test.describe("Apply the reconciled document", () => {
  test("on a fresh timeline adds the document once and leaves no duplicates", async ({ page }) => {
    await resetOvernightData(prisma, { reconciled: false });
    const guards = attachGuards(page);
    await page.goto("/plan/timeline");
    const card = page.locator("section").filter({ hasText: "Reconciled timeline update ready" });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Apply to the timeline" }).click();
    // The card reloads the page once the write is done and the toggle for differing moments takes its place.
    await expect(page.getByRole("button", { name: /reads? differently from the reconciled document/ })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /Apply(ing…| to the timeline)/ })).toHaveCount(0);

    const wedding = await titles("wedding");
    const rehearsal = await titles("rehearsal");
    expect(wedding.length, "wedding moments after Apply").toBe(DOC_WEDDING);
    expect(rehearsal.length, "rehearsal moments after Apply (the 7 old rows must not be doubled)").toBe(DOC_REHEARSAL);
    const dupes = [...rehearsal, ...wedding].filter((title, i, all) => all.indexOf(title) !== i);
    expect(dupes, "repeated titles").toEqual([]);
    // Every page section shows the document's rows, none twice.
    await expect(page.locator(".day-timeline-row")).toHaveCount(DOC_WEDDING);
    await guards.assertClean();
  });

  test("the card stays away after ordinary edits", async ({ page }) => {
    await resetOvernightData(prisma);
    const guards = attachGuards(page);
    const block = await blockByTitle(prisma, "Cake cutting");
    await openTimelineEditor(page);
    const card = editCard(page, block.id);
    await card.scrollIntoViewIfNeeded();
    const notes = card.locator("textarea");
    await notes.click();
    await notes.press("Control+End");
    await notes.pressSequentially("\nOvernight check: knife is on the cake table", { delay: 10 });
    await notes.blur();
    await expectAllSaved(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Apply to the timeline" })).toHaveCount(0);
    await expect(page.getByText(/reads? differently from the reconciled document/)).toBeVisible();
    await guards.assertClean();
  });

  test("on an edited timeline Apply keeps the edit and only re-adds what is missing", async ({ page }) => {
    await resetOvernightData(prisma);
    const guards = attachGuards(page);
    const ceremony = await blockByTitle(prisma, "Ceremony");
    const edited = `${ceremony.notes}\nOvernight check: Marie reads the vows`;
    await prisma.timelineBlock.update({ where: { id: ceremony.id }, data: { notes: edited } });
    const removed = await blockByTitle(prisma, "Dollar dance");
    await prisma.timelineBlock.delete({ where: { id: removed.id } });

    await page.goto("/plan/timeline");
    const card = page.locator("section").filter({ hasText: "Reconciled timeline update ready" });
    await expect(card).toBeVisible();
    await expect(card).toContainText("1 new moment");
    await card.getByRole("button", { name: "See what changes" }).click();
    await expect(card).toContainText("Dollar dance");
    await expect(card).toContainText("Kept as you have them");
    await expect(card).toContainText("Ceremony");
    await card.getByRole("button", { name: "Apply to the timeline" }).click();
    // The card reloads the page once the write is done and the toggle for differing moments takes its place.
    await expect(page.getByRole("button", { name: /reads? differently from the reconciled document/ })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /Apply(ing…| to the timeline)/ })).toHaveCount(0);

    const after = await prisma.timelineBlock.findUnique({ where: { id: ceremony.id } });
    expect(after?.notes, "Apply must not overwrite a page edit").toBe(edited);
    const wedding = await titles("wedding");
    expect(wedding.filter((t) => t === "Dollar dance")).toHaveLength(1);
    expect(wedding.length).toBe(DOC_WEDDING);
    expect((await titles("rehearsal")).length).toBe(DOC_REHEARSAL);
    await expect(page.locator(`#block-${ceremony.id}`)).toContainText("Marie reads the vows");

    // "Use the document's version" is the only way the document's wording comes back.
    await page.getByRole("button", { name: /reads? differently from the reconciled document/ }).click();
    await page.getByRole("button", { name: /Use the document’s version \(3:30 PM – 4:00 PM · Ceremony\)/ }).click();
    await page.waitForLoadState("domcontentloaded");
    const document = RECONCILED_TIMELINE.find((moment) => moment.seedKey === "wedding_ceremony")!;
    await expect
      .poll(async () => (await prisma.timelineBlock.findUnique({ where: { id: ceremony.id } }))?.notes)
      .toBe(reconciledNotes(document));
    await guards.assertClean();
  });
});

// David, 2026-10-10: his printed rehearsal day showed every moment twice. His own rehearsal
// rows (saved without the app's keys) sat next to the document's copies from an earlier Apply.
// At 21:46 the same doubling was on his packet ("tons of issues"); he keeps the full moments.
test("a doubled rehearsal day prints once and Apply folds it back to the full moments, his short rows going on his tap", async ({ page }) => {
  await resetOvernightData(prisma, { reconciled: false });
  const { parsedTimeFields } = await import("../../src/lib/day-of-time");
  const own = [
    { startAt: "1:00 PM", endAt: null, notes: "Airbnb Check-in\n- Wedding party arrives" },
    { startAt: "2:30 PM", endAt: null, notes: "Get ready; Hair and makeup" },
    { startAt: "3:45 PM", endAt: null, notes: "Depart Airbnb" },
    { startAt: "4:15 PM", endAt: "5:40 PM", notes: "Dinner\nLocation: Hawkshead" },
    { startAt: "5:40 PM", endAt: null, notes: "Depart for Black Sheep Shelter" },
    { startAt: "6:00 PM", endAt: "7:00 PM", notes: "Rehearsal" },
    { startAt: "7:15 PM", endAt: null, notes: "Return to Airbnb" },
  ];
  await prisma.timelineBlock.deleteMany({ where: { schedule: "rehearsal" } });
  for (const [index, row] of own.entries()) {
    await prisma.timelineBlock.create({
      data: { id: `own-${index}`, schedule: "rehearsal", sortOrder: index, ...row, ...parsedTimeFields(row.startAt, row.endAt) },
    });
  }
  // The copies an earlier Apply put beside them, word for word from the document.
  for (const [index, moment] of RECONCILED_TIMELINE.filter((m) => m.schedule === "rehearsal").entries()) {
    await prisma.timelineBlock.create({
      data: {
        seedKey: moment.seedKey,
        schedule: "rehearsal",
        sortOrder: 20 + index,
        startAt: moment.startAt,
        endAt: moment.endAt,
        notes: reconciledNotes(moment),
        ...parsedTimeFields(moment.startAt, moment.endAt),
      },
    });
  }
  // Before any tap, the wedding party packet already prints each Thursday moment once.
  await openPacket(page, "party");
  const schedule = page.getByTestId("print-section-schedule");
  await expect(schedule).toContainText("Airbnb check in");
  await expect(schedule).not.toContainText("Airbnb Check-in");
  await expect(schedule).not.toContainText("Return to Airbnb");
  await page.goto("/plan/timeline");
  const card = page.locator("section").filter({ hasText: "Reconciled timeline update ready" });
  await card.getByRole("button", { name: "See what changes" }).click();
  await expect(card).toContainText("Folded into other moments");
  const reloaded = page.waitForEvent("load");
  await card.getByRole("button", { name: "Apply to the timeline" }).click();
  await reloaded;
  await expect(page.getByRole("button", { name: /Apply(ing…| to the timeline)/ })).toHaveCount(0, { timeout: 20_000 });

  const rows = await prisma.timelineBlock.findMany({ where: { schedule: "rehearsal" } });
  const times = rows.map((row) => row.startAt);
  expect(times.filter((time, i) => times.indexOf(time) !== i), "a start time twice").toEqual([]);
  // His short rows said nothing the full moments do not, so they went; every full moment stayed.
  expect(rows.filter((r) => r.id.startsWith("own-"))).toEqual([]);
  for (const moment of RECONCILED_TIMELINE.filter((m) => m.schedule === "rehearsal")) {
    expect(rows.filter((r) => r.seedKey === moment.seedKey), moment.seedKey).toHaveLength(1);
  }
  // A second visit has nothing left to fold. The card reloads the page itself after Apply,
  // so a visit can be cut short by that reload; try again until one lands.
  await expect(async () => {
    await page.goto("/plan/timeline");
    await expect(page.getByRole("heading").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Apply to the timeline" })).toHaveCount(0);
  }).toPass({ timeout: 20_000 });
  await resetOvernightData(prisma);
});

test("a timeline that matches the document says there is nothing to apply", async ({ page }) => {
  await resetOvernightData(prisma, { reconciled: false });
  const { parsedTimeFields } = await import("../../src/lib/day-of-time");
  await prisma.task.updateMany({ where: { timelineBlockId: { not: null } }, data: { timelineBlockId: null } });
  await prisma.timelineBlock.deleteMany({});
  for (const [index, moment] of RECONCILED_TIMELINE.entries()) {
    await prisma.timelineBlock.create({
      data: {
        seedKey: moment.seedKey,
        schedule: moment.schedule,
        sortOrder: index,
        startAt: moment.startAt,
        endAt: moment.endAt,
        notes: reconciledNotes(moment),
        ...parsedTimeFields(moment.startAt, moment.endAt),
      },
    });
  }
  await page.goto("/plan/timeline");
  await expect(page.getByTestId("reconciled-up-to-date")).toHaveText(
    "Everything from the reconciled timeline document is already on the page. Nothing to apply.",
  );
  await expect(page.getByRole("button", { name: "Apply to the timeline" })).toHaveCount(0);
  await resetOvernightData(prisma);
});

// David, 2026-10-10: "No apply button on wedding day." When nothing is left to apply the
// page says so, and a Thursday moment doubled with both copies edited is listed for him to
// pick which one stays.
test("a doubled rehearsal moment with both copies edited is listed with one tap to keep either", async ({ page }) => {
  await resetOvernightData(prisma);
  const guards = attachGuards(page);
  const { parsedTimeFields } = await import("../../src/lib/day-of-time");
  // The document's Thursday copies (as an earlier Apply left them), the dinner one edited,
  // next to David's own dinner row saved without a key.
  await prisma.timelineBlock.deleteMany({ where: { schedule: "rehearsal" } });
  for (const [index, moment] of RECONCILED_TIMELINE.filter((m) => m.schedule === "rehearsal").entries()) {
    const notes = reconciledNotes(moment);
    await prisma.timelineBlock.create({
      data: {
        seedKey: moment.seedKey,
        schedule: "rehearsal",
        sortOrder: index,
        startAt: moment.startAt,
        endAt: moment.endAt,
        notes: moment.seedKey === "reh.dinner" ? `${notes}\nBring the place cards` : notes,
        ...parsedTimeFields(moment.startAt, moment.endAt),
      },
    });
  }
  const dinner = RECONCILED_TIMELINE.find((m) => m.seedKey === "reh.dinner")!;
  const docCopy = await prisma.timelineBlock.findFirstOrThrow({ where: { seedKey: dinner.seedKey } });
  await prisma.timelineBlock.create({
    data: {
      id: "own-dinner",
      schedule: "rehearsal",
      sortOrder: 50,
      startAt: dinner.startAt,
      endAt: dinner.endAt,
      notes: "Dinner\nLocation: Hawkshead",
      ...parsedTimeFields(dinner.startAt, dinner.endAt),
    },
  });

  await page.goto("/plan/timeline");
  const doubles = page.getByTestId("reconciled-doubles");
  await expect(doubles).toContainText("1 rehearsal moment is on the page twice");
  await expect(doubles.getByRole("button", { name: "Keep “Dinner”" })).toBeVisible();
  const reloaded = page.waitForEvent("load");
  await doubles.getByRole("button", { name: "Keep “Dinner”" }).click();
  await reloaded;

  await expect.poll(() => prisma.timelineBlock.count({ where: { id: docCopy.id } })).toBe(0);
  expect((await prisma.timelineBlock.findUnique({ where: { id: "own-dinner" } }))?.notes).toBe("Dinner\nLocation: Hawkshead");
  await expect(async () => {
    await page.goto("/plan/timeline");
    await expect(page.getByRole("heading").first()).toBeVisible();
    await expect(page.getByTestId("reconciled-doubles")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Apply to the timeline" })).toHaveCount(0);
  }).toPass({ timeout: 20_000 });
  await guards.assertClean();
  await resetOvernightData(prisma);
});

// David, 2026-10-10: "it says san instead of dan, that needs corrected everywhere, but it
// should come from one spot". The spot is the reconciled timeline; rows the app wrote with
// San and never edited are corrected by the two Apply cards, nothing else is touched.
test("the getaway moment and its Day-of job read Dan after the Apply taps", async ({ page }) => {
  await resetOvernightData(prisma);
  // The tasks card also adds David's jobs; they go again afterwards so later checks start clean.
  const restoreTasks = await snapshotTasks(prisma);
  const guards = attachGuards(page);
  const moment = RECONCILED_TIMELINE.find((m) => m.seedKey === "wedding_getaway_arrives")!;
  const oldNotes = reconciledNotes(moment).replace(/\bDan\b/g, "San");
  const row = await prisma.timelineBlock.findFirstOrThrow({ where: { seedKey: moment.seedKey } });
  await prisma.timelineBlock.update({ where: { id: row.id }, data: { notes: oldNotes } });
  const job = await prisma.dayAssignment.create({
    data: {
      title: "MOB or another helper meets San Vandenheede.",
      notes: "8:20 PM · Getaway vehicle arrives. Show San where to park, give him the “Just Married” sign, and tell the groom.",
      sortOrder: 99,
    },
  });

  await page.goto("/plan/timeline");
  const card = page.locator("section").filter({ hasText: "Reconciled timeline update ready" });
  await card.getByRole("button", { name: "See what changes" }).click();
  await expect(card).toContainText("Getaway vehicle arrives (San → Dan)");
  let reloaded = page.waitForEvent("load");
  await card.getByRole("button", { name: "Apply to the timeline" }).click();
  await reloaded;
  await expect.poll(async () => (await prisma.timelineBlock.findUnique({ where: { id: row.id } }))?.notes).toBe(reconciledNotes(moment));

  await page.goto("/plan/tasks");
  const tasksCard = page.getByTestId("task-corrections-card");
  await tasksCard.getByRole("button", { name: "See what changes" }).click();
  await expect(tasksCard).toContainText("MOB or another helper meets Dan Vandenheede. (San → Dan)");
  reloaded = page.waitForEvent("load");
  await tasksCard.getByRole("button", { name: "Apply to tasks" }).click();
  await reloaded;
  await expect.poll(async () => (await prisma.dayAssignment.findUnique({ where: { id: job.id } }))?.title).toBe(
    "MOB or another helper meets Dan Vandenheede.",
  );
  expect(await prisma.dayAssignment.count({ where: { title: { contains: "Vandenheede" } } })).toBe(1);
  await guards.assertClean();
  await restoreTasks();
  await resetOvernightData(prisma);
});
