import { mkdirSync } from "node:fs";
import { RECONCILED_TIMELINE, reconciledNotes } from "../../src/lib/reconciled-timeline";
import { parsedTimeFields } from "../../src/lib/day-of-time";
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
        expect(text).not.toMatch(/\b[DS]an Vandenheede|Just Married|secret from the bride|Mustang/i);
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

// David, 2026-10-10: the wedding party's own packet is a lineup, not a phone list; and at 21:44,
// of the "Who's in the party" table: "remove this everywhere its pointless".
test("Wedding party packet is the processional lineup without phone numbers, and no packet prints the party table", async ({ page }) => {
  await openPacket(page, "party");
  const party = page.getByTestId("print-section-party");
  expect(await party.innerText()).not.toMatch(/\d{3}[-.)\s]+\d{3}[-.\s]\d{4}/);
  await expect(party).toContainText("Ceremony processional");
  await expect(party.locator("table")).toHaveCount(0);
  for (const packet of PACKETS) {
    await openPacket(page, packet.id);
    await expect(page.getByText("Who’s in the party")).toHaveCount(0);
    await expect(page.getByText("Who's in the party")).toHaveCount(0);
    await expect(page.getByRole("columnheader", { name: "Walks with" })).toHaveCount(0);
  }
});

// David, 2026-10-10: "compress the shot list to just say bridal party photos" in the schedule,
// and the line-up time "need[s] to be consistent" with the schedule.
test("Schedules say Bridal party photos and the processional lines up when the schedule says", async ({ page }) => {
  for (const id of ["party", "binder"]) {
    const text = await openPacket(page, id);
    const schedule = text.split(/\n(?:Photo )?shot list/i)[0]!;
    expect(schedule, `${id}: the schedule lists single shots`).not.toMatch(/Groom with Evan|Bride with Skila/);
    expect(schedule, id).toContain("Bridal party photos");
    const lineUp = text.match(/Ceremony processional · line up at (\d{1,2}:\d{2} [AP]M)/)?.[1];
    expect(lineUp, `${id}: processional time`).toBeTruthy();
    // This test copy's pre-ceremony moment carries "3:20 PM — wedding party lines up".
    expect(text, `${id}: the schedule says the same line-up time`).toMatch(new RegExp(`${lineUp}[^\\n]*wedding party lines up`, "i"));
  }
});

// David, 2026-10-11: "The master run of events needs to have everything ... jobs ... MC cues ... By time."
test("the binder's run sheet prints each day-of job under its moment, by time", async ({ page }) => {
  const prisma = overnightPrisma();
  const job = await prisma.dayAssignment.create({
    data: { title: "Overnight check: hand the pen to Marie", notes: "3:50 PM · Sign the marriage license", sortOrder: 9999 },
  });
  try {
    const text = await openPacket(page, "binder");
    const sheet = text.slice(text.indexOf("Wedding-day run sheet"));
    const signing = sheet.indexOf("Sign the marriage license");
    const jobAt = sheet.indexOf("Job: Overnight check: hand the pen to Marie (Unassigned)");
    expect(signing).toBeGreaterThan(-1);
    expect(jobAt).toBeGreaterThan(signing);
    // The next row is cocktail hour (this test copy titles it "Cocktail Hour").
    const cocktail = sheet.search(/cocktail hour/i);
    expect(cocktail).toBeGreaterThan(jobAt);
  } finally {
    await prisma.dayAssignment.delete({ where: { id: job.id } });
    await prisma.$disconnect();
  }
});

// David, 2026-10-11: "269-635-8458 is dans phone number for the get away vehicle".
test("Dan's number prints with the contacts, but never in the Bride's Packet", async ({ page }) => {
  const prisma = overnightPrisma();
  // Saved the way the corrections card saves it.
  const dan = await prisma.contact.create({
    data: { name: "Dan Vandenheede", phone: "(269) 635-8458", directoryLabel: "Getaway vehicle", directoryList: "vendors", isDayOfContact: false, sortOrder: 9999 },
  });
  try {
    for (const id of ["binder", "packet"] as const) {
      const text = await openPacket(page, id);
      expect(text, id).toContain("Dan Vandenheede");
      expect(text, id).toContain("(269) 635-8458");
    }
    const bride = await openPacket(page, "bride");
    expect(bride).not.toContain("Vandenheede");
    expect(bride).not.toContain("635-8458");
  } finally {
    await prisma.contact.delete({ where: { id: dan.id } });
    await prisma.$disconnect();
  }
});

// David, 2026-10-11 15:50: John is father of the bride, Pam mother of the groom; Denise and Lisa are helpers.
test("family and helpers print with the day-of contacts under the roles David gave", async ({ page }) => {
  const prisma = overnightPrisma();
  // Saved the way the corrections card saves them; John's older label is not the one David gave.
  const rows = await Promise.all([
    prisma.contact.create({ data: { name: "John Wiewiora", phone: "231-798-5825", directoryLabel: "Guest", directoryList: "guests", isDayOfContact: true, sortOrder: 9990 } }),
    prisma.contact.create({ data: { name: "Denise", phone: "(231) 740-3616", directoryLabel: "Helper", directoryList: "guests", isDayOfContact: true, sortOrder: 9991 } }),
    prisma.contact.create({ data: { name: "Bryan Balasa", phone: "(269) 475-3495", directoryLabel: "Father of the Groom", directoryList: "guests", isDayOfContact: true, sortOrder: 9992 } }),
  ]);
  try {
    const text = await openPacket(page, "binder");
    const contacts = text.slice(text.indexOf("Day-of contacts"));
    expect(contacts).toMatch(/John Wiewiora\s+Father of the Bride\s+231-798-5825/);
    expect(contacts).toMatch(/Denise\s+Helper\s+\(231\) 740-3616/);
    expect(contacts).toMatch(/Bryan Balasa\s+Father of the Groom\s+\(269\) 475-3495/);
  } finally {
    await prisma.contact.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
    await prisma.$disconnect();
  }
});

// David, 2026-10-11 15:52: "add "SHARP" bolded to the 3:45 leave time on thursday".
test("Thursday's 3:45 departure prints SHARP in bold", async ({ page }) => {
  const prisma = overnightPrisma();
  const moment = RECONCILED_TIMELINE.find((m) => m.seedKey === "reh.depart-airbnb")!;
  const row = await prisma.timelineBlock.findFirstOrThrow({ where: { schedule: "rehearsal", startAt: "3:45 PM" } });
  try {
    await prisma.timelineBlock.update({ where: { id: row.id }, data: { notes: reconciledNotes(moment) } });
    await openPacket(page, "binder");
    const sharp = page.locator(".binder-schedule strong.sharp-word", { hasText: "SHARP" });
    await expect(sharp.first()).toBeVisible();
    expect(Number(await sharp.first().evaluate((el) => getComputedStyle(el).fontWeight))).toBeGreaterThanOrEqual(800);
    await expect(page.locator(".binder-schedule li", { has: page.locator("strong.sharp-word") }).first()).toContainText("3:45 PM");
  } finally {
    await prisma.timelineBlock.update({ where: { id: row.id }, data: { notes: row.notes } });
    await prisma.$disconnect();
  }
});

// David, 2026-10-11 15:57: "change bride with veil portriats to bride with tiara".
test("the shot list prints the bride with her tiara, never with a veil", async ({ page }) => {
  const text = await openPacket(page, "photo");
  expect(text).toContain("Bride with tiara");
  expect(text).not.toMatch(/bride[- ]with[- ]veil/i);
});

// David, 2026-10-11 16:00: "David will give the gifts to the girls at 1:45 during first look with the girls".
// 16:01: "remove the 2 pm line about denise and lise picking up the cake from the air BNB. Braxton is responsible to
// bring the cake from the air bnb to the venue the night before. cake arrives at black sheep thursday at 7pm."
// 16:03: "make sure the 2-230 time frame also doesnt have the cake reference anymore".
test("the girls' gifts print at 1:45, the cake arrives Thursday at 7:00 with Braxton, and Friday 2:00–2:30 has no cake", async ({ page }) => {
  const prisma = overnightPrisma();
  const created: string[] = [];
  const restore: Array<{ id: string; notes: string }> = [];
  const place = async (seedKey: string) => {
    const moment = RECONCILED_TIMELINE.find((m) => m.seedKey === seedKey)!;
    const row = await prisma.timelineBlock.findUnique({ where: { seedKey } });
    if (row) {
      restore.push({ id: row.id, notes: row.notes });
      await prisma.timelineBlock.update({ where: { id: row.id }, data: { notes: reconciledNotes(moment) } });
    } else {
      const added = await prisma.timelineBlock.create({
        data: {
          seedKey,
          schedule: moment.schedule,
          startAt: moment.startAt,
          endAt: moment.endAt,
          notes: reconciledNotes(moment),
          sortOrder: 9000,
          ...parsedTimeFields(moment.startAt, moment.endAt),
        },
      });
      created.push(added.id);
    }
  };
  await place("wedding_david_girls_first_look");
  await place("reh.cake-arrives");
  // An older saved Friday row still carrying the app's cake line, and a job David's data may still hold.
  const two = await prisma.timelineBlock.findUniqueOrThrow({ where: { seedKey: "wedding_first_look" } });
  restore.push({ id: two.id, notes: two.notes });
  await prisma.timelineBlock.update({
    where: { id: two.id },
    data: { notes: `${two.notes}\n2:00 PM — Denise and Lisa pick up cake at Airbnb; 2:30 PM arrive at BSS (fridge by suites)` },
  });
  const job = await prisma.dayAssignment.create({
    data: { title: "Denise and Lisa pick up the cake from the Airbnb", notes: "2:00 PM · Cake pickup", sortOrder: 9999 },
  });
  try {
    const text = await openPacket(page, "binder");
    expect(text).toContain("David gives the girls their gifts during the first look (David, Oct 11).");
    expect(text).toContain("Cake arrives at Black Sheep Shelter");
    expect(text).toContain("Braxton brings the cake from the Airbnb to Black Sheep Shelter (David, Oct 11).");
    expect(text).not.toMatch(/Denise and Lisa pick up/i);
    expect(text).not.toMatch(/fridge by suites/i);
    await page.goto("/day/assignments");
    await expect(page.getByText("Denise and Lisa pick up the cake from the Airbnb")).toHaveCount(0);
  } finally {
    await prisma.dayAssignment.delete({ where: { id: job.id } });
    for (const row of restore) await prisma.timelineBlock.update({ where: { id: row.id }, data: { notes: row.notes } });
    if (created.length) await prisma.timelineBlock.deleteMany({ where: { id: { in: created } } });
    await prisma.$disconnect();
  }
});

// David, 2026-10-11 19:27: "Add from 4:05 to 4:30, family photos."
test("Friday's 4:05–4:30 family photos print on the run sheet, with no grandparent line", async ({ page }) => {
  const text = await openPacket(page, "binder");
  expect(text).toMatch(/4:05 PM\s*[–-]\s*4:30 PM\s+Family photos/);
  expect(text).not.toMatch(/grand ?(?:ma|pa|parent|mother|father)/i);
});
