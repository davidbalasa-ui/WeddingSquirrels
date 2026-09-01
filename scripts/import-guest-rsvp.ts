/**
 * Import guest RSVP status from a Squirrels CSV export.
 *
 * Usage:
 *   npx tsx scripts/import-guest-rsvp.ts [path-to-csv]
 *   npx tsx scripts/import-guest-rsvp.ts --dry-run [path-to-csv]
 *
 * Updates rsvpStatus, invitedCount, and acceptedCount for matched households.
 * Creates missing households (with GuestPerson rows) when no match is found.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { syncLegacyGuestNames } from "@/lib/guest-gifts";
import {
  findBestGuestMatch,
  groupCsvRowsByHousehold,
  householdRsvpFromPeople,
  parseGuestRsvpCsv,
  type CsvHousehold,
} from "@/lib/guest-rsvp-import";

const DEFAULT_CSV = path.join(process.cwd(), "data", "guest-rsvp.csv");

type DbGuest = {
  id: string;
  sortOrder: number;
  nameLine1: string;
  nameLine2: string | null;
  people: Array<{ name: string }>;
};

async function upsertHousehold(
  household: CsvHousehold,
  guest: DbGuest | null,
  sortOrder: number,
  dryRun: boolean,
): Promise<"created" | "updated"> {
  const people = household.people.map((person, index) => ({
    name: person.displayName,
    sortOrder: index,
  }));
  const rsvp = householdRsvpFromPeople(household.people);
  const legacy = syncLegacyGuestNames(people);

  if (dryRun) {
    const action = guest ? "update" : "create";
    console.log(
      `[dry-run] ${action} ${household.party} → ${rsvp.rsvpStatus} (${rsvp.acceptedCount}/${rsvp.invitedCount})`,
    );
    return guest ? "updated" : "created";
  }

  if (guest) {
    await prisma.$transaction(async (tx) => {
      await tx.guest.update({
        where: { id: guest.id },
        data: {
          ...legacy,
          rsvpStatus: rsvp.rsvpStatus,
          invitedCount: rsvp.invitedCount,
          acceptedCount: rsvp.acceptedCount,
        },
      });

      const existingPeople = await tx.guestPerson.findMany({
        where: { guestId: guest.id },
        orderBy: { sortOrder: "asc" },
      });

      if (existingPeople.length === 0) {
        await tx.guestPerson.createMany({
          data: people.map((person) => ({
            guestId: guest.id,
            name: person.name,
            sortOrder: person.sortOrder,
          })),
        });
      } else if (existingPeople.length === people.length) {
        for (let index = 0; index < people.length; index += 1) {
          const existing = existingPeople[index];
          const nextName = people[index].name;
          if (existing.name !== nextName) {
            await tx.guestPerson.update({
              where: { id: existing.id },
              data: { name: nextName },
            });
          }
        }
      }
    });
    console.log(
      `✓ updated ${household.party} → ${rsvp.rsvpStatus} (${rsvp.acceptedCount}/${rsvp.invitedCount})`,
    );
    return "updated";
  }

  await prisma.guest.create({
    data: {
      ...legacy,
      rsvpStatus: rsvp.rsvpStatus,
      invitedCount: rsvp.invitedCount,
      acceptedCount: rsvp.acceptedCount,
      sortOrder,
      people: {
        create: people.map((person) => ({
          name: person.name,
          sortOrder: person.sortOrder,
        })),
      },
    },
  });
  console.log(
    `+ created ${household.party} → ${rsvp.rsvpStatus} (${rsvp.acceptedCount}/${rsvp.invitedCount})`,
  );
  return "created";
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const csvPath = args.find((arg) => !arg.startsWith("--")) ?? DEFAULT_CSV;

  const csvText = readFileSync(csvPath, "utf8");
  const households = groupCsvRowsByHousehold(parseGuestRsvpCsv(csvText));
  const guests: DbGuest[] = await prisma.guest.findMany({
    select: {
      id: true,
      sortOrder: true,
      nameLine1: true,
      nameLine2: true,
      people: { select: { name: true }, orderBy: { sortOrder: "asc" } },
    },
    orderBy: { sortOrder: "asc" },
  });

  let created = 0;
  let updated = 0;
  let nextSort = guests.length;
  const remainingGuests = [...guests];

  for (const household of households) {
    const match = findBestGuestMatch(household, remainingGuests);
    const guest = match
      ? remainingGuests.find((row) => row.id === match.id) ?? null
      : null;

    if (guest) {
      remainingGuests.splice(remainingGuests.indexOf(guest), 1);
    }

    const result = await upsertHousehold(household, guest, guest?.sortOrder ?? nextSort, dryRun);
    if (result === "updated") updated += 1;
    else {
      created += 1;
      nextSort += 1;
    }
  }

  console.log(
    `\nProcessed ${households.length} households from CSV. Updated ${updated}, created ${created}.`,
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
