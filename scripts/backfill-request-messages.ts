import { prisma } from "@/lib/db";

async function main() {
  const requests = await prisma.request.findMany({
    where: { note: { not: null } },
    include: { messages: true },
  });

  let updated = 0;
  for (const request of requests) {
    if (request.messages.length > 0) continue;
    const note = request.note?.trim();
    if (!note) continue;

    await prisma.requestMessage.create({
      data: {
        requestId: request.id,
        authorAccountId: request.senderAccountId,
        body: note,
        sortOrder: 0,
      },
    });
    updated += 1;
  }

  await prisma.request.updateMany({
    where: { senderReadAt: null, status: "open" },
    data: { senderReadAt: new Date() },
  });

  console.log(`Backfilled ${updated} request threads.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
