/**
 * Apply Black Sheep Shelter seating chart assignments to existing guests.
 *
 * Usage:
 *   npx tsx scripts/seed-guest-seating.ts
 *
 * Updates table numbers/spots only. Creates missing chart households (Crossbows).
 * Does NOT delete guests, addresses, or gifts.
 */
import { applyGuestSeating } from "@/lib/apply-guest-seating";
import { prisma } from "@/lib/db";

async function main() {
  const result = await applyGuestSeating(prisma);
  console.log(
    `Seating applied. Updated ${result.updated}, cleared ${result.cleared}, created ${result.created}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
