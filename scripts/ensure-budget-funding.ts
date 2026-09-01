import { prisma } from "@/lib/db";

const DEFAULT_SOURCES = [
  { id: "funding-david-savings", label: "David — personal savings", amount: 5000, status: "available", sortOrder: 0 },
  { id: "funding-david-401k", label: "David — 401(k) loan", amount: 10000, status: "available", sortOrder: 1 },
  { id: "funding-john-shelly-donated", label: "John & Shelly — donated", amount: 5000, status: "available", sortOrder: 2 },
  { id: "funding-john-shelly-promised", label: "John & Shelly — promised", amount: 5000, status: "expected", sortOrder: 3 },
] as const;

async function main() {
  const existing = await prisma.budgetFundingSource.count();
  if (existing > 0) {
    console.log(`BudgetFundingSource already has ${existing} row(s); skipping seed.`);
    return;
  }

  for (const source of DEFAULT_SOURCES) {
    await prisma.budgetFundingSource.create({ data: source });
  }

  console.log(`Seeded ${DEFAULT_SOURCES.length} funding sources.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
