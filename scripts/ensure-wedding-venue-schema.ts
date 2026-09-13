import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const venueColumns = [
    "venueName",
    "venueStreet",
    "venueCity",
    "venueState",
    "venueZip",
    "rehearsalDinnerName",
    "rehearsalDinnerStreet",
    "rehearsalDinnerCity",
    "rehearsalDinnerState",
    "rehearsalDinnerZip",
    "airbnbName",
    "airbnbStreet",
    "airbnbCity",
    "airbnbState",
    "airbnbZip",
  ];
  for (const column of venueColumns) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "${column}" TEXT`);
  }
  await prisma.$executeRawUnsafe(`ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "location" TEXT`);
  const target = process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "database";
  console.log(`Wedding venue + calendar location columns ensured on ${target}. No wedding content rows were changed.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
