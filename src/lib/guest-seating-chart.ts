/** Black Sheep Shelter seating from the floor-plan + layout PDF. */

export const TABLE_SEATING_LABELS: Record<number, string> = {
  0: "Head",
  1: "South 1",
  2: "South 2",
  3: "South 3",
  4: "South 4",
  5: "South 5",
  6: "North 1",
  7: "North 2",
  8: "North 3",
  9: "North 4",
  10: "North 5",
};

export type SeatingAssignment = {
  name: string;
  aliases?: string[];
  tableNumber: number;
  note?: string;
  /** Do not create a guest household if this person is missing (couple at head table). */
  skipCreate?: boolean;
};

export const GUEST_SEATING_CHART: SeatingAssignment[] = [
  { name: "Haley Wiewiora", tableNumber: 0, note: "Head", skipCreate: true },
  { name: "David Balasa", tableNumber: 0, note: "Head", skipCreate: true },

  { name: "Elijah Balasa", aliases: ["Elisha Balasa"], tableNumber: 1, note: "child" },
  { name: "Benjamin Balasa", tableNumber: 1 },
  { name: "Isaac Balasa", tableNumber: 1, note: "child · Celiac" },
  { name: "Liliana Balasa", tableNumber: 1, note: "child" },
  { name: "Hannah Balasa", tableNumber: 1 },
  { name: "Meira Balasa", tableNumber: 1, note: "child · Celiac" },

  { name: "Jeremy Hammond", tableNumber: 2 },
  { name: "Bryan Balasa", tableNumber: 2 },
  { name: "Jennifer Hammond", tableNumber: 2, note: "child" },
  { name: "Elizabeth Hammond", tableNumber: 2 },
  { name: "Pamela Balasa", tableNumber: 2 },
  { name: "Esther Hammond", tableNumber: 2, note: "child" },

  { name: "Melody Balasa", tableNumber: 3, note: "child" },
  { name: "Rowan Wiewiora", tableNumber: 3, note: "child" },
  { name: "Ken Brown", tableNumber: 3 },
  { name: "Harmony Balasa", tableNumber: 3, note: "child" },
  { name: "Juniper Wiewiora", tableNumber: 3, note: "child" },
  { name: "Grace Brown", tableNumber: 3 },

  { name: "Marie +1", aliases: ["Marie Wiewiora +1"], tableNumber: 4 },
  { name: "Evan Wiewiora", tableNumber: 4 },
  { name: "Tracy Gomez", tableNumber: 4 },
  { name: "Marie Wiewiora", tableNumber: 4 },
  { name: "Katie Wiewiora", tableNumber: 4 },
  { name: "Scarlett Wiewiora", tableNumber: 4, note: "child" },
  { name: "Arianna Devros", tableNumber: 4 },
  { name: "Jay McMann", tableNumber: 4 },

  { name: "David Berman", tableNumber: 5 },
  { name: "Leslie Berman", tableNumber: 5 },
  { name: "Kurt Huizenga", tableNumber: 5 },
  { name: "Susan Berman", tableNumber: 5 },
  { name: "Cynthia Berman", tableNumber: 5 },
  { name: "Shelly Wiewiora", tableNumber: 5 },
  { name: "John Wiewiora", tableNumber: 5 },
  { name: "Wendy Rush", tableNumber: 5 },

  { name: "Gusti Olaffson", aliases: ["Baby G"], tableNumber: 6, note: "child · Vegan/Celiac" },
  { name: "Finn Olaffson", aliases: ["Finn"], tableNumber: 6, note: "child · Vegan/Celiac" },
  { name: "Agust Olaffson", tableNumber: 6, note: "Vegan" },
  { name: "Siggi Olaffson", tableNumber: 6, note: "child · Vegan/Celiac" },
  { name: "Carrie Foura", tableNumber: 6, note: "Vegan/Celiac" },
  { name: "Steve Crossbow", tableNumber: 6 },

  { name: "Clare Crossbow", aliases: ["Claire Crossbow"], tableNumber: 7 },
  { name: "Adam Crossbow", tableNumber: 7 },
  { name: "Ethan Crossbow", tableNumber: 7 },
  { name: "Joe Crossbow", tableNumber: 7 },
  { name: "Mike Crossbow", tableNumber: 7 },
  { name: "Carly Crossbow", tableNumber: 7 },

  { name: "Belle +1", aliases: ["Belle Genton +1"], tableNumber: 8 },
  { name: "Belle Genton", tableNumber: 8 },
  { name: "Katie Kippe", tableNumber: 8 },
  { name: "Morgan +1", aliases: ["Morgan Black +1"], tableNumber: 8 },
  { name: "Morgan Black", tableNumber: 8 },
  { name: "Josh Kippe", tableNumber: 8 },

  { name: "Kaylie Cartwright", tableNumber: 9 },
  { name: "Andi Cartwright", tableNumber: 9 },
  { name: "Victoria Owens", tableNumber: 9 },
  { name: "Skila Goins", tableNumber: 9 },
  { name: "Marie Fleener", tableNumber: 9 },
  { name: "Austin Fleener", tableNumber: 9 },
  { name: "Anthony Owens", tableNumber: 9 },
  { name: "Mykah Mckay", aliases: ["Mykah McKay"], tableNumber: 9 },

  { name: "Braxton Wasilewski", tableNumber: 10 },
  { name: "Evan Eling", tableNumber: 10 },
  { name: "Bri Eling", tableNumber: 10 },
  { name: "Braxton +1", aliases: ["Braxton Wasilewski +1"], tableNumber: 10 },
  { name: "Erica Pallas", tableNumber: 10 },
  { name: "Erica +1", aliases: ["Erica Pallas +1"], tableNumber: 10 },
  { name: "Trinity Medler", tableNumber: 10 },
  { name: "Jared Fleener", tableNumber: 10 },
];

export function normalizeSeatingName(name: string) {
  return name
    .toLowerCase()
    .replace(/\bms\b/g, "")
    .replace(/\(child\)/gi, "")
    .replace(/[^a-z0-9+\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tableSeatingLabel(tableNumber: number) {
  return TABLE_SEATING_LABELS[tableNumber] ?? `Table ${tableNumber}`;
}

export function tableSpotForSeat(seat: Pick<SeatingAssignment, "tableNumber" | "note">) {
  const label = tableSeatingLabel(seat.tableNumber);
  return seat.note ? `${label} · ${seat.note}` : label;
}

const SEAT_BY_NAME = new Map<string, SeatingAssignment>();
for (const seat of GUEST_SEATING_CHART) {
  SEAT_BY_NAME.set(normalizeSeatingName(seat.name), seat);
  for (const alias of seat.aliases ?? []) {
    SEAT_BY_NAME.set(normalizeSeatingName(alias), seat);
  }
}

export function seatForPersonName(name: string) {
  return SEAT_BY_NAME.get(normalizeSeatingName(name)) ?? null;
}
