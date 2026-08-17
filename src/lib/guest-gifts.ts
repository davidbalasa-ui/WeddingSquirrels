export type GuestPersonFields = {
  name: string;
  tableNumber?: number | null;
  tableSpot?: string | null;
};

export type GuestNameFields = {
  nameLine1: string;
  nameLine2: string | null;
  people?: GuestPersonFields[];
};

export type GuestAddressFields = {
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

export type GuestGiftFields = {
  description: string;
  thanked?: boolean;
};

export const RSVP_STATUSES = ["pending", "attending", "not_attending"] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

export type GuestRsvpFields = {
  nameLine2: string | null;
  rsvpStatus: string;
  invitedCount: number;
  acceptedCount: number;
  people?: GuestPersonFields[];
};

export function isRsvpStatus(value: string): value is RsvpStatus {
  return (RSVP_STATUSES as readonly string[]).includes(value);
}

export function parseRsvpStatus(value: string): RsvpStatus {
  return isRsvpStatus(value) ? value : "pending";
}

export function parseGuestCount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function namedPeopleCount(guest: Pick<GuestNameFields, "nameLine1" | "nameLine2" | "people">): number {
  const named = guestNameLines(guest);
  return named.length;
}

export function inferredInvitedCount(
  guest: Pick<GuestNameFields, "nameLine2" | "people"> & { nameLine1?: string },
): number {
  if (guest.people?.length) return guest.people.length;
  if (guest.nameLine2?.trim()) return 2;
  return guest.nameLine1?.trim() ? 1 : 1;
}

export function effectiveInvitedCount(
  guest: Pick<GuestRsvpFields, "nameLine2" | "invitedCount" | "people"> & { nameLine1?: string },
): number {
  if (guest.invitedCount > 0) return guest.invitedCount;
  return inferredInvitedCount(guest);
}

export function effectiveAcceptedCount(guest: GuestRsvpFields & { nameLine1?: string }): number {
  const status = parseRsvpStatus(guest.rsvpStatus);
  if (status === "not_attending") return 0;
  const invited = effectiveInvitedCount(guest);
  return Math.min(Math.max(0, guest.acceptedCount), invited);
}

export function applyRsvpChange(
  guest: GuestRsvpFields & { nameLine1?: string },
  patch: Partial<Pick<GuestRsvpFields, "rsvpStatus" | "invitedCount" | "acceptedCount">>,
): { rsvpStatus: RsvpStatus; invitedCount: number; acceptedCount: number } {
  const rsvpStatus = parseRsvpStatus(patch.rsvpStatus ?? guest.rsvpStatus);
  let invitedCount =
    patch.invitedCount !== undefined ? Math.max(0, patch.invitedCount) : effectiveInvitedCount(guest);
  if (invitedCount === 0) invitedCount = inferredInvitedCount(guest);

  let acceptedCount =
    patch.acceptedCount !== undefined ? Math.max(0, patch.acceptedCount) : guest.acceptedCount;
  if (rsvpStatus === "not_attending") acceptedCount = 0;
  else if (rsvpStatus === "attending" && patch.rsvpStatus && guest.acceptedCount === 0) {
    acceptedCount = invitedCount;
  }
  acceptedCount = Math.min(acceptedCount, invitedCount);

  return { rsvpStatus, invitedCount, acceptedCount };
}

export type GuestRsvpReport = {
  households: number;
  attending: number;
  notAttending: number;
  pending: number;
  invited: number;
  accepted: number;
  awaiting: number;
};

export function summarizeGuestRsvp(guests: GuestRsvpFields[]): GuestRsvpReport {
  const report: GuestRsvpReport = {
    households: guests.length,
    attending: 0,
    notAttending: 0,
    pending: 0,
    invited: 0,
    accepted: 0,
    awaiting: 0,
  };
  for (const guest of guests) {
    const status = parseRsvpStatus(guest.rsvpStatus);
    if (status === "attending") report.attending += 1;
    else if (status === "not_attending") report.notAttending += 1;
    else report.pending += 1;
    report.invited += effectiveInvitedCount(guest);
    report.accepted += effectiveAcceptedCount(guest);
  }
  report.awaiting = Math.max(0, report.invited - report.accepted);
  return report;
}

export function guestNameLines(guest: GuestNameFields): string[] {
  const fromPeople = (guest.people ?? [])
    .map((person) => person.name.trim())
    .filter(Boolean);
  if (fromPeople.length > 0) return fromPeople;

  const lines = [guest.nameLine1.trim()];
  const second = guest.nameLine2?.trim();
  if (second) lines.push(second);
  return lines.filter(Boolean);
}

export function guestAddressLine(guest: GuestAddressFields): string {
  return guestAddressLines(guest).join(" · ");
}

export function guestAddressLines(guest: GuestAddressFields): string[] {
  const lines: string[] = [];
  const street = guest.street?.trim();
  if (street) lines.push(street);

  const city = guest.city?.trim() ?? "";
  const state = guest.state?.trim() ?? "";
  const zip = guest.zip?.trim() ?? "";
  const cityState = [city, state].filter(Boolean).join(", ");
  const locality = [cityState, zip].filter(Boolean).join(" ");
  if (locality) lines.push(locality);

  return lines;
}

export function guestSeatingSummary(guest: {
  people: Array<GuestPersonFields & { name: string }>;
}): string {
  const parts = guest.people
    .map((person) => {
      if (person.tableNumber == null) return null;
      const spot = person.tableSpot?.trim();
      return `${person.name.trim()}: T${person.tableNumber}${spot ? ` · ${spot}` : ""}`;
    })
    .filter(Boolean);
  return parts.join(" · ");
}

export function rsvpStatusLabel(status: string): string {
  const parsed = parseRsvpStatus(status);
  if (parsed === "attending") return "Attending";
  if (parsed === "not_attending") return "Not attending";
  return "No reply";
}

export function giftDescriptions(gifts: GuestGiftFields[]): string[] {
  return gifts.map((gift) => gift.description.trim()).filter(Boolean);
}

export type GiftPrintRow = {
  id: string;
  nameLines: string[];
  addressLines: string[];
  gifts: string[];
};

export function giftPrintRows(
  guests: Array<
    GuestNameFields &
      GuestAddressFields & {
        id: string;
        gifts: GuestGiftFields[];
      }
  >,
): GiftPrintRow[] {
  return guests.map((guest) => ({
    id: guest.id,
    nameLines: guestNameLines(guest),
    addressLines: guestAddressLines(guest),
    gifts: giftDescriptions(guest.gifts),
  }));
}

export function syncLegacyGuestNames(people: GuestPersonFields[]): {
  nameLine1: string;
  nameLine2: string | null;
  person1TableNumber: number | null;
  person1TableSpot: string | null;
  person2TableNumber: number | null;
  person2TableSpot: string | null;
} {
  const first = people[0];
  const second = people[1];
  return {
    nameLine1: first?.name.trim() ?? "",
    nameLine2: second?.name.trim() || null,
    person1TableNumber: first?.tableNumber ?? null,
    person1TableSpot: first?.tableSpot?.trim() || null,
    person2TableNumber: second?.tableNumber ?? null,
    person2TableSpot: second?.tableSpot?.trim() || null,
  };
}
