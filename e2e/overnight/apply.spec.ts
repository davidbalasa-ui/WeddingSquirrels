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
    guards.assertClean();
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
    guards.assertClean();
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
    guards.assertClean();
  });
});
