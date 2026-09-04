import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function isNeon(databaseUrl = process.env.DATABASE_URL ?? "") {
  return /neon\.tech/i.test(databaseUrl);
}

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "BudgetPayment" (
      "id" TEXT NOT NULL,
      "budgetItemId" TEXT NOT NULL,
      "label" TEXT,
      "amount" DOUBLE PRECISION NOT NULL,
      "dueDate" TIMESTAMP(3),
      "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "paidAt" TIMESTAMP(3),
      "paidById" TEXT,
      "note" TEXT,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "BudgetPayment_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "BudgetPayment_budgetItemId_sortOrder_idx"
    ON "BudgetPayment" ("budgetItemId", "sortOrder")
  `);
  await prisma.$executeRawUnsafe(`ALTER TABLE "BudgetPayment" ALTER COLUMN "label" DROP NOT NULL`);
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'BudgetPayment_budgetItemId_fkey'
      ) THEN
        ALTER TABLE "BudgetPayment"
          ADD CONSTRAINT "BudgetPayment_budgetItemId_fkey"
          FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$
  `);
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'BudgetPayment_paidById_fkey'
      ) THEN
        ALTER TABLE "BudgetPayment"
          ADD CONSTRAINT "BudgetPayment_paidById_fkey"
          FOREIGN KEY ("paidById") REFERENCES "Person"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$
  `);

  const target = isNeon(process.env.DATABASE_URL) ? "Neon" : "local database";
  console.log(`BudgetPayment table ensured on ${target}. No BudgetItem rows were changed.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
