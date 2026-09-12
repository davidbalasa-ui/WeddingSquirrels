/**
 * Controlled People contact/profile enrichment from contacts(1).md curated rows.
 *
 *   npx tsx scripts/enrich-contacts-from-md.ts
 *   npx tsx scripts/enrich-contacts-from-md.ts --apply
 *   npx tsx scripts/enrich-contacts-from-md.ts --photo-dir ./photos
 *
 * Production: NEON_DATABASE_URL or PGHOST+PGUSER+PGPASSWORD+PGDATABASE (Neon only).
 * Never seeds, resets, truncates, deletes, renames, or creates Person/GuestPerson.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { productionWeddingIdentityError } from "@/lib/curated-open-work";
import {
  CONTACT_ENRICHMENT_SOURCES,
  enrichmentWriteCounts,
  formatEnrichmentDryRunRow,
  photoDataUrlFromFileBytes,
  planContactEnrichment,
  type EnrichmentSnapshot,
} from "@/lib/contact-enrichment";
import {
  isProtectedProductionTarget,
  parseDatabaseTarget,
  PROTECTED_PRODUCTION_ENDPOINT_ID,
} from "@/lib/seed-safety";

function isNeonHost(host: string): boolean {
  const hostname = host.toLowerCase();
  return hostname === "neon.tech" || hostname.endsWith(".neon.tech");
}

function parseHost(databaseUrl: string): string {
  try {
    return new URL(databaseUrl.replace(/^postgres(ql)?:\/\//, "http://")).hostname;
  } catch {
    return "";
  }
}

function neonConnectionUrl(): { url: string; host: string; database: string } {
  const explicit = process.env.NEON_DATABASE_URL?.trim();
  if (explicit) {
    const host = parseHost(explicit);
    if (!isNeonHost(host)) throw new Error(`NEON_DATABASE_URL host is not Neon: ${host}`);
    return { url: explicit, host, database: parseDatabaseTarget(explicit)?.database ?? "neondb" };
  }

  const pgHost = process.env.PGHOST?.trim();
  const pgUser = process.env.PGUSER?.trim();
  const pgPassword = process.env.PGPASSWORD ?? "";
  const pgDatabase = process.env.PGDATABASE?.trim();
  if (pgHost || pgUser || pgDatabase || process.env.PGPASSWORD !== undefined) {
    const missing = [
      !pgHost && "PGHOST",
      !pgUser && "PGUSER",
      !pgPassword && "PGPASSWORD",
      !pgDatabase && "PGDATABASE",
    ].filter(Boolean);
    if (missing.length) throw new Error(`Missing ${missing.join(", ")}`);
    if (!isNeonHost(pgHost!)) throw new Error(`PGHOST is not Neon: ${pgHost}`);
    const sslmode = process.env.PGSSLMODE?.trim() || "require";
    const url = `postgresql://${encodeURIComponent(pgUser!)}:${encodeURIComponent(pgPassword)}@${pgHost}/${pgDatabase}?sslmode=${sslmode}`;
    return { url, host: pgHost!, database: pgDatabase! };
  }

  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  const host = parseHost(databaseUrl);
  if (databaseUrl && isNeonHost(host)) {
    return { url: databaseUrl, host, database: parseDatabaseTarget(databaseUrl)?.database ?? "neondb" };
  }

  throw new Error(
    "No production Neon credentials. Set NEON_DATABASE_URL or PGHOST/PGUSER/PGPASSWORD/PGDATABASE. Local DATABASE_URL is refused.",
  );
}

function clientFor(url: string) {
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
}

function assertKnownProductionHost(host: string, database: string) {
  const target = parseDatabaseTarget(`postgresql://x@${host}/${database}`);
  if (!isProtectedProductionTarget(target) && !host.toLowerCase().includes(PROTECTED_PRODUCTION_ENDPOINT_ID)) {
    throw new Error(`Refusing write: host ${host} is not the known production endpoint ${PROTECTED_PRODUCTION_ENDPOINT_ID}`);
  }
  if (database !== "neondb") {
    throw new Error(`Refusing write: database is ${database}, expected neondb`);
  }
}

function pgDumpBin(minMajor: number): string {
  for (const bin of [`/usr/lib/postgresql/${minMajor}/bin/pg_dump`, "pg_dump"]) {
    try {
      const out = execFileSync(bin, ["--version"], { encoding: "utf8" });
      const major = Number.parseInt((out.match(/(\d+)\./) ?? [])[1] ?? "0", 10);
      if (major >= minMajor) return bin;
    } catch {
      /* try next */
    }
  }
  throw new Error(`Need pg_dump ${minMajor}+ for backup. Install postgresql-client-${minMajor}.`);
}

function dumpDatabase(label: string, databaseUrl: string): { path: string; sha256: string } {
  const dir = "/tmp/weddingsquirrels-backups";
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(dir, `weddingsquirrels-${label}-${stamp}.dump`);
  const bin = pgDumpBin(17);
  execFileSync(bin, ["-Fc", "--no-owner", "--no-acl", "-f", file, databaseUrl], {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  const sha256 = createHash("sha256").update(readFileSync(file)).digest("hex");
  writeFileSync(`${file}.sha256`, `${sha256}  ${path.basename(file)}\n`);
  try {
    mkdirSync("/opt/cursor/artifacts", { recursive: true });
    writeFileSync(`/opt/cursor/artifacts/contact-enrichment-backup-sha256.txt`, `${sha256}  ${file}\n`);
  } catch {
    /* optional */
  }
  return { path: file, sha256 };
}

function photoSearchDirs(): string[] {
  const args = process.argv.slice(2);
  const flag = args.indexOf("--photo-dir");
  const dirs = [
    flag >= 0 ? args[flag + 1] : undefined,
    "/home/ubuntu/.cursor/projects/workspace/uploads",
    path.join(process.cwd(), "data", "contact-photos"),
    path.join(process.cwd(), "uploads"),
  ].filter((row): row is string => Boolean(row?.trim()));
  return [...new Set(dirs.map((row) => path.resolve(row)))];
}

function loadPhotoMap(): Map<string, string | null> {
  const map = new Map<string, string | null>();
  const wanted = new Set(
    CONTACT_ENRICHMENT_SOURCES.map((row) => row.photoFile).filter((row): row is string => Boolean(row)),
  );
  for (const dir of photoSearchDirs()) {
    if (!existsSync(dir)) continue;
    for (const name of wanted) {
      if (map.has(name)) continue;
      const file = path.join(dir, name);
      if (!existsSync(file)) continue;
      const bytes = readFileSync(file);
      map.set(name, photoDataUrlFromFileBytes(bytes));
    }
  }
  return map;
}

async function loadSnapshot(prisma: PrismaClient): Promise<EnrichmentSnapshot & { wedding: { coupleNames: string; weddingDate: Date; timezone: string } }> {
  const [settings, persons, guestPeople, guests, contacts] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: 1 } }),
    prisma.person.findMany({
      select: { id: true, name: true, directoryList: true, isDayOfContact: true },
    }),
    prisma.guestPerson.findMany({
      select: {
        id: true,
        name: true,
        personId: true,
        rsvpStatus: true,
        photoData: true,
        guestId: true,
      },
    }),
    prisma.guest.findMany({
      select: {
        id: true,
        phone: true,
        street: true,
        city: true,
        state: true,
        zip: true,
        rsvpStatus: true,
      },
    }),
    prisma.contact.findMany({
      select: {
        id: true,
        name: true,
        personId: true,
        phone: true,
        email: true,
        photoData: true,
        directoryList: true,
        isDayOfContact: true,
      },
    }),
  ]);
  if (!settings) throw new Error("AppSettings missing");
  return {
    wedding: {
      coupleNames: settings.coupleNames,
      weddingDate: settings.weddingDate,
      timezone: settings.timezone,
    },
    persons,
    guestPeople,
    guests,
    contacts,
  };
}

async function tableCounts(prisma: PrismaClient) {
  const [person, guestPerson, contact] = await Promise.all([
    prisma.person.count(),
    prisma.guestPerson.count(),
    prisma.contact.count(),
  ]);
  return { person, guestPerson, contact };
}

function printablePlan(plan: ReturnType<typeof planContactEnrichment>) {
  console.log("\nDRY-RUN (8 source rows)\n");
  for (const row of plan.rows) {
    console.log(formatEnrichmentDryRunRow(row));
    console.log("");
  }
  const counts = enrichmentWriteCounts(plan);
  console.log("WRITE COUNTS", counts);
  console.log("DELETES: 0");
  console.log("PERSON/GUESTPERSON CREATES: 0");
  console.log(`CONTACT CREATES (guest-linked): ${plan.contactCreates.length}`);
  for (const row of plan.contactCreates) {
    console.log(`  CONTACT CREATE personId=${row.personId} name=${JSON.stringify(row.name)} phone=${row.phone}`);
  }
}

function applyablePlan(plan: ReturnType<typeof planContactEnrichment>) {
  return {
    guestPhoneUpdates: plan.guestPhoneUpdates,
    guestLocationUpdates: plan.guestLocationUpdates,
    contactPhoneUpdates: plan.contactPhoneUpdates,
    contactCreates: plan.contactCreates,
    guestPersonPhotoUpdates: plan.guestPersonPhotoUpdates,
    contactPhotoUpdates: plan.contactPhotoUpdates,
  };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const { url, host, database } = neonConnectionUrl();
  assertKnownProductionHost(host, database);
  process.env.DATABASE_URL = url;

  const prisma = clientFor(url);
  try {
    const snapshot = await loadSnapshot(prisma);
    const identityError = productionWeddingIdentityError(snapshot.wedding);
    if (identityError) {
      console.error(`STOP: ${identityError}`);
      process.exit(1);
    }

    const beforeCounts = await tableCounts(prisma);
    const beforeNames = new Map(snapshot.persons.map((row) => [row.id, row.name]));
    const beforeRsvp = new Map(snapshot.guestPeople.map((row) => [row.id, row.rsvpStatus]));
    const beforeGuestRsvp = new Map(snapshot.guests.map((row) => [row.id, row.rsvpStatus]));
    const beforeRoles = snapshot.contacts.map((row) => ({
      id: row.id,
      directoryList: row.directoryList,
      isDayOfContact: row.isDayOfContact,
    }));

    const photoMap = loadPhotoMap();
    const plan = planContactEnrichment(snapshot, photoMap);

    console.log("A. Verified production identity");
    console.log(`  host=${host}`);
    console.log(`  database=${database}`);
    console.log(`  couple=${snapshot.wedding.coupleNames}`);
    console.log(`  weddingDate=${snapshot.wedding.weddingDate.toISOString()}`);
    console.log(`  timezone=${snapshot.wedding.timezone}`);
    console.log("  table counts before", beforeCounts);
    console.log("  photo search dirs", photoSearchDirs().filter(existsSync));

    if (plan.blocked) {
      console.error(`STOP: ${plan.blockedReason}`);
      process.exit(1);
    }

    printablePlan(plan);

    if (!apply) {
      console.log("\nDry-run only. Pass --apply to pg_dump backup and write one transaction.");
      writeFileSync(
        path.join("/tmp", "contact-enrichment-dry-run.json"),
        `${JSON.stringify({ host, database, rows: plan.rows, counts: enrichmentWriteCounts(plan) }, null, 2)}\n`,
      );
      return;
    }

    const applicable = applyablePlan(plan);
    if (
      !applicable.guestPhoneUpdates.length &&
      !applicable.guestLocationUpdates.length &&
      !applicable.contactPhoneUpdates.length &&
      !applicable.contactCreates.length &&
      !applicable.guestPersonPhotoUpdates.length &&
      !applicable.contactPhotoUpdates.length
    ) {
      console.log("\nNothing to apply (already enriched or blocked rows only).");
    }

    console.log("\nB. Backup…");
    const backup = dumpDatabase("production-pre-contact-enrichment", url);
    console.log(`  path=${backup.path}`);
    console.log(`  sha256=${backup.sha256}`);

    await prisma.$transaction(async (tx) => {
      for (const row of applicable.guestPhoneUpdates) {
        await tx.guest.update({ where: { id: row.guestId }, data: { phone: row.phone } });
      }
      for (const row of applicable.guestLocationUpdates) {
        await tx.guest.update({
          where: { id: row.guestId },
          data: { city: row.city, state: row.state },
        });
      }
      for (const row of applicable.contactPhoneUpdates) {
        await tx.contact.update({ where: { id: row.contactId }, data: { phone: row.phone } });
      }
      for (const row of applicable.contactCreates) {
        const last = await tx.contact.findFirst({ orderBy: { sortOrder: "desc" } });
        await tx.contact.create({
          data: {
            name: row.name,
            personId: row.personId,
            phone: row.phone,
            email: null,
            directoryList: row.directoryList,
            isDayOfContact: false,
            sortOrder: (last?.sortOrder ?? -1) + 1,
          },
        });
      }
      for (const row of applicable.guestPersonPhotoUpdates) {
        await tx.guestPerson.update({ where: { id: row.guestPersonId }, data: { photoData: row.photoData } });
      }
      for (const row of applicable.contactPhotoUpdates) {
        await tx.contact.update({ where: { id: row.contactId }, data: { photoData: row.photoData } });
      }
    });

    const afterSnapshot = await loadSnapshot(prisma);
    const afterCounts = await tableCounts(prisma);
    const afterPlan = planContactEnrichment(afterSnapshot, photoMap);

    for (const [id, name] of beforeNames) {
      const after = afterSnapshot.persons.find((row) => row.id === id);
      if (!after || after.name !== name) {
        throw new Error(`Person name changed for ${id}`);
      }
    }
    for (const [id, rsvp] of beforeRsvp) {
      const after = afterSnapshot.guestPeople.find((row) => row.id === id);
      if (after && after.rsvpStatus !== rsvp) {
        throw new Error(`GuestPerson RSVP changed for ${id}`);
      }
    }
    for (const [id, rsvp] of beforeGuestRsvp) {
      const after = afterSnapshot.guests.find((row) => row.id === id);
      if (after && after.rsvpStatus !== rsvp) {
        throw new Error(`Guest household RSVP changed for ${id}`);
      }
    }
    for (const before of beforeRoles) {
      const after = afterSnapshot.contacts.find((row) => row.id === before.id);
      if (!after) continue;
      if (after.directoryList !== before.directoryList || after.isDayOfContact !== before.isDayOfContact) {
        throw new Error(`Contact role changed for ${before.id}`);
      }
    }

    console.log("\nPOST-APPLY");
    console.log("  table counts after", afterCounts);
    printablePlan(afterPlan);

    const postCounts = enrichmentWriteCounts(afterPlan);
    const idempotent =
      postCounts.guestPhone === 0 &&
      postCounts.contactPhone === 0 &&
      postCounts.contactCreates === 0 &&
      postCounts.guestLocation === 0 &&
      postCounts.guestPhoto === 0 &&
      postCounts.contactPhoto === 0;
    if (!idempotent) {
      console.error("STOP: second dry-run still wants writes; not idempotent");
      process.exit(1);
    }
    console.log("\nCONTACT ENRICHMENT COMPLETE");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
