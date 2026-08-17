import type { Guest, GuestGift, GuestPerson } from "@prisma/client";

export type GuestGiftRecord = {
  id: string;
  description: string;
  thanked: boolean;
};

export type GuestPersonRecord = {
  id: string;
  name: string;
  tableNumber: number | null;
  tableSpot: string | null;
};

export type GuestRecord = {
  id: string;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  people: GuestPersonRecord[];
  rsvpStatus: string;
  invitedCount: number;
  acceptedCount: number;
  gifts: GuestGiftRecord[];
};

type GuestWithRelations = Guest & {
  people: GuestPerson[];
  gifts: GuestGift[];
};

export function synthesizeGuestPeople(guest: Guest): GuestPersonRecord[] {
  const people: GuestPersonRecord[] = [];
  if (guest.nameLine1.trim()) {
    people.push({
      id: `${guest.id}-p1`,
      name: guest.nameLine1.trim(),
      tableNumber: guest.person1TableNumber,
      tableSpot: guest.person1TableSpot,
    });
  }
  if (guest.nameLine2?.trim()) {
    people.push({
      id: `${guest.id}-p2`,
      name: guest.nameLine2.trim(),
      tableNumber: guest.person2TableNumber,
      tableSpot: guest.person2TableSpot,
    });
  }
  return people;
}

export function mapGuestRecord(guest: GuestWithRelations): GuestRecord {
  const people =
    guest.people.length > 0
      ? guest.people.map((person) => ({
          id: person.id,
          name: person.name,
          tableNumber: person.tableNumber,
          tableSpot: person.tableSpot,
        }))
      : synthesizeGuestPeople(guest);

  return {
    id: guest.id,
    street: guest.street,
    city: guest.city,
    state: guest.state,
    zip: guest.zip,
    people,
    rsvpStatus: guest.rsvpStatus,
    invitedCount: guest.invitedCount,
    acceptedCount: guest.acceptedCount,
    gifts: guest.gifts.map((gift) => ({
      id: gift.id,
      description: gift.description,
      thanked: gift.thanked,
    })),
  };
}

export function mapGuestRsvpFields(guest: GuestWithRelations) {
  const record = mapGuestRecord(guest);
  return {
    nameLine1: record.people[0]?.name ?? guest.nameLine1,
    nameLine2: record.people[1]?.name ?? guest.nameLine2,
    people: record.people,
    rsvpStatus: record.rsvpStatus,
    invitedCount: record.invitedCount,
    acceptedCount: record.acceptedCount,
  };
}

export function guestInclude() {
  return {
    people: { orderBy: { sortOrder: "asc" as const } },
    gifts: { orderBy: { sortOrder: "asc" as const } },
  };
}
