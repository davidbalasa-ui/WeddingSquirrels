/**
 * Canonical day-of playbook records.
 *
 * These are NOT a second timeline. Hair/makeup, shot list, decor, ceremony
 * lineup, and Avalon scope live here so operational pages can project one
 * source of truth. MC spoken/music cues stay on TimelineBlock notes.
 */

export const PLAYBOOK_KINDS = [
  "hair_makeup",
  "shot",
  "decor",
  "lineup",
  "coordinator",
] as const;

export type PlaybookKind = (typeof PLAYBOOK_KINDS)[number];

export type PlaybookRecord = {
  sourceKey: string;
  kind: PlaybookKind;
  section: string;
  startAt: string | null;
  title: string;
  detail: string | null;
  location: string | null;
  notes: string | null;
  sortOrder: number;
  completed: boolean;
};

export type PlaybookItemView = PlaybookRecord & {
  id?: string;
};

function item(
  kind: PlaybookKind,
  section: string,
  sortOrder: number,
  title: string,
  extras: Partial<Omit<PlaybookRecord, "kind" | "section" | "sortOrder" | "title" | "completed" | "sourceKey">> & {
    key: string;
  },
): PlaybookRecord {
  return {
    sourceKey: extras.key,
    kind,
    section,
    startAt: extras.startAt ?? null,
    title,
    detail: extras.detail ?? null,
    location: extras.location ?? null,
    notes: extras.notes ?? null,
    sortOrder,
    completed: false,
  };
}

const HAIR_MAKEUP: PlaybookRecord[] = [
  item("hair_makeup", "Rooms", 0, "Bedroom 1", {
    key: "hm-room-bed1",
    detail: "Makeup, up to 2 people",
    location: "Triple-stack beds with additional bed",
  }),
  item("hair_makeup", "Rooms", 1, "Bedroom 2", {
    key: "hm-room-bed2",
    detail: "Haley's get-ready room",
    location: "Single bed, wood panel room",
  }),
  item("hair_makeup", "Rooms", 2, "Bedroom 3", {
    key: "hm-room-bed3",
    detail: "Makeup, up to 2 people",
    location: "Bunk beds with dresser",
  }),
  item("hair_makeup", "Rooms", 3, "Bathroom 1", {
    key: "hm-room-bath1",
    detail: "Hair, 1 station",
    location: "Black countertop and cabinet",
  }),
  item("hair_makeup", "Rooms", 4, "Bathroom 2", {
    key: "hm-room-bath2",
    detail: "Hair, 1 station",
    location: "Second bathroom",
  }),
  item("hair_makeup", "Rooms", 5, "Bathroom 3", {
    key: "hm-room-bath3",
    detail: "Hair, 1 station",
    location: "Glass-door shower",
  }),
  item("hair_makeup", "Rooms", 6, "Living room", {
    key: "hm-room-living",
    detail: "Overflow hair/makeup if needed",
    notes: "Mirrors and better lighting.",
  }),
  item("hair_makeup", "9:00 AM", 10, "Hair & makeup starts at the Airbnb", {
    key: "hm-0900-start",
    startAt: "9:00 AM",
    location: "Airbnb",
    notes: "Steam dresses. Lay out shoes, jewelry, and accessories.",
  }),
  item("hair_makeup", "9:00 AM", 11, "Braxton — hair", {
    key: "hm-0900-braxton",
    startAt: "9:00 AM",
    location: "Bathroom 1",
    detail: "Hair",
  }),
  item("hair_makeup", "9:00 AM", 12, "Andi — hair", {
    key: "hm-0900-andi",
    startAt: "9:00 AM",
    location: "Bathroom 2",
    detail: "Hair",
  }),
  item("hair_makeup", "9:00 AM", 13, "Kaylie — hair", {
    key: "hm-0900-kaylie",
    startAt: "9:00 AM",
    location: "Bathroom 3",
    detail: "Hair",
  }),
  item("hair_makeup", "9:00 AM", 14, "Bri and Trinity — makeup", {
    key: "hm-0900-bri-trinity",
    startAt: "9:00 AM",
    location: "Bedroom 1",
    detail: "Makeup",
  }),
  item("hair_makeup", "9:00 AM", 15, "Victoria and Skila — makeup", {
    key: "hm-0900-victoria-skila",
    startAt: "9:00 AM",
    location: "Bedroom 3",
    detail: "Makeup",
  }),
  item("hair_makeup", "9:30 AM", 20, "Haley — makeup", {
    key: "hm-0930-haley",
    startAt: "9:30 AM",
    location: "Bedroom 2",
    detail: "Makeup",
    notes: "Katie does Haley's hair later at 11:00. This is Haley's makeup block.",
  }),
  item("hair_makeup", "10:00 AM", 30, "Bri — hair", {
    key: "hm-1000-bri",
    startAt: "10:00 AM",
    location: "Bathroom 1",
    detail: "Hair",
  }),
  item("hair_makeup", "10:00 AM", 31, "Trinity — hair", {
    key: "hm-1000-trinity",
    startAt: "10:00 AM",
    location: "Bathroom 2",
    detail: "Hair",
  }),
  item("hair_makeup", "10:00 AM", 32, "Skila — hair", {
    key: "hm-1000-skila",
    startAt: "10:00 AM",
    location: "Bathroom 3",
    detail: "Hair",
  }),
  item("hair_makeup", "10:00 AM", 33, "Braxton and Andi — makeup", {
    key: "hm-1000-braxton-andi",
    startAt: "10:00 AM",
    location: "Bedroom 3",
    detail: "Makeup",
  }),
  item("hair_makeup", "10:00 AM", 34, "Kaylie — makeup", {
    key: "hm-1000-kaylie",
    startAt: "10:00 AM",
    location: "Bedroom 1",
    detail: "Makeup",
  }),
  item("hair_makeup", "10:30 AM", 40, "Katie and Belle arrive", {
    key: "hm-1030-katie-belle",
    startAt: "10:30 AM",
    location: "Airbnb",
    detail: "Katie (hair) · Belle (video)",
    notes: "Katie is confirmed for Haley's hair. Do not treat this as DIY.",
  }),
  item("hair_makeup", "10:30 AM", 41, "Haley makeup done — break", {
    key: "hm-1030-haley-break",
    startAt: "10:30 AM",
    location: "Airbnb",
    notes: "Eat, drink water, bathroom break before hair.",
  }),
  item("hair_makeup", "11:00 AM", 50, "Haley starts hair with Katie", {
    key: "hm-1100-haley-hair",
    startAt: "11:00 AM",
    location: "Airbnb",
    detail: "Hair",
    notes: "Everyone else wraps up, does final touches, and starts to clean.",
  }),
  item("hair_makeup", "11:30 AM", 60, "Airbnb packed and cleaned", {
    key: "hm-1130-pack",
    startAt: "11:30 AM",
    location: "Airbnb",
    notes: "Wedding and personal items packed.",
  }),
  item("hair_makeup", "11:45 AM", 70, "Eat, pack cars, leave window", {
    key: "hm-1145-leave-window",
    startAt: "11:45 AM",
    location: "Airbnb",
  }),
  item("hair_makeup", "12:00 PM", 80, "Bridal party leaves the Airbnb", {
    key: "hm-1200-party-leaves",
    startAt: "12:00 PM",
    notes: "Haley, David, and Belle stay behind.",
  }),
  item("hair_makeup", "12:15 PM", 90, "Bridal party arrives at Black Sheep Shelter", {
    key: "hm-1215-bss",
    startAt: "12:15 PM",
    location: "Black Sheep Shelter",
    notes: "Pull dresses from bags (steam if needed). Hair and makeup touch-ups if needed.",
  }),
  item("hair_makeup", "12:30 PM", 100, "Photographer arrives · Haley, David, and Belle leave Airbnb", {
    key: "hm-1230-photo-leave",
    startAt: "12:30 PM",
    notes: "Bridal party brings Haley's dress, shoes, accessories, and the detail box.",
  }),
  item("hair_makeup", "12:45 PM", 110, "Haley retouch + get-ready photos", {
    key: "hm-1245-retouch",
    startAt: "12:45 PM",
    location: "Black Sheep Shelter",
    notes: "Get-ready robes: Harmony and Melody still TBD.",
  }),
];

const PARTY_WITH_BRIDE = [
  "Skila",
  "Trinity",
  "Victoria",
  "Bri",
  "Kaylie",
  "Braxton",
  "Andi",
] as const;
const PARTY_WITH_GROOM = [
  "Skila",
  "Trinity",
  "Victoria",
  "Bri",
  "Kaylie",
  "Evan",
  "Braxton",
] as const;

const SHOTS: PlaybookRecord[] = [
  item("shot", "Details", 0, "Invitations", { key: "shot-details-invitations" }),
  item("shot", "Details", 1, "Jewelry", { key: "shot-details-jewelry" }),
  item("shot", "Details", 2, "Suit accessories", { key: "shot-details-suit" }),
  item("shot", "Details", 3, "Shoes", { key: "shot-details-shoes" }),
  item("shot", "Details", 4, "Flowers / sword", {
    key: "shot-details-flowers",
    notes: "No florist. Haley uses a sword decorated with faux flowers instead of a traditional bouquet.",
  }),
  item("shot", "Details", 5, "Veil", { key: "shot-details-veil" }),
  item("shot", "Details", 6, "Hanging dresses", { key: "shot-details-dresses" }),
  item("shot", "Portraits", 10, "Bride with veil", { key: "shot-portrait-veil" }),
  item("shot", "Portraits", 11, "Mom buttoning dress", { key: "shot-portrait-mom-button" }),
  item("shot", "Bridal party", 20, "Bride with wedding party", { key: "shot-party-bride-group" }),
  item("shot", "Bridal party", 21, "Groom with wedding party", { key: "shot-party-groom-group" }),
  ...PARTY_WITH_BRIDE.map((name, index) =>
    item("shot", "Bridal party", 30 + index, `Bride with ${name}`, {
      key: `shot-bride-${name.toLowerCase()}`,
    }),
  ),
  ...PARTY_WITH_GROOM.map((name, index) =>
    item("shot", "Bridal party", 40 + index, `Groom with ${name}`, {
      key: `shot-groom-${name.toLowerCase()}`,
    }),
  ),
  item("shot", "Family", 50, "Bride with parents", { key: "shot-fam-bride-parents" }),
  item("shot", "Family", 51, "Couple with parents", { key: "shot-fam-couple-parents" }),
  item("shot", "Family", 52, "Bride with mom", { key: "shot-fam-bride-mom" }),
  item("shot", "Family", 53, "Bride with dad", { key: "shot-fam-bride-dad" }),
  item("shot", "Family", 54, "Couple with mom", { key: "shot-fam-couple-mom" }),
  item("shot", "Family", 55, "Couple with dad", { key: "shot-fam-couple-dad" }),
  item("shot", "Family", 56, "Bride with Grandma", { key: "shot-fam-bride-grandma" }),
  item("shot", "Family", 57, "Bride with Grandpa", { key: "shot-fam-bride-grandpa" }),
  item("shot", "Family", 58, "Bride with grandparents", { key: "shot-fam-bride-grandparents" }),
  item("shot", "Family", 59, "Couple with grandparents", { key: "shot-fam-couple-grandparents" }),
  item("shot", "Family", 60, "Couple with bride's parental side of family", {
    key: "shot-fam-parental-side",
  }),
  item("shot", "Family", 61, "Couple with bride's maternal side of family", {
    key: "shot-fam-maternal-side",
  }),
];

const DECOR: PlaybookRecord[] = [
  item("decor", "Theme", 0, "Sunset dreams", {
    key: "decor-theme",
    notes: "Bridal party colors: dark blue, powder blue, purple, powder pink.",
  }),
  item("decor", "Tables", 10, "Tablecloths", { key: "decor-tablecloths" }),
  item("decor", "Tables", 11, "Table runners", { key: "decor-runners" }),
  item("decor", "Tables", 12, "Storm clouds", {
    key: "decor-clouds",
    detail: "David",
    notes: "DIY cotton-ball storm clouds with fairy lights. Keep lights solid during dinner. Button to turn off/on.",
  }),
  item("decor", "Tables", 13, "Table numbers and candles", {
    key: "decor-numbers-candles",
    notes: "Number in the middle with a candle.",
  }),
  item("decor", "Tables", 14, "Candy along the runners", { key: "decor-candy" }),
  item("decor", "Tables", 15, "Kids books and coloring basket", { key: "decor-kids" }),
  item("decor", "Welcome / gifts", 20, "Welcome table", {
    key: "decor-welcome",
    notes: "Rings and bubbles.",
  }),
  item("decor", "Welcome / gifts", 21, "Custom-card guest book", {
    key: "decor-guestbook",
    notes: "Two decks of custom cards.",
  }),
  item("decor", "Ceremony", 30, "Memorial table for Tyler", {
    key: "decor-tyler",
    location: "Near officiant, off to the right",
    notes: "Brother memorial during the ceremony.",
  }),
  item("decor", "Ceremony", 31, "Crescent moon ceremony backdrop", { key: "decor-moon" }),
  item("decor", "Ceremony", 32, "Lanterns instead of florist florals", {
    key: "decor-lanterns",
    notes: "No florist. Bridal party holds star lanterns after the ceremony.",
  }),
  item("decor", "Ceremony", 33, "Haley's sword bouquet", {
    key: "decor-sword",
    notes: "Sword decorated with faux flowers. Not a traditional bouquet.",
  }),
  item("decor", "Cake", 40, "Dagger for cake cutting", {
    key: "decor-dagger",
    notes: "Dagger in the cake; used for cake cutting.",
  }),
  item("decor", "Games", 50, "Yard games", {
    key: "decor-games",
    location: "Field or across the driveway by the barn",
    notes: "Cornhole, ladderball/polish horseshoe, badminton, canjam.",
  }),
  item("decor", "Cleanup", 60, "Trash", {
    key: "decor-trash",
    detail: "Haley's parents",
    notes: "Haley's parents take trash.",
  }),
  item("decor", "Cleanup", 61, "Decor goes home with Haley's parents", {
    key: "decor-take-home",
    notes: "Decor leaves with Haley's parents and anyone staying with them. Avalon breaks down for the point person — Avalon does not own removal/transport.",
  }),
  item("decor", "Cleanup", 62, "Tables, chairs, pews, sweep", {
    key: "decor-reset",
    notes: "Tables stay where they are; any wood tables move under the shelter. Chairs stacked along the backs of pews. Short pews returned if not already. Venue gets swept.",
  }),
];

const LINEUP: PlaybookRecord[] = [
  item("lineup", "Ceremony processional", 0, "Mother of the Groom & Father of the Groom", {
    key: "lineup-mog-fog",
    startAt: "3:20 PM",
  }),
  item("lineup", "Ceremony processional", 1, "Officiant & Mother of the Bride", {
    key: "lineup-officiant-mob",
    startAt: "3:20 PM",
  }),
  item("lineup", "Ceremony processional", 2, "David", {
    key: "lineup-david",
    startAt: "3:20 PM",
  }),
  item("lineup", "Ceremony processional", 3, "Skila & Trinity", {
    key: "lineup-skila-trinity",
    startAt: "3:20 PM",
  }),
  item("lineup", "Ceremony processional", 4, "Victoria & Bri", {
    key: "lineup-victoria-bri",
    startAt: "3:20 PM",
  }),
  item("lineup", "Ceremony processional", 5, "Kaylie & Evan", {
    key: "lineup-kaylie-evan",
    startAt: "3:20 PM",
  }),
  item("lineup", "Ceremony processional", 6, "Braxton & Andi", {
    key: "lineup-braxton-andi",
    startAt: "3:20 PM",
  }),
  item("lineup", "Ceremony processional", 7, "Melody — flower girl", {
    key: "lineup-melody",
    startAt: "3:20 PM",
  }),
  item("lineup", "Ceremony processional", 8, "Haley with Dad", {
    key: "lineup-haley-dad",
    startAt: "3:20 PM",
  }),
];

const COORDINATOR: PlaybookRecord[] = [
  item("coordinator", "Avalon / Green Garden Events", 0, "Package: The Sweet Spot — 8 hours", {
    key: "avalon-package",
    notes: "$1,200 total. Signed January 2026. Week-of remaining balance is a Money fact, not a new Task.",
  }),
  item("coordinator", "Avalon / Green Garden Events", 1, "Vendor communication", {
    key: "avalon-vendors",
    notes: "Week-of miscellaneous communication if needed, plus all day-of vendor communication.",
  }),
  item("coordinator", "Avalon / Green Garden Events", 2, "8 hours on-site coordination", {
    key: "avalon-onsite",
  }),
  item("coordinator", "Avalon / Green Garden Events", 3, "Décor set up", {
    key: "avalon-decor-setup",
  }),
  item("coordinator", "Avalon / Green Garden Events", 4, "Bridal party and aisle assistance", {
    key: "avalon-aisle",
  }),
  item("coordinator", "Avalon / Green Garden Events", 5, "Emergency contact", {
    key: "avalon-emergency",
    notes: "Avalon Green · 386.589.7215 · greengardeneventsmi@gmail.com",
  }),
  item("coordinator", "Avalon / Green Garden Events", 6, "Reception entrance coordination", {
    key: "avalon-entrance",
  }),
  item("coordinator", "Avalon / Green Garden Events", 7, "Marriage license signing", {
    key: "avalon-license",
    notes: "Avalon is contracted to assist. Exact timing (before ceremony vs 4:00 PM) is still TBD.",
  }),
  item("coordinator", "Avalon / Green Garden Events", 8, "Family photo assistance", {
    key: "avalon-family-photos",
  }),
  item("coordinator", "Avalon / Green Garden Events", 9, "Décor breakdown for the point person", {
    key: "avalon-breakdown",
    notes: "Full décor clean-up/breakdown for the client's point person. That is not Avalon personally owning removal or transport of all decor. Haley's parents take trash and take decor home.",
  }),
  item("coordinator", "Avalon / Green Garden Events", 10, "Dinner table release", {
    key: "avalon-release",
    notes: "Avalon releases tables for dinner around 5:20 PM. Haley and David first.",
  }),
];

export const CANONICAL_PLAYBOOK: PlaybookRecord[] = [
  ...HAIR_MAKEUP,
  ...SHOTS,
  ...DECOR,
  ...LINEUP,
  ...COORDINATOR,
];

export function playbookByKind(
  items: PlaybookItemView[],
  kind: PlaybookKind,
): PlaybookItemView[] {
  return items
    .filter((row) => row.kind === kind)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
}

export function groupPlaybookSections(items: PlaybookItemView[]): Array<{
  section: string;
  items: PlaybookItemView[];
}> {
  const groups: Array<{ section: string; items: PlaybookItemView[] }> = [];
  const indexBySection = new Map<string, number>();
  for (const row of items.slice().sort((a, b) => a.sortOrder - b.sortOrder)) {
    const existing = indexBySection.get(row.section);
    if (existing == null) {
      indexBySection.set(row.section, groups.length);
      groups.push({ section: row.section, items: [row] });
    } else {
      groups[existing]!.items.push(row);
    }
  }
  return groups;
}

export function playbookKindLabel(kind: PlaybookKind): string {
  switch (kind) {
    case "hair_makeup":
      return "Hair & Makeup";
    case "shot":
      return "Photo shot list";
    case "decor":
      return "Decor / Setup";
    case "lineup":
      return "Ceremony lineup";
    case "coordinator":
      return "Coordinator scope";
  }
}

export function isPlaybookKind(value: string): value is PlaybookKind {
  return (PLAYBOOK_KINDS as readonly string[]).includes(value);
}

export function playbookSourceKeys(): string[] {
  return CANONICAL_PLAYBOOK.map((row) => row.sourceKey);
}

export function playbookRecordByKey(sourceKey: string): PlaybookRecord | undefined {
  return CANONICAL_PLAYBOOK.find((row) => row.sourceKey === sourceKey);
}

export function operationalViewLinks(): Array<{ href: string; label: string; detail: string }> {
  return [
    {
      href: "/plan/timeline",
      label: "Timeline",
      detail: "The full wedding-day schedule",
    },
    {
      href: "/day/mc",
      label: "MC Run of Show",
      detail: "Spoken cues and music for Kurt and Wendy",
    },
    {
      href: "/day/hair-makeup",
      label: "Hair & Makeup",
      detail: "Who is in which room, and when",
    },
    {
      href: "/day/shots",
      label: "Shot List",
      detail: "Photographer checklist",
    },
    {
      href: "/day/decor",
      label: "Decor / Setup",
      detail: "What goes out, and who owns cleanup",
    },
  ];
}

export function profilePlaybookMatches(name: string): PlaybookKind[] {
  const hay = name.toLowerCase();
  const kinds: PlaybookKind[] = [];
  if (/avalon|green garden/.test(hay)) kinds.push("coordinator", "decor", "lineup");
  if (/kurt|wendy/.test(hay)) kinds.push("lineup");
  if (/barry|tilson|photo/.test(hay)) kinds.push("shot");
  if (/katie/.test(hay)) kinds.push("hair_makeup");
  return kinds;
}

export function profileOperationalLinks(name: string): Array<{ label: string; href: string; detail: string }> {
  const kinds = profilePlaybookMatches(name);
  const links: Array<{ label: string; href: string; detail: string }> = [];
  if (/kurt|wendy/i.test(name)) {
    links.push({
      label: "MC Run of Show",
      href: "/day/mc",
      detail: "Spoken cues and music for the reception",
    });
  }
  if (kinds.includes("hair_makeup")) {
    links.push({
      label: "Hair & Makeup",
      href: "/day/hair-makeup",
      detail: "Getting-ready stations and timing",
    });
  }
  if (kinds.includes("shot")) {
    links.push({
      label: "Shot List",
      href: "/day/shots",
      detail: "Photographer checklist",
    });
  }
  if (kinds.includes("decor") || kinds.includes("coordinator")) {
    links.push({
      label: "Decor / Setup",
      href: "/day/decor",
      detail: "Setup, cleanup, and contracted coordinator scope",
    });
  }
  return links;
}

export const OPERATIONAL_PAGE_NEED = "canSeeTimeline" as const;

export const OPERATIONAL_PAGE_HREFS = [
  "/day/mc",
  "/day/hair-makeup",
  "/day/shots",
  "/day/decor",
] as const;
