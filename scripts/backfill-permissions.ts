/**
 * Idempotent permission backfill for existing PinAccount rows.
 * Usage: npx tsx scripts/backfill-permissions.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.pinAccount.findMany();
  for (const account of accounts) {
    let linkedPersonId = account.linkedPersonId;
    if (!linkedPersonId) {
      const name = account.name.toLowerCase();
      if (name.includes("david")) linkedPersonId = "david";
      else if (name.includes("haley")) linkedPersonId = "haley";
      else if (name.includes("mother") || name.includes("shelly")) linkedPersonId = "shelly";
      if (linkedPersonId) {
        const person = await prisma.person.findUnique({ where: { id: linkedPersonId } });
        if (!person) linkedPersonId = account.linkedPersonId;
      }
    }

    await prisma.pinAccount.update({
      where: { id: account.id },
      data: {
        canSeeShop: account.canSeeTasks,
        canSeeCalendar: account.canSeeTasks,
        canSeePeople: account.canSeeTasks,
        canSeeRequests: account.canSeeTasks,
        canEditBudget: account.isMaster,
        canEditTimeline: account.canSeeTimeline,
        linkedPersonId,
      },
    });
    console.log(`Updated ${account.name}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
