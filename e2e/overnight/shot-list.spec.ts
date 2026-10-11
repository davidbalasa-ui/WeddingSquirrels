import { expect, test } from "@playwright/test";
import { overnightPrisma, resetOvernightData } from "./db";
import { PACKETS, openPacket } from "./helpers";

const prisma = overnightPrisma();
test.beforeAll(async () => {
  await resetOvernightData(prisma);
  // A shot David already ticked or edited is a saved row; a removed shot must stay gone even then.
  await prisma.playbookItem.upsert({
    where: { sourceKey: "shot-fam-bride-grandma" },
    update: {},
    create: {
      sourceKey: "shot-fam-bride-grandma",
      kind: "shot",
      section: "Family",
      title: "Bride with Grandma",
      sortOrder: 56,
      completed: true,
    },
  });
  // The old 4:05 family photos row with the grandparents, edited so Apply leaves it as he wrote it:
  // its grandparent lines still never print (David's 4:05 "Family photos" is back since 2026-10-11 19:27).
  const notes = "Family photos after the ceremony\nHaley with Grandma; Haley with Grandpa; Haley with grandparents.\nCouple with grandparents.\nAsk Mom";
  await prisma.timelineBlock.upsert({
    where: { seedKey: "wedding_family_photos_after" },
    update: { notes },
    create: { seedKey: "wedding_family_photos_after", schedule: "wedding", startAt: "4:05 PM", endAt: "4:30 PM", notes, sortOrder: 999 },
  });
});
test.afterAll(async () => {
  await prisma.timelineBlock.deleteMany({ where: { seedKey: "wedding_family_photos_after" } });
  await prisma.$disconnect();
});

// David, 2026-10-10: no extended family photos (crossed out on page 12 of his printed binder).
const REMOVED = [
  "Bride with Grandma",
  "Bride with Grandpa",
  "Bride with grandparents",
  "Couple with grandparents",
  "Couple with bride's parental side of family",
  "Couple with bride's maternal side of family",
];
const KEPT = [
  "Bride with parents",
  "Couple with parents",
  "Bride with mom",
  "Bride with dad",
  "Couple with mom",
  "Couple with dad",
];

test("Shots page lists the family shots without the extended family", async ({ page }) => {
  await page.goto("/day/shots");
  const main = page.locator("main");
  // Wait for the list itself, not the loading screen, before reading it.
  for (const title of KEPT) await expect(main).toContainText(title);
  const body = await main.innerText();
  for (const title of REMOVED) expect(body).not.toContain(title);
});

test("No packet prints the extended family shots", async ({ page }) => {
  let withShotList = 0;
  for (const packet of PACKETS) {
    const text = await openPacket(page, packet.id);
    for (const title of REMOVED) expect(text, packet.title).not.toContain(title);
    // David, 2026-10-11 12:31: no grandparent photos anywhere, whatever an older row says.
    expect(text, packet.title).not.toMatch(/grand ?(?:ma|pa|parent|mother|father)/i);
    if (/Photo shot list/i.test(text)) {
      withShotList++;
      for (const title of KEPT) expect(text, packet.title).toContain(title);
    }
  }
  expect(withShotList).toBeGreaterThan(0);
});
