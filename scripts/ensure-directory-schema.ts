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
  console.log("People directory schema columns ensured.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
