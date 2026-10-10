import { expect, test, type Page } from "@playwright/test";
import { overnightPrisma, resetOvernightData } from "./db";
import { PACKETS, openPacket } from "./helpers";

const prisma = overnightPrisma();
test.beforeAll(async () => resetOvernightData(prisma));
test.afterAll(async () => prisma.$disconnect());

type PageMoment = { time: string; title: string; location: string; lines: string[] };

const LABEL: Record<string, string> = { cue: "MC cue: ", music: "Music: ", open: "Open: " };

/** Each moment as the Wedding Day or Thursday page shows it, with each line as the page labels it. */
async function pageMoments(page: Page, path: string): Promise<PageMoment[]> {
  await page.goto(path);
  const rows = await page.locator(".day-timeline-row").evaluateAll((els) =>
    els.map((row) => ({
      time: (row.querySelector(".day-timeline-time")?.textContent ?? "").replace(/\s+/g, " ").trim(),
      title: row.querySelector(".day-timeline-title")?.childNodes[0]?.textContent?.trim() ?? "",
      location: row.querySelector(".day-timeline-location")?.textContent?.replace(/^\s*·\s*/, "").trim() ?? "",
      details: Array.from(row.querySelectorAll(".day-timeline-detail")).map((li) => ({
        kind: li.getAttribute("data-kind") ?? "note",
        text: (li.lastChild?.textContent ?? "").trim(),
      })),
    })),
  );
  return rows.map((row) => ({ ...row, lines: row.details.map((detail) => `${LABEL[detail.kind] ?? ""}${detail.text}`) }));
}

/** Every schedule row a packet prints: the binder's run sheet and rehearsal, and each packet's own schedule. */
async function printedRows(page: Page) {
  return page.locator(".binder-doc .binder-schedule > li").evaluateAll((els) =>
    els.map((li) => ({
      time: (li.querySelector(".binder-time")?.textContent ?? "").replace(/\s+/g, " ").trim(),
      title: li.querySelector(".binder-item-title")?.textContent?.trim() ?? "",
      lines: Array.from(li.querySelectorAll(".binder-note")).map((el) => (el.textContent ?? "").trim()),
    })),
  );
}

test("every schedule line a packet prints is a line of the same moment on the page", async ({ page }) => {
  test.setTimeout(120_000);
  const moments = [...(await pageMoments(page, "/plan/rehearsal")), ...(await pageMoments(page, "/plan/timeline"))];
  expect(moments.length).toBeGreaterThan(20);

  const getaway = moments.find((moment) => moment.title === "Getaway vehicle arrives")!;
  for (const packet of PACKETS) {
    await openPacket(page, packet.id);
    const rows = await printedRows(page);
    if (packet.id === "left") continue;
    expect(rows.length, packet.id).toBeGreaterThan(0);
    for (const row of rows) {
      const source = moments.find((moment) => moment.title === row.title && moment.time === row.time);
      expect(source, `${packet.id}: "${row.time} ${row.title}" is not a moment on the page`).toBeTruthy();
      for (const line of row.lines) {
        // The schedules' one shared rule (David, 2026-10-10): the single shots read as one line.
        if (line === "Bridal party photos") continue;
        expect(
          line === source!.location || source!.lines.includes(line),
          `${packet.id}: "${line}" under ${row.time} ${row.title} is not a line of that page moment`,
        ).toBe(true);
      }
    }
    // The 8:20 getaway moment prints the page's own lines (the bride's copy keeps only its time and title).
    // The master packet lists its "Open:" line in Open work instead, so its run sheet leaves that line off.
    const printedGetaway = rows.find((row) => row.title === getaway.title);
    if (packet.id === "packet") expect(printedGetaway?.lines, packet.id).toEqual(getaway.lines);
    if (packet.id === "binder") {
      expect(printedGetaway?.lines, packet.id).toEqual(getaway.lines.filter((line) => !line.startsWith("Open: ")));
      for (const open of getaway.lines.filter((line) => line.startsWith("Open: "))) {
        await expect(page.getByTestId("print-section-tasks")).toContainText(open.replace("Open: ", ""));
      }
    }
    if (packet.id === "bride") expect(printedGetaway?.lines, packet.id).toEqual([]);
  }
});
