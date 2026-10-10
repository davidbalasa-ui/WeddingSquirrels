/** The old wedding place columns on AppSettings. Nothing reads them now: the places come from the plan (weddingPlacesFromPlan). */

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

export type WeddingPlace = { name: string; address: string[] };

export type WeddingPlaces = {
  venue: WeddingPlace;
  rehearsalDinner: WeddingPlace;
  lodging: WeddingPlace;
};

/**
 * The three places as David's own planning documents give them (the rehearsal check-in,
 * dinner and walkthrough lines). A line on his Wedding Day or Thursday page that carries
 * the street address wins, so an address he corrects on the page is the one every
 * screen and printout uses.
 */
const FROM_HIS_DOCUMENTS: WeddingPlaces = {
  venue: { name: "Black Sheep Shelter", address: ["342 62nd St", "South Haven, MI 49090"] },
  rehearsalDinner: { name: "Hawkshead", address: ["523 Hawks Nest Dr", "South Haven, MI"] },
  lodging: { name: "Airbnb", address: ["10268 51st St", "Grand Junction, MI 49056"] },
};

const STREETS: Record<keyof WeddingPlaces, RegExp> = {
  venue: /\b342\s+62nd\b/i,
  rehearsalDinner: /\b523\s+Hawks\b/i,
  lodging: /\b10268\s+51st\b/i,
};

/** "Venue: 342 62nd St, South Haven, MI 49090" → ["342 62nd St", "South Haven, MI 49090"]. */
function addressFromLine(line: string, street: RegExp): string[] {
  const from = line.slice(line.search(street)).trim().replace(/[.;]$/, "");
  const parts = from.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 3) return [parts[0]!, `${parts[1]}, ${parts[2]}`];
  return [from];
}

/** The venue, rehearsal dinner and lodging, read from the moments the app already holds. */
export function weddingPlacesFromPlan(blocks: Array<{ notes: string }>): WeddingPlaces {
  const lines = blocks.flatMap((block) => block.notes.split("\n"));
  const read = (key: keyof WeddingPlaces): WeddingPlace => {
    const line = lines.find((text) => STREETS[key].test(text));
    return line ? { ...FROM_HIS_DOCUMENTS[key], address: addressFromLine(line, STREETS[key]) } : FROM_HIS_DOCUMENTS[key];
  };
  return { venue: read("venue"), rehearsalDinner: read("rehearsalDinner"), lodging: read("lodging") };
}

/** "Black Sheep Shelter · 342 62nd St, South Haven, MI 49090" for the Today header. */
export function weddingVenueLabel(places: WeddingPlaces): string | null {
  return formatPlaceLabel(places.venue.name, places.venue.address);
}
