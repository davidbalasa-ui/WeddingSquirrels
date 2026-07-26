import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { ensureOrgCards } from "../src/lib/org-cards";

const prisma = new PrismaClient();

async function main() {
  console.log("Ensuring week-before and day-before org cards…");
  await ensureOrgCards(prisma);
  const cards = await prisma.task.findMany({
    where: { orgKey: { not: null } },
    include: { _count: { select: { children: true } }, assignees: { include: { person: true } } },
    orderBy: { sortOrder: "asc" },
  });
  console.log(
    cards.map((c) => ({
      orgKey: c.orgKey,
      title: c.title,
      steps: c._count.children,
      owners: c.assignees.map((a) => a.person.name).join(", "),
      due: c.dueDate,
    })),
  );
  console.log("ORG CARDS READY");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
