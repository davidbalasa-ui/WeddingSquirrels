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
});
test.afterAll(async () => prisma.$disconnect());

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
  const body = await page.locator("main").innerText();
  for (const title of KEPT) expect(body).toContain(title);
  for (const title of REMOVED) expect(body).not.toContain(title);
});

test("No packet prints the extended family shots", async ({ page }) => {
  let withShotList = 0;
  for (const packet of PACKETS) {
    const text = await openPacket(page, packet.id);
    for (const title of REMOVED) expect(text, packet.title).not.toContain(title);
    if (/Photo shot list/i.test(text)) {
      withShotList++;
      for (const title of KEPT) expect(text, packet.title).toContain(title);
    }
  }
  expect(withShotList).toBeGreaterThan(0);
});
