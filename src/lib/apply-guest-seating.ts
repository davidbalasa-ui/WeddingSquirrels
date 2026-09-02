import type { Prisma } from "@prisma/client";
import { syncLegacyGuestNames } from "@/lib/guest-gifts";
import {
  GUEST_SEATING_CHART,
  normalizeSeatingName,
  seatForPersonName,
  tableSpotForSeat,
} from "@/lib/guest-seating-chart";

export type GuestSeatingApplyResult = {
  updated: number;
  cleared: number;
  created: number;
};

type DbClient = Prisma.TransactionClient | {
  guest: Prisma.GuestDelegate;
  guestPerson: Prisma.GuestPersonDelegate;
};

function namesMatch(left: string, right: string) {
  return normalizeSeatingName(left) === normalizeSeatingName(right);
}

export async function applyGuestSeating(client: DbClient): Promise<GuestSeatingApplyResult> {
  const guests = await client.guest.findMany({
    include: { people: { orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });

  const matchedKeys = new Set<string>();
  let updated = 0;
  let cleared = 0;

  for (const guest of guests) {
    if (guest.people.length === 0) continue;

    let changed = false;
    for (const person of guest.people) {
      const seat = seatForPersonName(person.name);
      if (seat) {
        matchedKeys.add(normalizeSeatingName(seat.name));
        const tableSpot = tableSpotForSeat(seat);
        if (person.tableNumber !== seat.tableNumber || person.tableSpot !== tableSpot) {
          await client.guestPerson.update({
            where: { id: person.id },
            data: { tableNumber: seat.tableNumber, tableSpot },
          });
          updated += 1;
          changed = true;
        }
      } else if (person.tableNumber != null || person.tableSpot) {
        await client.guestPerson.update({
          where: { id: person.id },
          data: { tableNumber: null, tableSpot: null },
        });
        cleared += 1;
        changed = true;
      }
    }

    if (changed) {
      const people = await client.guestPerson.findMany({
        where: { guestId: guest.id },
        orderBy: { sortOrder: "asc" },
      });
      await client.guest.update({
        where: { id: guest.id },
        data: syncLegacyGuestNames(people),
      });
    }
  }

  const existingNames = guests.flatMap((guest) => guest.people.map((person) => person.name));
  const missing = GUEST_SEATING_CHART.filter((seat) => {
    if (seat.skipCreate) return false;
    if (matchedKeys.has(normalizeSeatingName(seat.name))) return false;
    return !existingNames.some(
      (name) =>
        namesMatch(name, seat.name) || (seat.aliases ?? []).some((alias) => namesMatch(name, alias)),
    );
  });

  let created = 0;
  // Prefer attaching missing people onto an existing household that already has
  // someone at the same table. Only create a new household when no host exists.
  for (const seat of missing) {
    const host = guests.find((guest) =>
      guest.people.some((person) => person.tableNumber === seat.tableNumber),
    );
    if (!host) continue;

    const maxSort = host.people.reduce((max, person) => Math.max(max, person.sortOrder), -1);
    await client.guestPerson.create({
      data: {
        guestId: host.id,
        name: seat.name,
        tableNumber: seat.tableNumber,
        tableSpot: tableSpotForSeat(seat),
        sortOrder: maxSort + 1,
      },
    });
    const people = await client.guestPerson.findMany({
      where: { guestId: host.id },
      orderBy: { sortOrder: "asc" },
    });
    await client.guest.update({
      where: { id: host.id },
      data: syncLegacyGuestNames(people),
    });
    host.people = people;
    created += 1;
    matchedKeys.add(normalizeSeatingName(seat.name));
  }

  const stillMissing = missing.filter((seat) => !matchedKeys.has(normalizeSeatingName(seat.name)));
  if (stillMissing.length) {
    const maxSort = guests.reduce((max, guest) => Math.max(max, guest.sortOrder), 0);
    const byHousehold = new Map<number, typeof stillMissing>();
    for (const seat of stillMissing) {
      const bucket = byHousehold.get(seat.tableNumber) ?? [];
      bucket.push(seat);
      byHousehold.set(seat.tableNumber, bucket);
    }

    let offset = 1;
    for (const seats of byHousehold.values()) {
      const people = seats.map((seat, index) => ({
        name: seat.name,
        tableNumber: seat.tableNumber,
        tableSpot: tableSpotForSeat(seat),
        sortOrder: index,
      }));
      const legacy = syncLegacyGuestNames(people);
      await client.guest.create({
        data: {
          ...legacy,
          sortOrder: maxSort + offset,
          people: { create: people },
        },
      });
      created += people.length;
      offset += 1;
    }
  }

  return { updated, cleared, created };
}
