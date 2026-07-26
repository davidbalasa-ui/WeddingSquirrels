import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import * as XLSX from "xlsx";
import path from "path";
import { inferDueDate, weddingDate } from "../src/lib/due-dates";

const prisma = new PrismaClient();

const DOWNLOADS = path.join(process.env.USERPROFILE || process.env.HOME || "", "Downloads");

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
  // fallback: split on and/&/,
  return cleaned
    .split(/,|\/|&|\band\b/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      if (p === "bridal party") return "bridal_party";
      return p.replace(/\s+/g, "_");
    });
}

function matchBudget(title: string, budgetNames: { id: string; name: string }[]) {
  const t = title.toLowerCase();
  const rules: [RegExp, string][] = [
    [/venue|black sheep|bss/, "black sheep"],
    [/airbnb|airbnb/, "airbnb"],
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

async function main() {
  console.log("Seeding WeddingSquirrels...");

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

  const people = [
    { id: "david", name: "David", sortOrder: 1 },
    { id: "haley", name: "Haley", sortOrder: 2 },
    { id: "shelly", name: "Shelly", sortOrder: 3 },
    { id: "bri", name: "Bri", sortOrder: 4 },
    { id: "bridal_party", name: "Bridal party", sortOrder: 5 },
  ];
  for (const person of people) {
    await prisma.person.create({ data: person });
  }

  const masterHash = await hash("0425", 10);
  await prisma.pinAccount.create({
    data: {
      name: "Master",
      pinHash: masterHash,
      isMaster: true,
      canSeeTasks: true,
      canSeeBudget: true,
      canSeeGuests: true,
      canSeeTimeline: true,
      canManageAccounts: true,
      assigneeFilterJson: null,
    },
  });

  const milHash = await hash("0999", 10);
  await prisma.pinAccount.create({
    data: {
      name: "Mother in law",
      pinHash: milHash,
      isMaster: false,
      canSeeTasks: true,
      canSeeBudget: false,
      canSeeGuests: false,
      canSeeTimeline: false,
      canManageAccounts: false,
      assigneeFilterJson: JSON.stringify(["shelly"]),
    },
  });

  // Finances
  const financeRows = readSheet("Finances.xlsx");
  const budgetIds: { id: string; name: string }[] = [];
  let sort = 0;
  for (const row of financeRows.slice(1)) {
    const name = row[0];
    const price = row[1];
    const paid = row[2];
    if (typeof name !== "string" || !name.trim()) continue;
    if (name.toLowerCase().includes("total") || name.toLowerCase().includes("alchohol") || name.toLowerCase().includes("alcohol")) {
      continue;
    }
    if (typeof price !== "number") continue;
    const item = await prisma.budgetItem.create({
      data: {
        name: name.trim(),
        price,
        amountPaid: typeof paid === "number" ? paid : 0,
        sortOrder: sort++,
        ownerId: null,
      },
    });
    budgetIds.push({ id: item.id, name: item.name });
  }

  // Timeline
  const timelineRows = readSheet("Wedding Timeline.xlsx");
  let tSort = 0;
  for (const row of timelineRows.slice(1)) {
    const start = row[0];
    const end = row[1];
    const notes = row[2];
    if (!notes || typeof notes !== "string") continue;

    const fmt = (v: unknown) => {
      if (v instanceof Date) {
        return v.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      }
      if (typeof v === "number") {
        // Excel time fraction
        const totalSeconds = Math.round(v * 86400);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const d = new Date(2000, 0, 1, h, m);
        return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      }
      if (typeof v === "string") return v;
      return null;
    };

    await prisma.timelineBlock.create({
      data: {
        startAt: fmt(start) || "TBD",
        endAt: fmt(end),
        notes: notes.trim(),
        sortOrder: tSort++,
      },
    });
  }

  // Guests
  const guestRows = readSheet("Guest Addresses.xlsx");
  let gSort = 0;
  for (const row of guestRows.slice(1)) {
    const nameLine1 = row[0];
    if (typeof nameLine1 !== "string" || !nameLine1.trim()) continue;
    await prisma.guest.create({
      data: {
        nameLine1: String(nameLine1).trim(),
        nameLine2: row[1] != null ? String(row[1]).trim() : null,
        street: row[2] != null ? String(row[2]).trim() : null,
        city: row[3] != null ? String(row[3]).trim() : null,
        state: row[4] != null ? String(row[4]).trim() : null,
        zip: row[5] != null ? String(row[5]).replace(/\.0$/, "") : null,
        sortOrder: gSort++,
      },
    });
  }

  // Ensure dynamic people from assignees exist
  const ensurePerson = async (id: string) => {
    const existing = await prisma.person.findUnique({ where: { id } });
    if (existing) return;
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

  // Tasks
  const todoRows = readSheet("Wedding Master TO-DO.xlsx");
  let rowNum = 0;
  for (const row of todoRows) {
    rowNum++;
    const title = row[0];
    const who = row[1];
    if (typeof title !== "string" || !title.trim()) continue;

    const personIds = normalizePersonToken(typeof who === "string" ? who : "both");
    for (const pid of personIds) await ensurePerson(pid);

    const budgetItemId = matchBudget(title, budgetIds);
    const dueDate = inferDueDate(title);

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        status: "todo",
        dueDate,
        sourceRow: rowNum,
        budgetItemId,
        helpText: null,
      },
    });

    const uniquePeople = [...new Set(personIds.length ? personIds : ["david", "haley"])];
    for (const personId of uniquePeople) {
      await prisma.taskAssignee.create({
        data: { taskId: task.id, personId },
      });
    }
  }

  const counts = {
    people: await prisma.person.count(),
    tasks: await prisma.task.count(),
    budget: await prisma.budgetItem.count(),
    timeline: await prisma.timelineBlock.count(),
    guests: await prisma.guest.count(),
    pins: await prisma.pinAccount.count(),
  };
  console.log("Seed complete:", counts);
  console.log("Master PIN: 0425 | Sample helper PIN: 0999 (Mother in law / Shelly tasks)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
