import { expect, test } from "@playwright/test";
import { parseBlockNotes } from "../../src/lib/day-of-now";
import { RECONCILED_TIMELINE, reconciledNotes } from "../../src/lib/reconciled-timeline";
import { overnightPrisma, resetOvernightData } from "./db";
import { attachGuards, blockByTitle, editCard, expectAllSaved, openTimelineEditor } from "./helpers";

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
test("a doubled rehearsal day is folded back to one row per moment, keeping David's own rows", async ({ page }) => {
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
  // David's own rows are all still there, word for word. The one still reading exactly as the
  // app first seeded it ("Get ready; Hair and makeup") gives way to the document's copy.
  for (const [index, row] of own.entries()) {
    if (index === 1) continue;
    expect(rows.find((r) => r.id === `own-${index}`)?.notes).toBe(row.notes);
  }
  expect(rows.find((r) => r.id === "own-1")).toBeUndefined();
  expect(rows.filter((r) => r.seedKey === "reh.getready")).toHaveLength(1);
  // A second visit has nothing left to fold. The card reloads the page itself after Apply,
  // so a visit can be cut short by that reload; try again until one lands.
  await expect(async () => {
    await page.goto("/plan/timeline");
    await expect(page.getByRole("heading").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Apply to the timeline" })).toHaveCount(0);
  }).toPass({ timeout: 20_000 });
  await resetOvernightData(prisma);
});
