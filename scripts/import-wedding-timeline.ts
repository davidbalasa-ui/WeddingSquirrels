/**
 * Import MISSING candidate wedding TimelineBlocks only.
 *
 * Default is review-only.
 *
 *   npx tsx scripts/import-wedding-timeline.ts
 *   npx tsx scripts/import-wedding-timeline.ts --apply --keys=wedding_settle_in,wedding_diy_hair
 *
 * Never overwrites an existing seedKey row.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import {
  formatCandidateReview,
  planCandidateWeddingImport,
  reviewCandidateWeddingTimeline,
} from "../src/lib/day-of-bootstrap";
import { isNeonDatabaseUrl } from "../src/lib/db";

function clientFor(url: string) {
  if (isNeonDatabaseUrl(url)) {
    return new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
  }
  return new PrismaClient();
}

function parseKeys(argv: string[]): string[] {
  const keys: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--keys" || arg.startsWith("--keys=")) {
      const value = arg === "--keys" ? argv[++i] : arg.slice("--keys=".length);
      if (value) keys.push(...value.split(",").map((part) => part.trim()).filter(Boolean));
    }
  }
  return keys;
}

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");
  const selected = parseKeys(argv);
  const url = process.env.NEON_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim() || "";
  if (!url) throw new Error("Set DATABASE_URL or NEON_DATABASE_URL");

  const prisma = clientFor(url);
  try {
    const existing = await prisma.timelineBlock.findMany({
      where: { schedule: "wedding" },
      select: {
        id: true,
        seedKey: true,
        startAt: true,
        endAt: true,
        notes: true,
        sortOrder: true,
        schedule: true,
      },
    });
    const review = reviewCandidateWeddingTimeline(existing);
    console.log(formatCandidateReview(review));

    if (!apply) {
      console.log("Review only. Pass --apply --keys=seed_a,seed_b to insert MISSING selected rows.");
      return;
    }
    if (selected.length === 0) {
      console.error("Refusing --apply without --keys. Approve specific seedKeys.");
      process.exit(1);
    }

    const plan = planCandidateWeddingImport(existing, selected);
    if (plan.unknownKeys.length) {
      console.error(`Unknown seedKeys: ${plan.unknownKeys.join(", ")}`);
      process.exit(1);
    }
    if (plan.refusedOverwrite.length) {
      console.error(`Refusing overwrite of existing rows: ${plan.refusedOverwrite.join(", ")}`);
      process.exit(1);
    }
    if (plan.inserts.length === 0) {
      console.log("Nothing to insert.");
      return;
    }

    await prisma.timelineBlock.createMany({ data: plan.inserts });
    console.log(`Inserted ${plan.inserts.length} missing wedding block(s):`);
    for (const row of plan.inserts) {
      console.log(`  ${row.seedKey} sortOrder=${row.sortOrder} ${row.startAt}`);
    }
    if (plan.skippedUnselected.length) {
      console.log(`Left unselected missing rows untouched: ${plan.skippedUnselected.join(", ")}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
