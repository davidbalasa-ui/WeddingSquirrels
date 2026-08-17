/**
 * One-time seating chart import for the Squirrels wedding.
 *
 * Usage:
 *   npx tsx scripts/seed-guest-seating.ts
 *
 * WARNING: Deletes all existing guest households and re-creates them from the
 * seating chart. Run against Neon with your production DATABASE_URL.
 */
import { prisma } from "@/lib/db";
import { syncLegacyGuestNames } from "@/lib/guest-gifts";

type SeatPerson = {
  name: string;
  note?: string;
};

type HouseholdSeed = {
  /** Primary household label for sorting / display */
  label: string;
  tableNumber: number;
  section: "West" | "East" | "Center";
  tableLabel?: string;
  people: SeatPerson[];
};

function tableSpot(section: string, note?: string, tableLabel?: string) {
  const parts = [tableLabel, section, note].filter(Boolean);
  return parts.join(" · ");
}

/** Squirrels seating chart — households grouped by family / invitation unit. */
const HOUSEHOLDS: HouseholdSeed[] = [
  {
    label: "Haley & David",
    tableNumber: 0,
    section: "Center",
    tableLabel: "Head",
    people: [{ name: "Haley Wiewiora" }, { name: "David Balasa" }],
  },
  {
    label: "Arianna Devros",
    tableNumber: 1,
    section: "West",
    people: [{ name: "Arianna Devros" }],
  },
  {
    label: "Marie",
    tableNumber: 1,
    section: "West",
    people: [{ name: "Marie" }, { name: "Marie +1" }],
  },
  {
    label: "Jay & Grace McMann",
    tableNumber: 1,
    section: "West",
    people: [{ name: "Jay McMann" }, { name: "Grace Brown" }],
  },
  {
    label: "Marie Wiewiora",
    tableNumber: 1,
    section: "West",
    people: [
      { name: "Marie Wiewiora" },
      { name: "Juniper Wiewiora", note: "child" },
      { name: "Rowan Wiewiora", note: "child" },
    ],
  },
  {
    label: "Ken Brown",
    tableNumber: 1,
    section: "West",
    people: [{ name: "Ken Brown" }],
  },
  {
    label: "Crossbow family",
    tableNumber: 2,
    section: "East",
    people: [
      { name: "Carly Crossbow" },
      { name: "Claire Crossbow" },
      { name: "Adam Crossbow" },
      { name: "Ethan Crossbow" },
      { name: "Joe Crossbow" },
      { name: "Mike Crossbow" },
      { name: "Steve Crossbow" },
    ],
  },
  {
    label: "Berman family",
    tableNumber: 3,
    section: "West",
    people: [
      { name: "Leslie Berman" },
      { name: "Tracy Gomez" },
      { name: "Susan Berman" },
      { name: "Cynthia Berman" },
      { name: "David Berman" },
    ],
  },
  {
    label: "Balasa & Hammond",
    tableNumber: 4,
    section: "Center",
    people: [
      { name: "Hannah Balasa" },
      { name: "Elijah Balasa", note: "child" },
      { name: "Bryan Balasa" },
      { name: "Elizabeth Hammond" },
      { name: "Benjamin Balasa" },
      { name: "Liliana Balasa", note: "child" },
      { name: "Pamela Balasa" },
      { name: "Jeremy Hammond" },
    ],
  },
  {
    label: "Morgan Black",
    tableNumber: 5,
    section: "East",
    people: [{ name: "Morgan Black" }, { name: "Morgan +1" }],
  },
  {
    label: "Kippe family",
    tableNumber: 5,
    section: "East",
    people: [{ name: "Josh Kippe" }, { name: "Katie Kippe" }],
  },
  {
    label: "Wiewiora family",
    tableNumber: 6,
    section: "West",
    tableLabel: "Wiewiora",
    people: [
      { name: "John Wiewiora" },
      { name: "Shelly Wiewiora" },
      { name: "Wendy Rush" },
      { name: "Katie Wiewiora" },
      { name: "Scarlett Wiewiora", note: "child" },
      { name: "Evan Wiewiora" },
      { name: "Kurt Huizenga" },
    ],
  },
  {
    label: "Balasa & Hammond kids",
    tableNumber: 7,
    section: "Center",
    people: [
      { name: "Jennifer Hammond", note: "child" },
      { name: "Esther Hammond", note: "child" },
      { name: "Isaac Balasa", note: "child · Celiac" },
      { name: "Harmony Balasa", note: "child" },
      { name: "Melody Balasa", note: "child" },
      { name: "Meira Balasa", note: "child · Celiac" },
    ],
  },
  {
    label: "Olaffson family",
    tableNumber: 8,
    section: "East",
    people: [
      { name: "Finn Olaffson", note: "child · Vegan/Celiac" },
      { name: "Carrie Foura", note: "Vegan/Celiac" },
      { name: "Gusti Olaffson", note: "child · Vegan/Celiac" },
      { name: "Siggi Olaffson", note: "child · Vegan/Celiac" },
      { name: "Agust Olaffson", note: "Vegan" },
    ],
  },
  {
    label: "Mary Ramos",
    tableNumber: 8,
    section: "East",
    people: [{ name: "Mary Ramos" }, { name: "Mary +1" }],
  },
  {
    label: "Fleener & Cartwright",
    tableNumber: 9,
    section: "West",
    people: [
      { name: "Kaylie Cartwright" },
      { name: "Andi Cartwright" },
      { name: "Austin Fleener" },
      { name: "Kaylie +1" },
      { name: "Jared Fleener" },
      { name: "Marie Fleener" },
    ],
  },
  {
    label: "Owens & friends",
    tableNumber: 10,
    section: "Center",
    people: [
      { name: "Anthony Owens" },
      { name: "Victoria Owens" },
      { name: "Belle Genton" },
      { name: "Belle +1" },
      { name: "Skila Goins" },
      { name: "Mykah McKay" },
    ],
  },
  {
    label: "Wedding party table",
    tableNumber: 11,
    section: "East",
    people: [
      { name: "Braxton Wasilewski" },
      { name: "Braxton +1" },
      { name: "Evan Eling" },
      { name: "Bri Eling" },
      { name: "Trinity Medler" },
      { name: "Erica Pallas" },
      { name: "Erica +1" },
    ],
  },
];

async function main() {
  const existing = await prisma.guest.count();
  console.log(`Replacing ${existing} existing guest households with seating chart data…`);

  await prisma.guest.deleteMany();

  let sortOrder = 0;
  let peopleCount = 0;

  for (const household of HOUSEHOLDS) {
    const people = household.people.map((person, index) => ({
      name: person.name,
      tableNumber: household.tableNumber,
      tableSpot: tableSpot(household.section, person.note, household.tableLabel),
      sortOrder: index,
    }));
    const legacy = syncLegacyGuestNames(people);
    const invitedCount = people.length;

    await prisma.guest.create({
      data: {
        ...legacy,
        sortOrder: sortOrder++,
        invitedCount,
        acceptedCount: invitedCount,
        rsvpStatus: "attending",
        people: { create: people },
      },
    });
    peopleCount += people.length;
  }

  console.log(
    `Seeded ${HOUSEHOLDS.length} households (${peopleCount} guests) across tables 0–11.`,
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
