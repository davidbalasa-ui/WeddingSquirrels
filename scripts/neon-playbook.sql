-- Additive PlaybookItem table for day-of operational views.
-- Safe to run multiple times. Does not modify TimelineBlock, Person, Contact, or Task rows.

CREATE TABLE IF NOT EXISTS "PlaybookItem" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "startAt" TEXT,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "sourceKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlaybookItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlaybookItem_sourceKey_key" ON "PlaybookItem"("sourceKey");
CREATE INDEX IF NOT EXISTS "PlaybookItem_kind_sortOrder_idx" ON "PlaybookItem"("kind", "sortOrder");
