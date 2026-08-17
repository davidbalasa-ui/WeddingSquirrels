/**
 * Apply Squirrels seating chart table assignments to existing guest households.
 *
 * Usage:
 *   npx tsx scripts/seed-guest-seating.ts
 *
 * Updates table numbers/spots only — does NOT delete guests, addresses, or gifts.
 * Optionally backfills GuestPerson rows when missing.
 */
import { prisma } from "@/lib/db";
import { syncLegacyGuestNames } from "@/lib/guest-gifts";

type Section = "West" | "East" | "Center";

type SeatPerson = {
  name: string;
  note?: string;
};

type HouseholdSeed = {
  tableNumber: number;
  section: Section;
  tableLabel?: string;
  people: SeatPerson[];
};

type GuestRow = {
  id: string;
  nameLine1: string;
  nameLine2: string | null;
};

function tableSpot(section: Section, note?: string, tableLabel?: string) {
  return [tableLabel, section, note].filter(Boolean).join(" · ");
}

function guestHaystack(guest: GuestRow) {
  return `${guest.nameLine1} ${guest.nameLine2 ?? ""}`.toLowerCase();
}

function matchesAll(guest: GuestRow, tokens: string[]) {
  const hay = guestHaystack(guest);
  return tokens.every((token) => hay.includes(token.toLowerCase()));
}

/** Seating chart people keyed by normalized full name. */
const CHART_PEOPLE: HouseholdSeed[] = [
  { tableNumber: 0, section: "Center", tableLabel: "Head", people: [{ name: "Haley Wiewiora" }, { name: "David Balasa" }] },
  { tableNumber: 1, section: "West", people: [{ name: "Arianna Devros" }] },
  { tableNumber: 1, section: "West", people: [{ name: "Marie" }, { name: "Marie +1" }] },
  { tableNumber: 1, section: "West", people: [{ name: "Jay McMann" }, { name: "Grace Brown" }] },
  { tableNumber: 1, section: "West", people: [{ name: "Marie Wiewiora" }, { name: "Juniper Wiewiora", note: "child" }, { name: "Rowan Wiewiora", note: "child" }] },
  { tableNumber: 1, section: "West", people: [{ name: "Ken Brown" }] },
  { tableNumber: 2, section: "East", people: [{ name: "Carly Crossbow" }, { name: "Claire Crossbow" }, { name: "Adam Crossbow" }, { name: "Ethan Crossbow" }, { name: "Joe Crossbow" }, { name: "Mike Crossbow" }, { name: "Steve Crossbow" }] },
  { tableNumber: 3, section: "West", people: [{ name: "Leslie Berman" }, { name: "Tracy Gomez" }, { name: "Susan Berman" }, { name: "Cynthia Berman" }, { name: "David Berman" }] },
  { tableNumber: 4, section: "Center", people: [{ name: "Hannah Balasa" }, { name: "Elijah Balasa", note: "child" }, { name: "Bryan Balasa" }, { name: "Elizabeth Hammond" }, { name: "Benjamin Balasa" }, { name: "Liliana Balasa", note: "child" }, { name: "Pamela Balasa" }, { name: "Jeremy Hammond" }] },
  { tableNumber: 5, section: "East", people: [{ name: "Morgan Black" }, { name: "Morgan +1" }] },
  { tableNumber: 5, section: "East", people: [{ name: "Josh Kippe" }, { name: "Katie Kippe" }] },
  { tableNumber: 6, section: "West", tableLabel: "Wiewiora", people: [{ name: "John Wiewiora" }, { name: "Shelly Wiewiora" }, { name: "Wendy Rush" }, { name: "Katie Wiewiora" }, { name: "Scarlett Wiewiora", note: "child" }, { name: "Evan Wiewiora" }, { name: "Kurt Huizenga" }] },
  { tableNumber: 7, section: "Center", people: [{ name: "Jennifer Hammond", note: "child" }, { name: "Esther Hammond", note: "child" }, { name: "Isaac Balasa", note: "child · Celiac" }, { name: "Harmony Balasa", note: "child" }, { name: "Melody Balasa", note: "child" }, { name: "Meira Balasa", note: "child · Celiac" }] },
  { tableNumber: 8, section: "East", people: [{ name: "Finn Olaffson", note: "child · Vegan/Celiac" }, { name: "Carrie Foura", note: "Vegan/Celiac" }, { name: "Gusti Olaffson", note: "child · Vegan/Celiac" }, { name: "Siggi Olaffson", note: "child · Vegan/Celiac" }, { name: "Agust Olaffson", note: "Vegan" }] },
  { tableNumber: 8, section: "East", people: [{ name: "Mary Ramos" }, { name: "Mary +1" }] },
  { tableNumber: 9, section: "West", people: [{ name: "Kaylie Cartwright" }, { name: "Andi Cartwright" }, { name: "Austin Fleener" }, { name: "Kaylie +1" }, { name: "Jared Fleener" }, { name: "Marie Fleener" }] },
  { tableNumber: 10, section: "Center", people: [{ name: "Anthony Owens" }, { name: "Victoria Owens" }, { name: "Belle Genton" }, { name: "Belle +1" }, { name: "Skila Goins" }, { name: "Mykah McKay" }] },
  { tableNumber: 11, section: "East", people: [{ name: "Braxton Wasilewski" }, { name: "Braxton +1" }, { name: "Evan Eling" }, { name: "Bri Eling" }, { name: "Trinity Medler" }, { name: "Erica Pallas" }, { name: "Erica +1" }] },
];

function normalizeName(name: string) {
  return name
    .toLowerCase()
    .replace(/\bms\b/g, "")
    .replace(/\(child\)/gi, "")
    .replace(/[^a-z0-9+\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PERSON_SEATING = new Map<string, { tableNumber: number; tableSpot: string }>();
for (const group of CHART_PEOPLE) {
  for (const person of group.people) {
    PERSON_SEATING.set(normalizeName(person.name), {
      tableNumber: group.tableNumber,
      tableSpot: tableSpot(group.section, person.note, group.tableLabel),
    });
  }
}

type HouseholdRule = {
  tokens: string[];
  tableNumber: number;
  section: Section;
  tableLabel?: string;
  /** Override people to create when backfilling GuestPerson rows. */
  people?: SeatPerson[];
};

/** Map existing spreadsheet household rows to seating chart tables. */
const HOUSEHOLD_RULES: HouseholdRule[] = [
  { tokens: ["john wiewiora", "shelly"], tableNumber: 6, section: "West", tableLabel: "Wiewiora", people: [{ name: "John Wiewiora" }, { name: "Shelly Wiewiora" }] },
  { tokens: ["bryan balasa", "pam"], tableNumber: 4, section: "Center", people: [{ name: "Bryan Balasa" }, { name: "Pamela Balasa" }] },
  { tokens: ["tracy gomez"], tableNumber: 3, section: "West", people: [{ name: "Tracy Gomez" }, { name: "Tracy Gomez +1" }] },
  { tokens: ["leslie berman"], tableNumber: 3, section: "West", people: [{ name: "Leslie Berman" }, { name: "Leslie Berman +1" }] },
  { tokens: ["cynthia berman"], tableNumber: 3, section: "West", people: [{ name: "Cynthia Berman" }, { name: "Cynthia Berman +1" }] },
  { tokens: ["david berman", "susan"], tableNumber: 3, section: "West", people: [{ name: "David Berman" }, { name: "Susan Berman" }] },
  { tokens: ["evan", "scarlett"], tableNumber: 6, section: "West", tableLabel: "Wiewiora", people: [{ name: "Evan Wiewiora" }, { name: "Katie Wiewiora" }, { name: "Scarlett Wiewiora", note: "child" }] },
  { tokens: ["marie", "juniper", "rowan"], tableNumber: 1, section: "West", people: [{ name: "Marie Wiewiora" }, { name: "Juniper Wiewiora", note: "child" }, { name: "Rowan Wiewiora", note: "child" }] },
  { tokens: ["benjamin balasa"], tableNumber: 4, section: "Center", people: [{ name: "Benjamin Balasa" }] },
  { tokens: ["hammond", "family"], tableNumber: 4, section: "Center", people: [{ name: "Elizabeth Hammond" }, { name: "Jeremy Hammond" }] },
  { tokens: ["mykah", "skila"], tableNumber: 10, section: "Center", people: [{ name: "Mykah McKay" }, { name: "Skila Goins" }] },
  { tokens: ["melody", "balasa"], tableNumber: 7, section: "Center", people: [{ name: "Melody Balasa", note: "child" }] },
  { tokens: ["harmony", "balasa"], tableNumber: 7, section: "Center", people: [{ name: "Harmony Balasa", note: "child" }] },
  { tokens: ["austin", "fleener"], tableNumber: 9, section: "West", people: [{ name: "Austin Fleener" }] },
  { tokens: ["ken brown", "grace"], tableNumber: 1, section: "West", people: [{ name: "Ken Brown" }, { name: "Grace Brown" }] },
  { tokens: ["wendy rush", "kurt"], tableNumber: 6, section: "West", tableLabel: "Wiewiora", people: [{ name: "Wendy Rush" }, { name: "Kurt Huizenga" }] },
  { tokens: ["morgan black"], tableNumber: 5, section: "East", people: [{ name: "Morgan Black" }, { name: "Morgan +1" }] },
  { tokens: ["josh kippe", "katie kippe"], tableNumber: 5, section: "East", people: [{ name: "Josh Kippe" }, { name: "Katie Kippe" }] },
  { tokens: ["mary ramos"], tableNumber: 8, section: "East", people: [{ name: "Mary Ramos" }] },
  { tokens: ["anthony owens", "victoria"], tableNumber: 10, section: "Center", people: [{ name: "Anthony Owens" }, { name: "Victoria Owens" }] },
  { tokens: ["belle genton"], tableNumber: 10, section: "Center", people: [{ name: "Belle Genton" }] },
  { tokens: ["olaffson", "family"], tableNumber: 8, section: "East", people: [{ name: "Agust Olaffson" }, { name: "Carrie Foura", note: "Vegan/Celiac" }] },
  { tokens: ["jay mcmann", "arianna"], tableNumber: 1, section: "West", people: [{ name: "Jay McMann" }, { name: "Arianna Devros" }] },
  { tokens: ["jared fleener", "marie fleener"], tableNumber: 9, section: "West", people: [{ name: "Jared Fleener" }, { name: "Marie Fleener" }] },
  { tokens: ["erica pallas"], tableNumber: 11, section: "East", people: [{ name: "Erica Pallas" }, { name: "Erica +1" }] },
  { tokens: ["kaylie cartwright"], tableNumber: 9, section: "West", people: [{ name: "Kaylie Cartwright" }, { name: "Kaylie +1" }] },
  { tokens: ["braxton wasilewski"], tableNumber: 11, section: "East", people: [{ name: "Braxton Wasilewski" }, { name: "Braxton +1" }] },
  { tokens: ["evan eling"], tableNumber: 11, section: "East", people: [{ name: "Evan Eling" }] },
  { tokens: ["andi cartwright"], tableNumber: 9, section: "West", people: [{ name: "Andi Cartwright" }] },
  { tokens: ["trinity medler", "bri eling"], tableNumber: 11, section: "East", people: [{ name: "Trinity Medler" }, { name: "Bri Eling" }] },
];

function findRule(guest: GuestRow) {
  return HOUSEHOLD_RULES.find((rule) => matchesAll(guest, rule.tokens));
}

function seatingForPerson(name: string, fallback: HouseholdRule) {
  return (
    PERSON_SEATING.get(normalizeName(name)) ?? {
      tableNumber: fallback.tableNumber,
      tableSpot: tableSpot(fallback.section, undefined, fallback.tableLabel),
    }
  );
}

function peopleForGuest(guest: GuestRow, rule: HouseholdRule): SeatPerson[] {
  if (rule.people?.length) return rule.people;
  const people: SeatPerson[] = [];
  if (guest.nameLine1.trim()) people.push({ name: guest.nameLine1.trim() });
  if (guest.nameLine2?.trim() && guest.nameLine2.trim() !== "+1" && guest.nameLine2.trim() !== "Family") {
    people.push({ name: guest.nameLine2.trim() });
  }
  return people;
}

async function main() {
  const replace = process.argv.includes("--replace");
  if (replace) {
    console.error("Refusing --replace. This script only updates seating on existing guests.");
    process.exit(1);
  }

  const guests = await prisma.guest.findMany({
    include: { people: { orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });

  let updated = 0;
  let skipped = 0;
  const unmatched: string[] = [];

  for (const guest of guests) {
    const rule = findRule(guest);
    if (!rule) {
      unmatched.push(`${guest.nameLine1} · ${guest.nameLine2 ?? ""}`.trim());
      skipped += 1;
      continue;
    }

    const seatPeople = peopleForGuest(guest, rule).map((person, index) => {
      const seat = seatingForPerson(person.name, rule);
      return {
        name: person.name,
        tableNumber: seat.tableNumber,
        tableSpot: person.note ? seatingForPerson(person.name, rule).tableSpot : seat.tableSpot,
        sortOrder: index,
      };
    });

    const legacy = syncLegacyGuestNames(seatPeople);

    await prisma.$transaction(async (tx) => {
      if (guest.people.length === 0) {
        await tx.guestPerson.createMany({
          data: seatPeople.map((person) => ({
            guestId: guest.id,
            name: person.name,
            tableNumber: person.tableNumber,
            tableSpot: person.tableSpot,
            sortOrder: person.sortOrder,
          })),
        });
      } else {
        for (const person of guest.people) {
          const seat =
            PERSON_SEATING.get(normalizeName(person.name)) ??
            seatingForPerson(person.name, rule);
          await tx.guestPerson.update({
            where: { id: person.id },
            data: {
              tableNumber: seat.tableNumber,
              tableSpot: seat.tableSpot,
            },
          });
        }
      }

      await tx.guest.update({
        where: { id: guest.id },
        data: legacy,
      });
    });

    updated += 1;
    console.log(`✓ ${guest.nameLine1}${guest.nameLine2 ? ` · ${guest.nameLine2}` : ""} → Table ${legacy.person1TableNumber}`);
  }

  console.log(`\nUpdated seating for ${updated} households. Skipped ${skipped}.`);
  if (unmatched.length) {
    console.log("\nNo seating rule matched:");
    for (const name of unmatched) console.log(`  - ${name}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
