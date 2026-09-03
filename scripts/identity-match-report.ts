/**
 * READ-ONLY identity match report. Never writes personId or any other column.
 *
 *   npx tsx scripts/identity-match-report.ts [--json] [--out path]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { isLocalDatabaseUrl } from "@/lib/seed-safety";
import {
  buildIdentityMatchReport,
  formatIdentityMatchReport,
} from "@/lib/identity-match";

function databaseHost(databaseUrl = process.env.DATABASE_URL ?? ""): string {
  try {
    return new URL(databaseUrl.replace(/^postgres(ql)?:\/\//, "http://")).hostname;
  } catch {
    return "unknown";
  }
}

async function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const outFlag = args.indexOf("--out");
  const outPath = outFlag >= 0 ? args[outFlag + 1] : undefined;

  const persons = await prisma.person.findMany({
    select: { id: true, name: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const guestPeople = await prisma.guestPerson.findMany({
    select: { id: true, name: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const contacts = await prisma.contact.findMany({
    select: { id: true, name: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const mealGuests = await prisma.mealGuest.findMany({
    select: { id: true, name: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const report = buildIdentityMatchReport({
    persons,
    guestPeople,
    contacts,
    mealGuests,
  });
  const host = databaseHost();
  const payload = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    backfillPerformed: false,
    databaseHost: host,
    databaseIsLocal: isLocalDatabaseUrl(),
    ...report,
  };

  const text = [
    `databaseHost=${host}`,
    `databaseIsLocal=${payload.databaseIsLocal}`,
    formatIdentityMatchReport(report),
  ].join("\n");

  if (asJson) console.log(JSON.stringify(payload, null, 2));
  else console.log(text);

  if (outPath) {
    mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    writeFileSync(
      outPath,
      outPath.endsWith(".json") ? JSON.stringify(payload, null, 2) : text,
      "utf8",
    );
    console.error(`Wrote ${outPath}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
