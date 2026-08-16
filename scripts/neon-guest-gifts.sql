-- Apply guest gifts + RSVP columns on Neon (SQL Editor).
-- Safe to run more than once. Do not paste status reports or commit logs here.

ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "rsvpStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "invitedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "acceptedCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "GuestGift" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "thanked" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GuestGift_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GuestGift_guestId_sortOrder_idx"
    ON "GuestGift" ("guestId", "sortOrder");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GuestGift_guestId_fkey'
  ) THEN
    ALTER TABLE "GuestGift"
      ADD CONSTRAINT "GuestGift_guestId_fkey"
      FOREIGN KEY ("guestId") REFERENCES "Guest"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
