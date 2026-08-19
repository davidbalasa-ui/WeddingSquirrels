import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Everyone who should appear in the Day-of assignment name dropdowns. */
const KNOWN_NAMES = [
  "David",
  "Haley",
  "Shelly",
  "Bri",
  // Vendors / day-of helpers from the itinerary
  "Avalon Green",
  "Black Sheep Shelter",
  "Barry Tilson",
  "Belle Genton",
  "Precious Peony",
  "Wendy Rush",
  "Kurt",
  // Wedding party / family referenced in the itinerary
  "Katie",
  "Harmony",
  "Melody",
  "Skila",
  "Maid of Honor",
  "Best Man",
  "Father of the Bride",
  "Mother of the Bride",
  "Bridal party",
];

/** Same slug logic as src/lib/people.ts so ids stay stable across the app. */
function personIdFromName(name: string) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return base || `person_${Date.now()}`;
}

async function ensurePersonByName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const existing = await prisma.person.findFirst({
    where: { name: { equals: trimmed, mode: "insensitive" } },
  });
  if (existing) return existing;

  let id = personIdFromName(trimmed);
  const clash = await prisma.person.findUnique({ where: { id } });
  if (clash) id = `${id}_${Date.now().toString(36)}`;

  const maxSort = await prisma.person.aggregate({ _max: { sortOrder: true } });
  return prisma.person.create({
    data: {
      id,
      name: trimmed,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });
}

async function main() {
  let created = 0;
  for (const name of KNOWN_NAMES) {
    const person = await ensurePersonByName(name);
    if (person) created += 1;
  }

  const all = await prisma.person.findMany({
    select: { id: true, name: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  console.log(`Ensured ${created} known people. Total people: ${all.length}`);
  console.log(all.map((person) => person.name).join(", "));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
