import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { parsedTimeFields } from "../src/lib/day-of-time";

const prisma = new PrismaClient();

type BlockSeed = {
  seedKey: string;
  schedule: "rehearsal" | "wedding";
  startAt: string;
  endAt?: string;
  notes: string;
};

/** Thursday, Oct 15 — rehearsal dinner day */
const REHEARSAL_BLOCKS: BlockSeed[] = [
  {
    seedKey: "rehearsal_airbnb_checkin",
    schedule: "rehearsal",
    startAt: "1:00 PM",
    notes: "Airbnb Check-in\nWedding party arrives\nRooms are picked",
  },
  {
    seedKey: "rehearsal_get_ready",
    schedule: "rehearsal",
    startAt: "2:30 PM",
    notes: "Get ready\nHair and makeup",
  },
  {
    seedKey: "rehearsal_depart_airbnb",
    schedule: "rehearsal",
    startAt: "3:45 PM",
    notes: "Depart Airbnb\nDrive time 25–30 minutes\nLocation: Hawkshead, 523 Hawks Nest Dr, South Haven",
  },
  {
    seedKey: "rehearsal_dinner",
    schedule: "rehearsal",
    startAt: "4:15 PM",
    endAt: "5:40 PM",
    notes: "Dinner\nWelcome toasts\nReminders & logistics",
  },
  {
    seedKey: "rehearsal_depart_bss",
    schedule: "rehearsal",
    startAt: "5:40 PM",
    notes: "Depart for BSS\nDrive time 10–15 minutes",
  },
  {
    seedKey: "rehearsal_ceremony_rehearsal",
    schedule: "rehearsal",
    startAt: "6:00 PM",
    endAt: "7:00 PM",
    notes: "Rehearsal\nCeremony rehearsal at Black Sheep Shelter",
  },
  {
    seedKey: "rehearsal_return",
    schedule: "rehearsal",
    startAt: "7:15 PM",
    notes: "Return to Airbnb\nGame night!",
  },
];

/** Friday, Oct 16 — wedding day */
const WEDDING_BLOCKS: BlockSeed[] = [
  {
    seedKey: "wedding_venue_opens",
    schedule: "wedding",
    startAt: "10:30 AM",
    notes: "Venue Opens\nWho goes to the venue now:\n· Vendors\n· Coordinator (Avalon)\n· Master and Mistress of ceremonies (Wendy and Kurt)\nWho stays at the Airbnb:\n· Everyone else",
  },
  {
    seedKey: "wedding_settle_in",
    schedule: "wedding",
    startAt: "9:00 AM",
    endAt: "11:00 AM",
    notes: "Settle in at Airbnb\nEveryone sets up their personal hair/makeup stations\nSteam dresses\nLay out accessories, shoes, jewelry\nLight snacks + hydration\nKatie and Belle arrive at 11:00 AM",
  },
  {
    seedKey: "wedding_diy_hair",
    schedule: "wedding",
    startAt: "11:00 AM",
    endAt: "11:45 AM",
    notes: "Wedding party DIY hair & makeup\nEveryone works in pairs or small groups\nHaley begins hair with Katie (light prep only)",
  },
  {
    seedKey: "wedding_pack_up",
    schedule: "wedding",
    startAt: "11:45 AM",
    notes: "Wedding party packs up\nDresses zipped into garment bags\nTouch-up kits packed\nShoes + jewelry organized\nEveryone finishes any last-minute makeup steps\nHaley finishes hair and makeup at venue",
  },
  {
    seedKey: "wedding_party_leaves",
    schedule: "wedding",
    startAt: "12:00 PM",
    notes: "Wedding party leaves Airbnb\nWho leaves now:\n· Everyone except David, Haley, and Belle",
  },
  {
    seedKey: "wedding_quiet_time",
    schedule: "wedding",
    startAt: "12:00 PM",
    endAt: "12:20 PM",
    notes: "Quiet time at the Airbnb\nPrivate vows",
  },
  {
    seedKey: "wedding_vendor_arrival",
    schedule: "wedding",
    startAt: "10:30 AM",
    endAt: "12:30 PM",
    notes: "Vendor + Wedding Party Arrival\nVenue opens\nDecor setup\nFlorals, rentals, tables, and ceremony space arranged\nWedding party settles in, snacks, and hydration\nWedding party arrives at 12:25 PM",
  },
  {
    seedKey: "wedding_photographer_arrives",
    schedule: "wedding",
    startAt: "12:30 PM",
    endAt: "1:00 PM",
    notes: "Photographer arrives\nPhotographer unloads gear\nBegins detail shots (dress, rings, etc.)\nCaptures getting-ready candids\nHaley and David arrive at 12:45 PM",
  },
  {
    seedKey: "wedding_final_getting_ready",
    schedule: "wedding",
    startAt: "1:00 PM",
    endAt: "2:15 PM",
    notes: "Final getting ready\nBride finishes hair/makeup\nWedding party final touches\nGroom + groomsmen get ready\nPhotographer captures robe photos, finishing touches, and candids\nHarmony and Melody arrive at 1:30 PM\nSkila helps kids get ready",
  },
  {
    seedKey: "wedding_getting_dressed",
    schedule: "wedding",
    startAt: "2:15 PM",
    endAt: "2:45 PM",
    notes: "Getting dressed\nBride gets into dress\nFirst look with parent(s)\nPhotographer captures emotional moments + portraits",
  },
  {
    seedKey: "wedding_first_look",
    schedule: "wedding",
    startAt: "2:45 PM",
    endAt: "3:15 PM",
    notes: "First Look + Portraits\nFirst look w/ David\nCouple portraits\nWedding party portraits\nImmediate family portraits",
  },
  {
    seedKey: "wedding_pre_ceremony",
    schedule: "wedding",
    startAt: "3:15 PM",
    endAt: "3:30 PM",
    notes: "Pre-Ceremony Transition\nGuests begin arriving\nWedding party lines up\nTouch-ups\nPhotographer captures ceremony details + guest arrivals",
  },
  {
    seedKey: "wedding_ceremony",
    schedule: "wedding",
    startAt: "3:30 PM",
    endAt: "4:00 PM",
    notes: "Ceremony\nUnder the shelter",
  },
  {
    seedKey: "wedding_cocktail_hour",
    schedule: "wedding",
    startAt: "4:00 PM",
    endAt: "5:00 PM",
    notes: "Cocktail Hour\nGuests enjoy drinks + appetizers\nBar + trailer\nPhotographer captures candids, group photos, and reception details",
  },
  {
    seedKey: "wedding_dinner",
    schedule: "wedding",
    startAt: "5:00 PM",
    endAt: "6:00 PM",
    notes: "Dinner begins\nGuests seated\nGrand entrance\nDinner service starts\nToasts can begin towards the end of this hour",
  },
  {
    seedKey: "wedding_toasts_cake",
    schedule: "wedding",
    startAt: "6:00 PM",
    endAt: "6:30 PM",
    notes: "Toasts + Cake cutting\nFinish dinner\nToasts (Best man, MOH, FOB)\nCake cutting",
  },
  {
    seedKey: "wedding_first_dances",
    schedule: "wedding",
    startAt: "6:30 PM",
    endAt: "7:00 PM",
    notes: "First dances\nFirst dance\nFOB dance",
  },
  {
    seedKey: "wedding_open_dancing",
    schedule: "wedding",
    startAt: "7:00 PM",
    endAt: "10:00 PM",
    notes: "Open Dancing\nDance floor opens\nPhotographer stays until 9:00 PM to capture peak energy",
  },
  {
    seedKey: "wedding_teardown",
    schedule: "wedding",
    startAt: "10:00 PM",
    endAt: "11:00 PM",
    notes: "Tear down / Clean up\nEveryone helps pack up before the night is over",
  },
];

type ContactSeed = {
  name: string;
  phone?: string;
  email?: string;
};

/** Vendor directory for the wedding day. */
const VENDOR_CONTACTS: ContactSeed[] = [
  { name: "Avalon Green · Planner", phone: "(386) 589-7215" },
  { name: "Black Sheep Shelter · Venue", phone: "(616) 335-0797" },
  { name: "Barry Tilson · Photographer", phone: "(248) 704-3731" },
  { name: "Belle Genton · Videographer", phone: "(513) 833-0929" },
  { name: "Precious Peony · Caterer", email: "preciouspeonyllc@gmail.com" },
  { name: "Wendy Rush · Mistress of Ceremonies", phone: "(616) 318-9393" },
];

async function ensureTimelineBlock(block: BlockSeed) {
  const existing = await prisma.timelineBlock.findUnique({
    where: { seedKey: block.seedKey },
  });
  if (existing) return false;

  await prisma.timelineBlock.create({
    data: {
      seedKey: block.seedKey,
      schedule: block.schedule,
      startAt: block.startAt,
      endAt: block.endAt ?? null,
      notes: block.notes,
      sortOrder: 9999,
      ...parsedTimeFields(block.startAt, block.endAt ?? null),
    },
  });
  return true;
}

async function ensureContact(contact: ContactSeed) {
  const existing = await prisma.contact.findFirst({
    where: { name: { equals: contact.name, mode: "insensitive" } },
  });
  if (existing) return false;

  const last = await prisma.contact.findFirst({ orderBy: { sortOrder: "desc" } });
  await prisma.contact.create({
    data: {
      name: contact.name,
      phone: contact.phone ?? null,
      email: contact.email ?? null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  return true;
}

async function main() {
  let blocks = 0;
  for (const block of [...REHEARSAL_BLOCKS, ...WEDDING_BLOCKS]) {
    if (await ensureTimelineBlock(block)) blocks += 1;
  }

  let contacts = 0;
  for (const contact of VENDOR_CONTACTS) {
    if (await ensureContact(contact)) contacts += 1;
  }

  const rehearsalCount = await prisma.timelineBlock.count({ where: { schedule: "rehearsal" } });
  const weddingCount = await prisma.timelineBlock.count({ where: { schedule: "wedding" } });
  const contactCount = await prisma.contact.count();
  console.log(
    `Created ${blocks} timeline blocks, ${contacts} vendor contacts. ` +
      `Now: ${rehearsalCount} rehearsal · ${weddingCount} wedding blocks · ${contactCount} contacts`,
  );
  console.log("DAY-OF DATA READY");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
