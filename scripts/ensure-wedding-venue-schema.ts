import "dotenv/config";
import { ensureWeddingPlaceColumns, prisma } from "../src/lib/db";

async function main() {
  await ensureWeddingPlaceColumns();
  const target = process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "database";
  console.log(
    `Wedding venue + calendar location columns ensured on ${target}. No wedding content rows were changed.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
