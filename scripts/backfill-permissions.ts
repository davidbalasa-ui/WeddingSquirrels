/**
 * Idempotent backfill for WP2 permission flags + linkedPersonId.
 * Safe to re-run. Does not change PINs.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LINK_BY_ACCOUNT_NAME: Record<string, string> = {
  david: "david",
  haley: "haley",
  "mother in law": "shelly",
  shelly: "shelly",
};

async function main() {
  const persons = await prisma.person.findMany({ select: { id: true } });
  const personIds = new Set(persons.map((p) => p.id));

  const accounts = await prisma.pinAccount.findMany();
  console.log(`Backfilling ${accounts.length} pin account(s)…`);

  for (const account of accounts) {
    const linkedKey = LINK_BY_ACCOUNT_NAME[account.name.trim().toLowerCase()];
    const linkedPersonId =
      linkedKey && personIds.has(linkedKey) ? linkedKey : account.linkedPersonId;

    const updated = await prisma.pinAccount.update({
      where: { id: account.id },
      data: {
        canSeeShop: account.canSeeTasks,
        canSeeCalendar: account.canSeeTasks,
        canSeePeople: account.canSeeTasks,
        canSeeRequests: account.canSeeTasks,
        canEditBudget: account.isMaster,
        canEditTimeline: account.canSeeTimeline,
        linkedPersonId: linkedPersonId ?? null,
      },
      select: {
        name: true,
        isMaster: true,
        canSeeShop: true,
        canSeeCalendar: true,
        canSeePeople: true,
        canSeeRequests: true,
        canEditBudget: true,
        canEditTimeline: true,
        linkedPersonId: true,
        assigneeFilterJson: true,
      },
    });

    console.log(JSON.stringify(updated));
  }

  console.log("PERMISSIONS BACKFILL DONE");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
