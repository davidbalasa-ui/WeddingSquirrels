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
import { namesMatch, normalizePersonName } from "@/lib/people-directory";

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
  people: Array<{ id: string; name: string; sortOrder: number }>;
};

type DbClient = Prisma.TransactionClient | {
  guest: Prisma.GuestDelegate;
  guestPerson: Prisma.GuestPersonDelegate;
  $transaction?: Prisma.DefaultPrismaClient["$transaction"];
};

/** Prefer full-name person overlap over loose token scores. */
function findGuestBySharedPeople(household: CsvHousehold, guests: DbGuest[]): DbGuest | null {
  let best: { guest: DbGuest; hits: number } | null = null;
  for (const guest of guests) {
    let hits = 0;
    for (const csvPerson of household.people) {
      const display = csvPerson.displayName.trim();
      if (!display) continue;
      if (guest.people.some((person) => namesMatch(person.name, display))) hits += 1;
      else if (
        namesMatch(guest.nameLine1, display) ||
        (guest.nameLine2 && namesMatch(guest.nameLine2, display))
      ) {
        hits += 1;
      }
    }
    if (hits === 0) continue;
    if (!best || hits > best.hits) best = { guest, hits };
  }
  return best && best.hits >= 1 ? best.guest : null;
}

async function upsertHousehold(
  client: DbClient,
  household: CsvHousehold,
  guest: DbGuest | null,
  sortOrder: number,
): Promise<"created" | "updated"> {
  const people = household.people.map((person, index) => ({
    name: person.displayName,
    sortOrder: index,
    rsvp: person.rsvp,
  }));
  const rsvp = resolveImportedRsvp(
    householdRsvpFromPeople(household.people),
    guest
      ? { rsvpStatus: guest.rsvpStatus, acceptedCount: guest.acceptedCount }
      : null,
  );

  if (guest) {
    // Never clear address/phone/gifts — CSV has none of those.
    // Only update RSVP summary + union people by name (add missing; never delete).
    const existingPeople = await client.guestPerson.findMany({
      where: { guestId: guest.id },
      orderBy: { sortOrder: "asc" },
    });

    let nextSort = existingPeople.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
    for (const csvPerson of people) {
      const existing = existingPeople.find((row) => namesMatch(row.name, csvPerson.name));
      if (existing) {
        // Keep existing name spelling; fill pending RSVP from CSV person when useful.
        if (existing.rsvpStatus === "pending" && csvPerson.rsvp !== "pending") {
          await client.guestPerson.update({
            where: { id: existing.id },
            data: { rsvpStatus: csvPerson.rsvp },
          });
        }
        continue;
      }
      await client.guestPerson.create({
        data: {
          guestId: guest.id,
          name: csvPerson.name,
          rsvpStatus: csvPerson.rsvp,
          sortOrder: nextSort,
        },
      });
      nextSort += 1;
    }

    const refreshed = await client.guestPerson.findMany({
      where: { guestId: guest.id },
      orderBy: { sortOrder: "asc" },
    });
    const legacy = syncLegacyGuestNames(refreshed);
    await client.guest.update({
      where: { id: guest.id },
      data: {
        ...legacy,
        rsvpStatus: rsvp.rsvpStatus,
        invitedCount: Math.max(rsvp.invitedCount, refreshed.length),
        acceptedCount: rsvp.acceptedCount,
      },
    });

    return "updated";
  }

  const legacy = syncLegacyGuestNames(people);
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
          rsvpStatus: person.rsvp,
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
      people: { select: { id: true, name: true, sortOrder: true }, orderBy: { sortOrder: "asc" } },
    },
    orderBy: { sortOrder: "asc" },
  });

  let updated = 0;
  let created = 0;
  let nextSort =
    guests.reduce((max, guest) => Math.max(max, guest.sortOrder), -1) + 1;
  const remainingGuests = [...guests];

  for (const household of households) {
    const byPeople = findGuestBySharedPeople(household, remainingGuests);
    const byScore = findBestGuestMatch(household, remainingGuests);
    let guest =
      byPeople ?? (byScore ? remainingGuests.find((row) => row.id === byScore.id) ?? null : null);

    if (!guest) {
      // Fall back to any existing household (even already matched) that shares people,
      // so we union kids onto Benjamin+Hannah instead of creating a duplicate.
      const allGuests = await client.guest.findMany({
        select: {
          id: true,
          sortOrder: true,
          nameLine1: true,
          nameLine2: true,
          rsvpStatus: true,
          acceptedCount: true,
          people: { select: { id: true, name: true, sortOrder: true }, orderBy: { sortOrder: "asc" } },
        },
      });
      guest = findGuestBySharedPeople(household, allGuests);
    }

    if (guest) {
      const idx = remainingGuests.findIndex((row) => row.id === guest!.id);
      if (idx >= 0) remainingGuests.splice(idx, 1);
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

export function normalizeImportPersonKey(name: string) {
  return normalizePersonName(name);
}
