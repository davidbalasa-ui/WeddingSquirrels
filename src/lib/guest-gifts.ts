export type GuestNameFields = {
  nameLine1: string;
  nameLine2: string | null;
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

export function guestNameLines(guest: GuestNameFields): string[] {
  const lines = [guest.nameLine1.trim()];
  const second = guest.nameLine2?.trim();
  if (second) lines.push(second);
  return lines.filter(Boolean);
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
