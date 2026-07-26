import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import * as XLSX from "xlsx";
import path from "path";
import { inferDueDate, weddingDate } from "../src/lib/due-dates";

const prisma = new PrismaClient();
const DOWNLOADS = path.join(process.env.USERPROFILE || process.env.HOME || "", "Downloads");

type RawTask = { title: string; who: string; row: number };

type PackageDef = {
  key: string;
  title: string;
  summary: string;
  match: (title: string) => boolean;
};

const PACKAGES: PackageDef[] = [
  {
    key: "makeup",
    title: "Makeup plan",
    summary: "Decide the look, supplies, and day-of verification so nothing is left fuzzy.",
    match: (t) => /makeup/.test(t),
  },
  {
    key: "hair",
    title: "Hair plan",
    summary: "Confirm stylist, trial, contract, and whether hair is the right call.",
    match: (t) => /hair/.test(t),
  },
  {
    key: "floral",
    title: "Florals & centerpieces",
    summary: "Bouquet, centerpieces (including cloud idea), and what else needs flowers.",
    match: (t) => /floral|centerpiece|bouquet|boquet|peon/.test(t),
  },
  {
    key: "decor",
    title: "Decor & venue styling",
    summary: "Decor decisions, Avalon list, table layout, signage, and placement items.",
    match: (t) => /decor|table layout|table placement|table number|signage|avalon.*list|list of decor/.test(t),
  },
  {
    key: "photos",
    title: "Photos & video",
    summary: "Shot lists, engagement photos, photographer/videographer details, and golden-hour needs.",
    match: (t) => /photo|photog|videographer|camcorder|first look|shot list/.test(t),
  },
  {
    key: "music",
    title: "Music & sound",
    summary: "Playlists by moment, downloads to devices, band/DJ, and ceremony walk song.",
    match: (t) => /music|playlist|band|dj|sound|walk song|ceremony.*song/.test(t),
  },
  {
    key: "invites",
    title: "Invitations & RSVPs",
    summary: "Order, address, send invites; website RSVPs; remind guests; postage.",
    match: (t) => /invite|invitation|rsvp|postage|stationery|stationer/.test(t),
  },
  {
    key: "guestbook",
    title: "Guest book",
    summary: "Decide the guest book idea, buy it, and lock the plan.",
    match: (t) => /guest book|guestbook/.test(t),
  },
  {
    key: "registry",
    title: "Registry",
    summary: "Fix the registry and re-add the items you actually want.",
    match: (t) => /registry/.test(t),
  },
  {
    key: "cake",
    title: "Cake & dessert",
    summary: "Wedding cake, banana pudding service, and cake topper.",
    match: (t) => /cake|banana pudding|topper/.test(t),
  },
  {
    key: "rehearsal",
    title: "Rehearsal dinner",
    summary: "Venue, time, guest count, invites, outfits, and parent confirmation.",
    match: (t) => /rehersal|rehearsal/.test(t),
  },
  {
    key: "ceremony",
    title: "Ceremony plan",
    summary: "Ceremony flow, confetti/bubbles, private vows, and BSS ceremony details.",
    match: (t) => /ceremony|confetti|bubble|private vow|crossbow/.test(t),
  },
  {
    key: "reception",
    title: "Reception moments",
    summary: "Toasts, dances, bounce house, big exit, favors, playing cards, getaway car.",
    match: (t) => /bounce|toast|dance|exit|favor|playing card|getaway|kids curfew/.test(t),
  },
  {
    key: "payments",
    title: "Vendor payments",
    summary: "Track what still needs to be paid, tip envelopes, and confirmation with Avalon/BSS.",
    match: (t) => /\bpay\b|payment|tip envelope|balance|money for the bach/.test(t),
  },
  {
    key: "vendors",
    title: "Vendor & BSS paperwork",
    summary: "Names, insurance, licenses, and required details for Black Sheep Shelter / Avalon.",
    match: (t) => /provide |bss|insurance|bartender|caterer|trashman|helpers to setup|master and mistress/.test(t),
  },
  {
    key: "guests",
    title: "Guest logistics",
    summary: "Final counts, seating, escort cards, parking link, travel info, transportation.",
    match: (t) => /guest count|seating|escort|parking|travel|transportation|wedding party timelines/.test(t),
  },
  {
    key: "attire",
    title: "Attire & rings",
    summary: "Rings, shower outfit, bridal party clothing, emergency kit pieces.",
    match: (t) => /ring|outfit|attire|biker short|veil|dress|wearing/.test(t),
  },
  {
    key: "thankyou",
    title: "Thank-you cards",
    summary: "Order, write, and send thank-you cards after the wedding.",
    match: (t) => /thank you/.test(t),
  },
  {
    key: "comms",
    title: "Communication game plan",
    summary: "How you two (and helpers) communicate decisions, updates, and day-of info — write the actual plan here.",
    match: (t) => /communication game plan|share the wedding folder|website information|need to know/.test(t),
  },
  {
    key: "weekof",
    title: "Week-of & day-of readiness",
    summary: "Confirm week-of plans, charge devices, pack, relax, get married.",
    match: (t) => /week of|charge devices|pack for|relax before|get married|bang my wife|after wedding packing/.test(t),
  },
];

function readSheet(fileName: string) {
  const filePath = path.join(DOWNLOADS, fileName);
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, defval: null });
}

function normalizePersonToken(raw: string): string[] {
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!cleaned) return [];
  if (cleaned === "both") return ["david", "haley"];
  if (cleaned.includes("haley") && cleaned.includes("bri")) return ["haley", "bri"];
  if (cleaned === "bridal party") return ["bridal_party"];
  if (cleaned === "david") return ["david"];
  if (cleaned === "haley") return ["haley"];
  if (cleaned === "shelly") return ["shelly"];
  if (cleaned === "bri") return ["bri"];
  return cleaned
    .split(/,|\/|&|\band\b/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (p === "bridal party" ? "bridal_party" : p.replace(/\s+/g, "_")));
}

function matchBudget(title: string, budgetNames: { id: string; name: string }[]) {
  const t = title.toLowerCase();
  const rules: [RegExp, string][] = [
    [/venue|black sheep|bss/, "black sheep"],
    [/airbnb/, "airbnb"],
    [/hotel/, "hotel"],
    [/coordinator|avalon/, "coordinator"],
    [/photog/, "photographer"],
    [/dress alteration/, "alterations"],
    [/wedding dress|dress(?! alteration)/, "wedding dress"],
    [/cater/, "catering"],
    [/band/, "band"],
    [/bartender/, "bartender"],
    [/flower|peon/, "flowers"],
    [/decor/, "decor"],
    [/officiant/, "officiant"],
    [/groom|attire/, "groom"],
    [/stationer|invite/, "stationer"],
    [/cutlery|dish/, "cutlery"],
    [/veil/, "veil"],
    [/invitation/, "invitation"],
  ];
  for (const [re, key] of rules) {
    if (!re.test(t)) continue;
    const hit = budgetNames.find((b) => b.name.toLowerCase().includes(key));
    if (hit) return hit.id;
  }
  return null;
}

function packageFor(title: string): PackageDef | null {
  const t = title.toLowerCase();
  return PACKAGES.find((p) => p.match(t)) || null;
}

async function main() {
  console.log("Seeding WeddingSquirrels (decision packages)...");

  await prisma.taskAssignee.deleteMany();
  await prisma.task.deleteMany();
  await prisma.budgetItem.deleteMany();
  await prisma.timelineBlock.deleteMany();
  await prisma.guest.deleteMany();
  await prisma.person.deleteMany();
  await prisma.pinAccount.deleteMany();
  await prisma.appSettings.deleteMany();

  await prisma.appSettings.create({
    data: {
      id: 1,
      weddingDate: weddingDate(),
      timezone: "America/Detroit",
      coupleNames: "David & Haley",
    },
  });

  for (const person of [
    { id: "david", name: "David", sortOrder: 1 },
    { id: "haley", name: "Haley", sortOrder: 2 },
    { id: "shelly", name: "Shelly", sortOrder: 3 },
    { id: "bri", name: "Bri", sortOrder: 4 },
    { id: "bridal_party", name: "Bridal party", sortOrder: 5 },
  ]) {
    await prisma.person.create({ data: person });
  }

  await prisma.pinAccount.create({
    data: {
      name: "Master",
      pinHash: await hash("0425", 10),
      isMaster: true,
      canSeeTasks: true,
      canSeeBudget: true,
      canSeeGuests: true,
      canSeeTimeline: true,
      canManageAccounts: true,
    },
  });

  await prisma.pinAccount.create({
    data: {
      name: "Mother in law",
      pinHash: await hash("0999", 10),
      canSeeTasks: true,
      canSeeBudget: false,
      canSeeGuests: false,
      canSeeTimeline: false,
      canManageAccounts: false,
      assigneeFilterJson: JSON.stringify(["shelly"]),
    },
  });

  const financeRows = readSheet("Finances.xlsx");
  const budgetIds: { id: string; name: string }[] = [];
  let sort = 0;
  for (const row of financeRows.slice(1)) {
    const name = row[0];
    const price = row[1];
    const paid = row[2];
    if (typeof name !== "string" || !name.trim()) continue;
    if (/total|alchohol|alcohol/i.test(name)) continue;
    if (typeof price !== "number") continue;
    const item = await prisma.budgetItem.create({
      data: {
        name: name.trim(),
        price,
        amountPaid: typeof paid === "number" ? paid : 0,
        sortOrder: sort++,
      },
    });
    budgetIds.push({ id: item.id, name: item.name });
  }

  const timelineRows = readSheet("Wedding Timeline.xlsx");
  let tSort = 0;
  for (const row of timelineRows.slice(1)) {
    const notes = row[2];
    if (!notes || typeof notes !== "string") continue;
    const fmt = (v: unknown) => {
      if (typeof v === "number") {
        const totalSeconds = Math.round(v * 86400);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        return new Date(2000, 0, 1, h, m).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });
      }
      if (typeof v === "string") return v;
      return null;
    };
    await prisma.timelineBlock.create({
      data: {
        startAt: fmt(row[0]) || "TBD",
        endAt: fmt(row[1]),
        notes: notes.trim(),
        sortOrder: tSort++,
      },
    });
  }

  const guestRows = readSheet("Guest Addresses.xlsx");
  let gSort = 0;
  for (const row of guestRows.slice(1)) {
    if (typeof row[0] !== "string" || !row[0].trim()) continue;
    await prisma.guest.create({
      data: {
        nameLine1: String(row[0]).trim(),
        nameLine2: row[1] != null ? String(row[1]).trim() : null,
        street: row[2] != null ? String(row[2]).trim() : null,
        city: row[3] != null ? String(row[3]).trim() : null,
        state: row[4] != null ? String(row[4]).trim() : null,
        zip: row[5] != null ? String(row[5]).replace(/\.0$/, "") : null,
        sortOrder: gSort++,
      },
    });
  }

  const ensurePerson = async (id: string) => {
    if (await prisma.person.findUnique({ where: { id } })) return;
    await prisma.person.create({
      data: {
        id,
        name: id
          .split("_")
          .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
          .join(" "),
        sortOrder: 50,
      },
    });
  };

  const todoRows = readSheet("Wedding Master TO-DO.xlsx");
  const raw: RawTask[] = [];
  let rowNum = 0;
  for (const row of todoRows) {
    rowNum++;
    if (typeof row[0] !== "string" || !row[0].trim()) continue;
    raw.push({
      title: row[0].trim(),
      who: typeof row[1] === "string" ? row[1] : "both",
      row: rowNum,
    });
  }

  const buckets = new Map<string, { def: PackageDef | null; items: RawTask[] }>();
  for (const item of raw) {
    const def = packageFor(item.title);
    const key = def?.key || `solo:${item.row}`;
    if (!buckets.has(key)) buckets.set(key, { def, items: [] });
    buckets.get(key)!.items.push(item);
  }

  let packageOrder = 0;
  for (const [, bucket] of buckets) {
    const items = bucket.items;
    const allPeople = new Set<string>();
    let earliestDue: Date | null = null;
    let budgetItemId: string | null = null;

    for (const item of items) {
      for (const pid of normalizePersonToken(item.who)) {
        await ensurePerson(pid);
        allPeople.add(pid);
      }
      const due = inferDueDate(item.title);
      if (due && (!earliestDue || due < earliestDue)) earliestDue = due;
      if (!budgetItemId) budgetItemId = matchBudget(item.title, budgetIds);
    }

    const title = bucket.def?.title || items[0].title;
    const summary =
      bucket.def?.summary ||
      "Open this card to write the decision, money needed, money spent, and mark it done when finished.";

    const parent = await prisma.task.create({
      data: {
        title,
        summary,
        planNotes: "",
        status: "todo",
        dueDate: earliestDue,
        amountNeeded: null,
        amountSpent: 0,
        budgetItemId,
        sortOrder: packageOrder++,
        sourceRow: items[0].row,
      },
    });

    const people = [...(allPeople.size ? allPeople : ["david", "haley"])];
    for (const personId of people) {
      await prisma.taskAssignee.create({ data: { taskId: parent.id, personId } });
    }

    // Solo unmatched items: no children — the package IS the decision card
    if (!bucket.def && items.length === 1) {
      continue;
    }

    let childOrder = 0;
    for (const item of items) {
      const personIds = normalizePersonToken(item.who);
      for (const pid of personIds) await ensurePerson(pid);

      const child = await prisma.task.create({
        data: {
          title: item.title,
          summary: "Check this off when this piece of the larger step is finished.",
          planNotes: "",
          status: "todo",
          dueDate: inferDueDate(item.title),
          parentId: parent.id,
          sortOrder: childOrder++,
          sourceRow: item.row,
          budgetItemId: matchBudget(item.title, budgetIds),
        },
      });

      for (const personId of [...new Set(personIds.length ? personIds : ["david", "haley"])]) {
        await prisma.taskAssignee.create({ data: { taskId: child.id, personId } });
      }
    }
  }

  const counts = {
    packages: await prisma.task.count({ where: { parentId: null } }),
    steps: await prisma.task.count({ where: { parentId: { not: null } } }),
    budget: await prisma.budgetItem.count(),
    timeline: await prisma.timelineBlock.count(),
    guests: await prisma.guest.count(),
  };
  console.log("Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
