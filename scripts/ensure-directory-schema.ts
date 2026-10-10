import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Person" ADD COLUMN IF NOT EXISTS "directoryLabel" TEXT`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "directoryLabel" TEXT`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Person" ADD COLUMN IF NOT EXISTS "directoryList" TEXT`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "directoryList" TEXT`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "GuestPerson" ADD COLUMN IF NOT EXISTS "directoryLabel" TEXT`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Person" ADD COLUMN IF NOT EXISTS "isDayOfContact" BOOLEAN DEFAULT false`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "isDayOfContact" BOOLEAN DEFAULT false`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "GuestPerson" ADD COLUMN IF NOT EXISTS "isDayOfContact" BOOLEAN DEFAULT false`,
  );

  // Legacy: directoryList = day-of meant “on call list”, not a primary list.
  await prisma.$executeRawUnsafe(
    `UPDATE "Person" SET "isDayOfContact" = true WHERE "directoryList" = 'day-of'`,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "Contact" SET "isDayOfContact" = true WHERE "directoryList" = 'day-of'`,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "Person" SET "directoryList" = NULL WHERE "directoryList" = 'day-of'`,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "Contact" SET "directoryList" = 'vendors' WHERE "directoryList" = 'day-of'`,
  );

  // Apply cards' record of changes already made (src/lib/auto-apply.ts creates the same table).
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "AppliedCorrection" ("key" TEXT NOT NULL PRIMARY KEY, "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  );

  console.log("People directory schema columns ensured.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
