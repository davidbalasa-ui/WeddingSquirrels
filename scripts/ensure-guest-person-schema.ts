import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "phone" TEXT`);
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "GuestPerson" ADD COLUMN IF NOT EXISTS "rsvpStatus" TEXT DEFAULT 'pending'`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "GuestPerson" ADD COLUMN IF NOT EXISTS "photoData" TEXT`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "GuestGift" ADD COLUMN IF NOT EXISTS "thankYouWritten" BOOLEAN DEFAULT false`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "GuestGift" ADD COLUMN IF NOT EXISTS "thankYouSent" BOOLEAN DEFAULT false`,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "GuestGift" SET "thankYouSent" = "thanked" WHERE "thankYouSent" = false AND "thanked" = true`,
  );

  console.log("Guest person schema columns ensured.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
