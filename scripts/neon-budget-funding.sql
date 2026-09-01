-- Run in Neon SQL Editor to add BudgetFundingSource for funding ledger.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS "BudgetFundingSource" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BudgetFundingSource_pkey" PRIMARY KEY ("id")
);

-- Seed default funding sources only when the table is empty.
INSERT INTO "BudgetFundingSource" ("id", "label", "amount", "status", "note", "sortOrder", "updatedAt")
SELECT * FROM (
  VALUES
    ('funding-david-savings', 'David — personal savings', 5000::double precision, 'available', NULL::text, 0, CURRENT_TIMESTAMP),
    ('funding-david-401k', 'David — 401(k) loan', 10000::double precision, 'available', NULL::text, 1, CURRENT_TIMESTAMP),
    ('funding-john-shelly-donated', 'John & Shelly — donated', 5000::double precision, 'available', NULL::text, 2, CURRENT_TIMESTAMP),
    ('funding-john-shelly-promised', 'John & Shelly — promised', 5000::double precision, 'expected', NULL::text, 3, CURRENT_TIMESTAMP)
) AS seed("id", "label", "amount", "status", "note", "sortOrder", "updatedAt")
WHERE NOT EXISTS (SELECT 1 FROM "BudgetFundingSource" LIMIT 1);
