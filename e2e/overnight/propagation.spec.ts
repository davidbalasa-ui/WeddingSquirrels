import { expect, test } from "@playwright/test";
import { overnightPrisma, resetOvernightData } from "./db";
import { PACKETS, attachGuards, blockByTitle, editCard, expectAllSaved, openPacket, openTimelineEditor } from "./helpers";

const prisma = overnightPrisma();
test.beforeAll(async () => resetOvernightData(prisma));
test.afterAll(async () => prisma.$disconnect());

/**
 * One edit on the Wedding Day page must show up everywhere that moment is read,
 * and the old wording must be gone everywhere. Nothing keeps its own copy.
 */
test("an edited moment shows the new text on every page and packet, and nowhere the old", async ({ page }) => {
  const guards = attachGuards(page);
  const block = await blockByTitle(prisma, "Sign the marriage license");
  const OLD = "Andi (Best Man) and Braxton (Maid of Honor) are the witnesses and are in charge of the license and pen.";
  const NEW = "Andi (Best Man) and Braxton (Maid of Honor) are the witnesses and keep the pen (Overnight check 4417).";
  expect(block.notes).toContain(OLD);

  await openTimelineEditor(page);
  const card = editCard(page, block.id);
  await card.scrollIntoViewIfNeeded();
  const notes = card.locator("textarea");
  await notes.fill((await notes.inputValue()).replace(OLD, NEW));
  await notes.blur();
  await expectAllSaved(page);
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(page.locator(`#block-${block.id}`)).toContainText("Overnight check 4417");
  await expect(page.locator(`#block-${block.id}`)).not.toContainText("in charge of the license and pen");

  const checks: Array<{ path: string; label: string; section?: string }> = [
    { path: "/plan/timeline", label: "Wedding Day page" },
    { path: "/day", label: "Day-of page" },
    { path: "/day?asOf=2026-10-16T16:01", label: "Day-of page at 4:01 PM on the day" },
    { path: "/today", label: "Today page" },
    { path: "/offline", label: "Offline copy" },
  ];
  const seen: string[] = [];
  const stale: string[] = [];
  for (const check of checks) {
    await page.goto(check.path, { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).not.toContainText("Loading…");
    if (check.path === "/offline") {
      // The offline copy is built from the live data when it is saved.
      await page.goto("/more");
      const save = page.getByRole("button", { name: /Save (the )?offline (copy|pack)|Update offline/i }).first();
      if (await save.count()) await save.click();
      const api = await page.request.get("/api/offline");
      if (api.ok()) {
        const text = await api.text();
        if (text.includes("Overnight check 4417")) seen.push("offline data");
        if (text.includes("in charge of the license and pen")) stale.push("offline data");
      }
      continue;
    }
    const text = await page.locator("body").innerText();
    // Day-of and Today list moments by title; their data still has to be the live row.
    const html = await page.content();
    if (text.includes("Overnight check 4417") || (check.path !== "/plan/timeline" && html.includes("Overnight check 4417"))) seen.push(check.label);
    // The Wedding Day page legitimately carries the document's own wording for "Use the document's version".
    const staleHere = check.path === "/plan/timeline" ? text : html;
    if (staleHere.includes("in charge of the license and pen")) stale.push(check.label);
    if (check.path.startsWith("/day")) await expect(page.locator("body")).toContainText("Sign the marriage license");
  }

  for (const packet of PACKETS) {
    const text = await openPacket(page, packet.id);
    if (text.includes("Overnight check 4417")) seen.push(`packet ${packet.title}`);
    if (text.includes("in charge of the license and pen")) stale.push(`packet ${packet.title}`);
  }

  expect(stale, "pages or packets still showing the old wording").toEqual([]);
  // The line names the Best Man and Maid of Honor, so it belongs to the party, the master packet,
  // the bride's copy and the coordinator packet; MC, photographer and parents do not get it.
  expect(seen).toEqual(
    expect.arrayContaining([
      "Wedding Day page",
      "Day-of page",
      "Day-of page at 4:01 PM on the day",
      "offline data",
      "packet Master Packet",
      "packet Bride's Packet",
      "packet Avalon & Wendy",
      "packet Wedding Party Packet",
    ]),
  );
  await guards.assertClean();
});

test("an MC cue edit reaches the MC run of show and the MC packet", async ({ page }) => {
  const guards = attachGuards(page);
  // Use the one cue line David's bootstrap data already carries (Pre-Ceremony Transition had it before
  // the reconciled document); on the reconciled timeline we add a cue to "Wedding party lines up".
  const block = await blockByTitle(prisma, "Wedding party lines up");
  const CUE = "MC cue 4:58 PM: Overnight check 9031 — please take your seats for the grand entrance.";
  await prisma.timelineBlock.update({ where: { id: block.id }, data: { notes: `${block.notes}\n${CUE}` } });

  await page.goto("/day/mc");
  await expect(page.locator("body")).toContainText("Overnight check 9031");
  const mc = await openPacket(page, "mc");
  expect(mc).toContain("Overnight check 9031");
  const packet = await openPacket(page, "packet");
  expect(packet).toContain("Overnight check 9031");

  // Change it on the page: the run of show must follow.
  await openTimelineEditor(page);
  const card = editCard(page, block.id);
  await card.scrollIntoViewIfNeeded();
  const notes = card.locator("textarea");
  await notes.fill((await notes.inputValue()).replace("Overnight check 9031", "Overnight check 9032"));
  await notes.blur();
  await expectAllSaved(page);
  await page.goto("/day/mc");
  await expect(page.locator("body")).toContainText("Overnight check 9032");
  await expect(page.locator("body")).not.toContainText("Overnight check 9031");
  expect(await openPacket(page, "mc")).toContain("Overnight check 9032");
  await guards.assertClean();
});
