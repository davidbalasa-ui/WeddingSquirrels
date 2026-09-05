/**
 * OBSOLETE as a production source of truth.
 *
 * Classification: unsafe for production / obsolete after the candidate-import workflow.
 * Historical candidate wedding blocks now live in src/lib/day-of-bootstrap.ts.
 *
 * This script must not overwrite or recreate live TimelineBlock rows.
 * Review:  npx tsx scripts/review-wedding-timeline.ts
 * Import:  npx tsx scripts/import-wedding-timeline.ts --apply --keys=seed_a,seed_b
 */
import { isNeonDatabaseUrl } from "../src/lib/db";

function main() {
  const url = process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL ?? "";
  if (isNeonDatabaseUrl(url) || process.env.PGHOST?.toLowerCase().endsWith(".neon.tech")) {
    console.error("Refusing ensure-day-of.ts against production Neon.");
    console.error("The live wedding timeline is edited in PLAN Timeline.");
    console.error("Use scripts/review-wedding-timeline.ts and an explicit import of MISSING rows.");
    process.exit(1);
  }

  console.error("ensure-day-of.ts is obsolete.");
  console.error("It is no longer allowed to insert wedding/rehearsal/contact rows.");
  console.error("Review candidates: npx tsx scripts/review-wedding-timeline.ts");
  console.error("Import missing:    npx tsx scripts/import-wedding-timeline.ts --apply --keys=...");
  process.exit(1);
}

main();
