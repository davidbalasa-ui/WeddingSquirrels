-- Additive BudgetPayment table for MONEY payment schedules.
-- Safe to run multiple times. Does not modify existing BudgetItem rows.

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
);

CREATE INDEX IF NOT EXISTS "BudgetPayment_budgetItemId_sortOrder_idx"
    ON "BudgetPayment" ("budgetItemId", "sortOrder");

ALTER TABLE "BudgetPayment" ALTER COLUMN "label" DROP NOT NULL;

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
END $$;

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
END $$;
