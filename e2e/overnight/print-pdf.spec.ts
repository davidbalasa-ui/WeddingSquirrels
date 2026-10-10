import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { overnightPrisma, resetOvernightData } from "./db";
import { PACKETS, attachGuards, openPacket } from "./helpers";

/**
 * Each packet printed to a Letter PDF through Chromium's print path, with the
 * app's own @page rules (what Print / Save PDF produces). The PDF is then read
 * back: Letter size, nothing printed into the side margins or past the bottom,
 * every schedule row's time and title on the same page, no heading left alone
 * at the foot of a page, and every line of the on-screen document present on paper.
 */
const prisma = overnightPrisma();
test.beforeAll(async () => resetOvernightData(prisma));
test.afterAll(async () => prisma.$disconnect());

const PDF_DIR = process.env.OVERNIGHT_PDF_DIR || "test-artifacts/overnight/pdf";

function pdfInfo(path: string) {
  const out = execFileSync("pdfinfo", [path], { encoding: "utf8" });
  const pages = Number(/Pages:\s+(\d+)/.exec(out)?.[1]);
  const size = /Page size:\s+([\d.]+) x ([\d.]+)/.exec(out);
  return { pages, width: Number(size?.[1]), height: Number(size?.[2]) };
}

function pageText(path: string, page: number) {
  return execFileSync("pdftotext", ["-f", String(page), "-l", String(page), path, "-"], { encoding: "utf8" });
}

/** Renders one page to grey pixels (PGM) so the margins can be checked for ink. */
function pagePixels(path: string, page: number, dpi: number) {
  const pgm = execFileSync("pdftoppm", ["-f", String(page), "-l", String(page), "-r", String(dpi), "-gray", path], { maxBuffer: 64 * 1024 * 1024 });
  // P5\n<width> <height>\n<max>\n<bytes>
  const header = /^P5\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(pgm.subarray(0, 40).toString("latin1"));
  if (!header) throw new Error("pdftoppm did not return a PGM image");
  const width = Number(header[1]);
  const height = Number(header[2]);
  const data = pgm.subarray(header[0].length);
  return { width, height, at: (x: number, y: number) => data[y * width + x]! };
}

function inkIn(pixels: ReturnType<typeof pagePixels>, x0: number, x1: number, y0: number, y1: number) {
  let dark = 0;
  for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) if (pixels.at(x, y) < 160) dark += 1;
  return dark;
}

const squash = (text: string) => text.replace(/\s+/g, " ").trim();
/** Letter-spaced small caps and line wraps change spacing on paper, so compare without any. */
const flat = (text: string) => text.normalize("NFKC").toLowerCase().replace(/\s+/g, "");

test.describe("Packets printed to Letter PDF", () => {
  for (const packet of PACKETS) {
    test(`${packet.title}: Letter PDF, nothing cut off, clean page breaks`, async ({ page, browserName }, info) => {
      test.skip(browserName !== "chromium", "PDF printing is Chromium's print path");
      test.skip(info.project.name !== "desktop", "one PDF per packet is enough");
      const guards = attachGuards(page);
      const screenText = await openPacket(page, packet.id);
      const doc = page.locator(".binder-doc");

      const rows = await doc.locator(".binder-schedule li").evaluateAll((items) =>
        items.map((item) => ({
          time: (item.querySelector(".binder-time")?.textContent ?? "").trim(),
          title: (item.querySelector(".binder-item-title")?.textContent ?? "").trim(),
        })),
      );
      const headings = await doc.locator("h2, h3").allInnerTexts();

      mkdirSync(PDF_DIR, { recursive: true });
      const slug = packet.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const path = `${PDF_DIR}/${slug}.pdf`;
      await page.emulateMedia({ media: "print" });
      // The app's @page rules decide paper size and margins, as in the browser's print dialog.
      await page.pdf({ path, preferCSSPageSize: true, printBackground: true });
      await page.emulateMedia({ media: "screen" });

      const info_ = pdfInfo(path);
      expect(info_.width, "Letter width in points").toBeCloseTo(612, 0);
      expect(info_.height, "Letter height in points").toBeCloseTo(792, 0);
      expect(info_.pages).toBeGreaterThan(0);

      // Nothing printed into the side margins or past the bottom edge. The page number
      // sits centred in the bottom margin, so the bottom check skips the middle.
      const dpi = 50;
      const margin = Math.floor(0.45 * dpi);
      for (let n = 1; n <= info_.pages; n += 1) {
        const px = pagePixels(path, n, dpi);
        const edge = Math.floor(0.12 * dpi);
        expect(inkIn(px, 0, margin, 0, px.height), `page ${n}: ink in the left margin`).toBe(0);
        expect(inkIn(px, px.width - margin, px.width, 0, px.height), `page ${n}: ink in the right margin`).toBe(0);
        expect(inkIn(px, 0, px.width, 0, edge), `page ${n}: ink at the very top`).toBe(0);
        const third = Math.floor(px.width / 3);
        expect(inkIn(px, 0, third, px.height - edge, px.height), `page ${n}: ink at the very bottom (left)`).toBe(0);
        expect(inkIn(px, px.width - third, px.width, px.height - edge, px.height), `page ${n}: ink at the very bottom (right)`).toBe(0);
      }

      const pages = Array.from({ length: info_.pages }, (_, i) => flat(pageText(path, i + 1)));
      const paper = pages.join("");

      // Every line the screen shows is on paper. Side-by-side table cells come out of
      // the PDF interleaved, so a line is checked as its words when it is not found whole.
      const missing = screenText
        .split(/[\n\t]/)
        .map((line) => squash(line))
        .filter((line) => flat(line).length > 3)
        .filter((line) => !paper.includes(flat(line)))
        .filter((line) =>
          line
            .toLowerCase()
            .split(/[^\p{L}\p{N}@.'’:/-]+/u)
            .filter((word) => word.length > 2)
            .some((word) => !paper.includes(word.normalize("NFKC"))),
        );
      expect(missing, `${packet.title}: lines on screen but not in the PDF`).toEqual([]);

      // A schedule row's time and title stay together on one page.
      const split = rows.filter((row) => row.time && row.title && !pages.some((text) => text.includes(flat(row.time)) && text.includes(flat(row.title))));
      expect(split, `${packet.title}: rows split across pages or missing`).toEqual([]);

      // No heading as the last thing on a page.
      const orphaned: string[] = [];
      for (let n = 0; n < pages.length - 1; n += 1) {
        const lines = pageText(path, n + 1).split("\n").map((line) => squash(line)).filter(Boolean);
        const last = lines.at(-1) ?? "";
        const tail = /^\d+$/.test(last) ? lines.at(-2) ?? "" : last; // the page number prints last
        if (headings.map(flat).includes(flat(tail))) orphaned.push(`page ${n + 1}: "${tail}"`);
      }
      expect(orphaned, `${packet.title}: heading alone at the foot of a page`).toEqual([]);

      await guards.assertClean();
    });
  }
});
