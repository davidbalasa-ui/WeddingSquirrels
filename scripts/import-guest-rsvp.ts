/**
 * Import guest RSVP status from a Squirrels CSV export.
 *
 * Usage:
 *   npx tsx scripts/import-guest-rsvp.ts [path-to-csv]
 *   npx tsx scripts/import-guest-rsvp.ts --dry-run [path-to-csv]
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { applyGuestRsvpImport } from "@/lib/apply-guest-rsvp-import";
import { groupCsvRowsByHousehold, householdRsvpFromPeople, parseGuestRsvpCsv } from "@/lib/guest-rsvp-import";
import { prisma } from "@/lib/db";

const DEFAULT_CSV = path.join(process.cwd(), "data", "guest-rsvp.csv");

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const csvPath = args.find((arg) => !arg.startsWith("--")) ?? DEFAULT_CSV;
  const csvText = readFileSync(csvPath, "utf8");

  if (dryRun) {
    const households = groupCsvRowsByHousehold(parseGuestRsvpCsv(csvText));
    for (const household of households) {
      const rsvp = householdRsvpFromPeople(household.people);
      console.log(
        `[dry-run] ${household.party} → ${rsvp.rsvpStatus} (${rsvp.acceptedCount}/${rsvp.invitedCount})`,
      );
    }
    console.log(`\n[dry-run] Would process ${households.length} households.`);
    return;
  }

  const result = await applyGuestRsvpImport(prisma, csvText);
  console.log(
    `Processed ${result.processed} households. Updated ${result.updated}, created ${result.created}.`,
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
