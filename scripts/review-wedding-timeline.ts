/**
 * Review-only. Never writes.
 *
 *   npx tsx scripts/review-wedding-timeline.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import {
  CANDIDATE_WEDDING_TIMELINE,
  formatCandidateReview,
  reviewCandidateWeddingTimeline,
} from "../src/lib/day-of-bootstrap";
import { isNeonDatabaseUrl } from "../src/lib/db";

function clientFor(url: string) {
  if (isNeonDatabaseUrl(url)) {
    return new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
  }
  return new PrismaClient();
}

async function main() {
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
    const missing = review.filter((row) => row.status === "MISSING").length;
    const exists = review.filter((row) => row.status === "EXISTS").length;
    const different = review.filter((row) => row.status === "DIFFERENT").length;
    console.log(`SUMMARY  missing=${missing} exists=${exists} different=${different}`);
    console.log("No rows were written.");
    console.log(`Candidate count=${CANDIDATE_WEDDING_TIMELINE.length}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
