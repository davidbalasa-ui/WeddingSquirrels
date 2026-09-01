import type { Prisma } from "@prisma/client";
import { syncLegacyGuestNames } from "@/lib/guest-gifts";
import {
  findBestGuestMatch,
  groupCsvRowsByHousehold,
  householdRsvpFromPeople,
  parseGuestRsvpCsv,
  resolveImportedRsvp,
  type CsvHousehold,
} from "@/lib/guest-rsvp-import";

export type GuestRsvpImportResult = {
  processed: number;
  updated: number;
  created: number;
};

type DbGuest = {
  id: string;
  sortOrder: number;
  nameLine1: string;
  nameLine2: string | null;
  rsvpStatus: string;
  acceptedCount: number;
  people: Array<{ name: string }>;
};

type DbClient = Prisma.TransactionClient | {
  guest: Prisma.GuestDelegate;
  guestPerson: Prisma.GuestPersonDelegate;
  $transaction?: Prisma.DefaultPrismaClient["$transaction"];
};

async function upsertHousehold(
  client: DbClient,
  household: CsvHousehold,
  guest: DbGuest | null,
  sortOrder: number,
): Promise<"created" | "updated"> {
  const people = household.people.map((person, index) => ({
    name: person.displayName,
    sortOrder: index,
  }));
  const rsvp = resolveImportedRsvp(
    householdRsvpFromPeople(household.people),
    guest
      ? { rsvpStatus: guest.rsvpStatus, acceptedCount: guest.acceptedCount }
      : null,
  );
  const legacy = syncLegacyGuestNames(people);

  if (guest) {
    await client.guest.update({
      where: { id: guest.id },
      data: {
        ...legacy,
        rsvpStatus: rsvp.rsvpStatus,
        invitedCount: rsvp.invitedCount,
        acceptedCount: rsvp.acceptedCount,
      },
    });

    const existingPeople = await client.guestPerson.findMany({
      where: { guestId: guest.id },
      orderBy: { sortOrder: "asc" },
    });

    if (existingPeople.length === 0) {
      await client.guestPerson.createMany({
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
          await client.guestPerson.update({
            where: { id: existing.id },
            data: { name: nextName },
          });
        }
      }
    }

    return "updated";
  }

  await client.guest.create({
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
  return "created";
}

export async function applyGuestRsvpImport(
  client: DbClient,
  csvText: string,
): Promise<GuestRsvpImportResult> {
  const households = groupCsvRowsByHousehold(parseGuestRsvpCsv(csvText));
  const guests: DbGuest[] = await client.guest.findMany({
    select: {
      id: true,
      sortOrder: true,
      nameLine1: true,
      nameLine2: true,
      rsvpStatus: true,
      acceptedCount: true,
      people: { select: { name: true }, orderBy: { sortOrder: "asc" } },
    },
    orderBy: { sortOrder: "asc" },
  });

  let updated = 0;
  let created = 0;
  let nextSort = guests.length;
  const remainingGuests = [...guests];

  for (const household of households) {
    const match = findBestGuestMatch(household, remainingGuests);
    const guest = match ? remainingGuests.find((row) => row.id === match.id) ?? null : null;

    if (guest) {
      remainingGuests.splice(remainingGuests.indexOf(guest), 1);
    }

    const result = await upsertHousehold(
      client,
      household,
      guest,
      guest?.sortOrder ?? nextSort,
    );
    if (result === "updated") updated += 1;
    else {
      created += 1;
      nextSort += 1;
    }
  }

  return { processed: households.length, updated, created };
}
