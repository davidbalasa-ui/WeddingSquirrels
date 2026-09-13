/** Canonical wedding place fields on AppSettings (not GPS). */

export type WeddingPlaceFields = {
  venueName?: string | null;
  venueStreet?: string | null;
  venueCity?: string | null;
  venueState?: string | null;
  venueZip?: string | null;
  rehearsalDinnerName?: string | null;
  rehearsalDinnerStreet?: string | null;
  rehearsalDinnerCity?: string | null;
  rehearsalDinnerState?: string | null;
  rehearsalDinnerZip?: string | null;
  airbnbName?: string | null;
  airbnbStreet?: string | null;
  airbnbCity?: string | null;
  airbnbState?: string | null;
  airbnbZip?: string | null;
};

export function placeAddressLines(input: {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}): string[] {
  const street = input.street?.trim();
  const city = input.city?.trim();
  const state = input.state?.trim();
  const zip = input.zip?.trim();
  const cityLine = [city, state].filter(Boolean).join(", ");
  const cityZip = [cityLine, zip].filter(Boolean).join(" ");
  if (street && cityZip) return [street, cityZip];
  if (street) return [street];
  if (cityZip) return [cityZip];
  return [];
}

export function formatPlaceLabel(
  name: string | null | undefined,
  addressLines: string[],
): string | null {
  const label = name?.trim();
  if (label && addressLines.length) return `${label} · ${addressLines.join(", ")}`;
  if (label) return label;
  if (addressLines.length) return addressLines.join(", ");
  return null;
}

export function todayVenueLabel(settings: WeddingPlaceFields | null | undefined): string | null {
  if (!settings) return null;
  const lines = placeAddressLines({
    street: settings.venueStreet,
    city: settings.venueCity,
    state: settings.venueState,
    zip: settings.venueZip,
  });
  return formatPlaceLabel(settings.venueName, lines);
}

export function quickReferencePlaces(settings: WeddingPlaceFields | null | undefined) {
  const venueAddress = placeAddressLines({
    street: settings?.venueStreet,
    city: settings?.venueCity,
    state: settings?.venueState,
    zip: settings?.venueZip,
  });
  const rehearsalAddress = placeAddressLines({
    street: settings?.rehearsalDinnerStreet,
    city: settings?.rehearsalDinnerCity,
    state: settings?.rehearsalDinnerState,
    zip: settings?.rehearsalDinnerZip,
  });
  const airbnbAddress = placeAddressLines({
    street: settings?.airbnbStreet,
    city: settings?.airbnbCity,
    state: settings?.airbnbState,
    zip: settings?.airbnbZip,
  });
  return {
    venueName: settings?.venueName?.trim() || null,
    venueAddress,
    rehearsalDinnerName: settings?.rehearsalDinnerName?.trim() || null,
    rehearsalDinnerAddress: rehearsalAddress,
    airbnbName: settings?.airbnbName?.trim() || null,
    airbnbAddress,
  };
}
