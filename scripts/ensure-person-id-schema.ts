import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "GuestPerson" ADD COLUMN IF NOT EXISTS "personId" TEXT`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "personId" TEXT`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "MealGuest" ADD COLUMN IF NOT EXISTS "personId" TEXT`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "GuestPerson_personId_idx" ON "GuestPerson"("personId")`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Contact_personId_idx" ON "Contact"("personId")`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "MealGuest_personId_idx" ON "MealGuest"("personId")`,
  );

  console.log("Nullable personId columns ensured on GuestPerson, Contact, and MealGuest.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
