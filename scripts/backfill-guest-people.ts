import { prisma } from "@/lib/db";

async function main() {
  const guests = await prisma.guest.findMany({
    include: { people: { orderBy: { sortOrder: "asc" } } },
  });

  let updated = 0;
  for (const guest of guests) {
    if (guest.people.length > 0) continue;

    const people: Array<{ name: string; tableNumber: number | null; tableSpot: string | null; sortOrder: number }> = [];
    if (guest.nameLine1.trim()) {
      people.push({
        name: guest.nameLine1.trim(),
        tableNumber: guest.person1TableNumber,
        tableSpot: guest.person1TableSpot,
        sortOrder: 0,
      });
    }
    if (guest.nameLine2?.trim()) {
      people.push({
        name: guest.nameLine2.trim(),
        tableNumber: guest.person2TableNumber,
        tableSpot: guest.person2TableSpot,
        sortOrder: 1,
      });
    }
    if (people.length === 0) continue;

    await prisma.guestPerson.createMany({
      data: people.map((person) => ({
        guestId: guest.id,
        name: person.name,
        tableNumber: person.tableNumber,
        tableSpot: person.tableSpot,
        sortOrder: person.sortOrder,
      })),
    });
    updated += 1;
  }

  console.log(`Backfilled guest people for ${updated} households.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
