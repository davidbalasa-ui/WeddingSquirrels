import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "MealCourse" ADD COLUMN IF NOT EXISTS "minSelections" INTEGER NOT NULL DEFAULT 1`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "MealCourse" ADD COLUMN IF NOT EXISTS "maxSelections" INTEGER NOT NULL DEFAULT 1`,
  );

  await prisma.$executeRawUnsafe(
    `ALTER TABLE "MealOption" ADD COLUMN IF NOT EXISTS "followUpPrompt" TEXT`,
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MealOptionFollowUpChoice" (
      "id" TEXT NOT NULL,
      "optionId" TEXT NOT NULL,
      "label" TEXT NOT NULL,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT "MealOptionFollowUpChoice_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "MealOptionFollowUpChoice_optionId_sortOrder_idx"
    ON "MealOptionFollowUpChoice"("optionId", "sortOrder")
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "MealOptionFollowUpChoice"
        ADD CONSTRAINT "MealOptionFollowUpChoice_optionId_fkey"
        FOREIGN KEY ("optionId") REFERENCES "MealOption"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);

  await prisma.$executeRawUnsafe(
    `ALTER TABLE "MealGuest" ADD COLUMN IF NOT EXISTS "guestPersonId" TEXT`,
  );
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "MealGuest_guestPersonId_idx" ON "MealGuest"("guestPersonId")
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "MealGuest"
        ADD CONSTRAINT "MealGuest_guestPersonId_fkey"
        FOREIGN KEY ("guestPersonId") REFERENCES "GuestPerson"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);

  await prisma.$executeRawUnsafe(
    `ALTER TABLE "MealChoice" ADD COLUMN IF NOT EXISTS "followUpChoiceId" TEXT`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "MealChoice" ADD COLUMN IF NOT EXISTS "followUpText" TEXT`,
  );
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "MealChoice_followUpChoiceId_idx" ON "MealChoice"("followUpChoiceId")
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "MealChoice"
        ADD CONSTRAINT "MealChoice_followUpChoiceId_fkey"
        FOREIGN KEY ("followUpChoiceId") REFERENCES "MealOptionFollowUpChoice"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);

  // Expand primary key to allow multiple options per course (legacy rows remain valid).
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "MealChoice" DROP CONSTRAINT "MealChoice_pkey";
    EXCEPTION WHEN undefined_object THEN NULL;
    END $$
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "MealChoice"
        ADD CONSTRAINT "MealChoice_pkey" PRIMARY KEY ("guestId", "courseId", "optionId");
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);

  console.log("Flexible rehearsal dinner meal schema ensured.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
