import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { overnightPrisma, resetOvernightData } from "./db";
import { PACKETS, attachGuards, expectNoSidewaysScroll, openPacket } from "./helpers";

const prisma = overnightPrisma();
test.beforeAll(async () => resetOvernightData(prisma));
test.afterAll(async () => prisma.$disconnect());

const SAMPLE_DIR = process.env.OVERNIGHT_SAMPLE_DIR || "test-artifacts/overnight/packets";

test.describe("Print Center packets", () => {
  for (const packet of PACKETS) {
    test(`${packet.title} prints cleanly`, async ({ page }, info) => {
      const guards = attachGuards(page);
      const text = await openPacket(page, packet.id);
      const doc = page.locator(".binder-doc");
      await expect(doc).toContainText(packet.kicker);
      await expect(doc).toContainText("David & Haley");

      // No raw markup, placeholders or developer tags on paper.
      expect(text).not.toMatch(/\[object|undefined|NaN|\{\{|\bnull\b/);
      // Schedules read as "time: what happens"; the role sorting stays invisible.
      expect(text).not.toMatch(/\b(?:#|tag:|role:)\s*(mc|party|family|helpers|photo|vendors)\b/i);

      // Money only in David's binder.
      if (packet.id !== "binder") expect(text).not.toMatch(/\$\s?\d[\d,]*\.\d{2}/);
      // Haley's copy never carries the getaway details.
      if (packet.id === "bride") {
        expect(text).not.toMatch(/San Vandenheede|Just Married|secret from the bride|Mustang/i);
      }
      // Packets for one group stay short and do not carry other groups' sections.
      if (["mc", "party", "photo", "brideParents", "groomParents"].includes(packet.id)) {
        expect(text).not.toContain("Guests / RSVP");
        expect(text).not.toContain("Open work");
        await expect(page.getByTestId("print-section-schedule")).toBeVisible();
        const rows = page.getByTestId("print-section-schedule").locator("li");
        expect(await rows.count()).toBeGreaterThan(3);
        // Every row has a time and a title.
        for (const row of await rows.all()) {
          await expect(row.locator(".binder-time")).not.toBeEmpty();
          await expect(row.locator(".binder-item-title")).not.toBeEmpty();
        }
      }
      // Every schedule packet keeps the moments everyone attends ("What's left" is only the open work).
      if (!["binder", "bride", "packet", "left"].includes(packet.id)) {
        // The page may still carry the earlier titles for moments David has not switched to the document's wording.
        for (const shared of [/Ceremony/, /Grand entrance|Dinner begins/, /Toasts/, /Cake cutting/, /Formal dances|First dances/]) {
          expect(text, `${packet.title} keeps ${shared}`).toMatch(shared);
        }
      }

      await expectNoSidewaysScroll(page);

      // Print / Save PDF calls the browser's print.
      await page.evaluate(() => {
        (window as Window & { __printCalls?: number }).__printCalls = 0;
        window.print = () => {
          const store = window as Window & { __printCalls?: number };
          store.__printCalls = (store.__printCalls ?? 0) + 1;
        };
      });
      await page.getByTestId("print-save-pdf").click();
      expect(await page.evaluate(() => (window as Window & { __printCalls?: number }).__printCalls)).toBe(1);

      // Samples of what comes out of the printer, from the test copy of David's data.
      mkdirSync(SAMPLE_DIR, { recursive: true });
      await page.emulateMedia({ media: "print" });
      await expect(page.locator(".nav-bar")).toBeHidden();
      const slug = packet.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (info.project.name === "desktop") {
        await page.pdf({ path: `${SAMPLE_DIR}/${slug}.pdf`, format: "Letter", printBackground: true, margin: { top: "0.5in", bottom: "0.5in", left: "0.5in", right: "0.5in" } });
      }
      await page.emulateMedia({ media: "screen" });
      // A long packet on a phone can be taller than a screenshot may be; the top of it is the sample then.
      const height = await doc.evaluate((el) => el.getBoundingClientRect().height * window.devicePixelRatio);
      if (height < 32_000) {
        await doc.screenshot({ path: `${SAMPLE_DIR}/${slug}-${info.project.name}.png` });
      } else {
        await page.screenshot({ path: `${SAMPLE_DIR}/${slug}-${info.project.name}.png` });
      }
      await guards.assertClean();
    });
  }
});
