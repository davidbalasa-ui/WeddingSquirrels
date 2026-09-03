/**
 * Phase 1B-1 identity migration. Dry-run by default. Neon writes require --apply.
 *
 *   npx tsx scripts/phase-1b1-identity.ts
 *   npx tsx scripts/phase-1b1-identity.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import {
  PHASE_1B1_CONTACT_LINKS,
  PHASE_1B1_CREATES,
  PHASE_1B1_EXPECTED_END,
  PHASE_1B1_EXPECTED_START,
  PHASE_1B1_RENAMES,
  assertPhase1b1Manifest,
  phase1b1GuestPersonLinks,
} from "@/lib/phase-1b1-manifest";

function parseHost(databaseUrl: string): string {
  try {
    return new URL(databaseUrl.replace(/^postgres(ql)?:\/\//, "http://")).hostname;
  } catch {
    return "";
  }
}

function isNeonHost(host: string): boolean {
  const hostname = host.toLowerCase();
  return hostname === "neon.tech" || hostname.endsWith(".neon.tech");
}

function neonConnectionUrl(): { url: string; host: string } {
  const explicit = process.env.NEON_DATABASE_URL?.trim();
  if (explicit) {
    const host = parseHost(explicit);
    if (!isNeonHost(host)) throw new Error(`NEON_DATABASE_URL host is not Neon: ${host}`);
    return { url: explicit, host };
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
    return {
      url: `postgresql://${encodeURIComponent(pgUser!)}:${encodeURIComponent(pgPassword)}@${pgHost}/${pgDatabase}?sslmode=${sslmode}`,
      host: pgHost!,
    };
  }
  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  const host = parseHost(databaseUrl);
  if (databaseUrl && isNeonHost(host)) return { url: databaseUrl, host };
  throw new Error("No Neon credentials. Set NEON_DATABASE_URL or PGHOST/PGUSER/PGPASSWORD/PGDATABASE.");
}

async function count(client: PrismaClient, table: string): Promise<number> {
  const rows = await client.$queryRawUnsafe<Array<{ n: number }>>(
    `SELECT COUNT(*)::int AS n FROM "${table}"`,
  );
  return rows[0]!.n;
}

async function loadSnapshot(client: PrismaClient) {
  const [persons, guestPeople, contacts, mealGuests] = await Promise.all([
    client.$queryRaw<Array<{ id: string; name: string }>>`SELECT id, name FROM "Person"`,
    client.$queryRaw<Array<{ id: string; name: string }>>`SELECT id, name FROM "GuestPerson"`,
    client.$queryRaw<Array<{ id: string; name: string }>>`SELECT id, name FROM "Contact"`,
    client.$queryRaw<Array<{ id: string }>>`SELECT id FROM "MealGuest"`,
  ]);
  return {
    counts: {
      persons: persons.length,
      guestPeople: guestPeople.length,
      contacts: contacts.length,
      mealGuests: mealGuests.length,
    },
    persons,
    guestPeople,
    contacts,
    mealGuests,
  };
}

function verifyAgainstManifest(snapshot: Awaited<ReturnType<typeof loadSnapshot>>): string[] {
  const errors: string[] = [];
  const { counts } = snapshot;
  if (counts.persons !== PHASE_1B1_EXPECTED_START.persons) {
    errors.push(`Person count ${counts.persons} != ${PHASE_1B1_EXPECTED_START.persons}`);
  }
  if (counts.guestPeople !== PHASE_1B1_EXPECTED_START.guestPeople) {
    errors.push(`GuestPerson count ${counts.guestPeople} != ${PHASE_1B1_EXPECTED_START.guestPeople}`);
  }
  if (counts.contacts !== PHASE_1B1_EXPECTED_START.contacts) {
    errors.push(`Contact count ${counts.contacts} != ${PHASE_1B1_EXPECTED_START.contacts}`);
  }
  if (counts.mealGuests !== PHASE_1B1_EXPECTED_START.mealGuests) {
    errors.push(`MealGuest count ${counts.mealGuests} != ${PHASE_1B1_EXPECTED_START.mealGuests}`);
  }

  const personById = new Map(snapshot.persons.map((row) => [row.id, row]));
  const guestById = new Map(snapshot.guestPeople.map((row) => [row.id, row]));
  const contactById = new Map(snapshot.contacts.map((row) => [row.id, row]));

  for (const row of PHASE_1B1_CREATES) {
    if (personById.has(row.id)) errors.push(`CREATE Person ${row.id} already exists`);
    for (const guestPersonId of row.guestPersonIds) {
      if (!guestById.has(guestPersonId)) errors.push(`Missing GuestPerson ${guestPersonId}`);
    }
  }
  for (const row of PHASE_1B1_RENAMES) {
    const existing = personById.get(row.id);
    if (!existing) errors.push(`RENAME Person ${row.id} missing`);
    else if (existing.name !== row.fromName) {
      errors.push(`RENAME ${row.id} name is ${existing.name}, expected ${row.fromName}`);
    }
  }
  for (const row of phase1b1GuestPersonLinks()) {
    if (!guestById.has(row.guestPersonId)) errors.push(`LINK missing GuestPerson ${row.guestPersonId}`);
  }
  for (const row of PHASE_1B1_CONTACT_LINKS) {
    if (!contactById.has(row.contactId)) errors.push(`LINK missing Contact ${row.contactId}`);
    if (!personById.has(row.personId) && !PHASE_1B1_CREATES.some((create) => create.id === row.personId)) {
      errors.push(`LINK Contact target Person ${row.personId} missing`);
    }
  }
  return errors;
}

async function applyMutation(client: PrismaClient): Promise<void> {
  await client.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(
        `ALTER TABLE "GuestPerson" ADD COLUMN IF NOT EXISTS "personId" TEXT`,
      );
      await tx.$executeRawUnsafe(
        `ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "personId" TEXT`,
      );
      await tx.$executeRawUnsafe(
        `ALTER TABLE "MealGuest" ADD COLUMN IF NOT EXISTS "personId" TEXT`,
      );
      await tx.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "GuestPerson_personId_idx" ON "GuestPerson"("personId")`,
      );
      await tx.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "Contact_personId_idx" ON "Contact"("personId")`,
      );
      await tx.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "MealGuest_personId_idx" ON "MealGuest"("personId")`,
      );

      const [{ maxSort }] = await tx.$queryRaw<Array<{ maxSort: number | null }>>`
        SELECT MAX("sortOrder") AS "maxSort" FROM "Person"
      `;
      let sort = (maxSort ?? 0) + 1;
      for (const row of PHASE_1B1_CREATES) {
        await tx.$executeRaw`
          INSERT INTO "Person" (id, name, "sortOrder", "isDayOfContact")
          VALUES (${row.id}, ${row.name}, ${sort}, false)
        `;
        sort += 1;
      }
      for (const row of PHASE_1B1_RENAMES) {
        await tx.$executeRaw`UPDATE "Person" SET name = ${row.toName} WHERE id = ${row.id}`;
      }
      for (const row of phase1b1GuestPersonLinks()) {
        await tx.$executeRaw`
          UPDATE "GuestPerson" SET "personId" = ${row.personId} WHERE id = ${row.guestPersonId}
        `;
      }
      for (const row of PHASE_1B1_CONTACT_LINKS) {
        await tx.$executeRaw`
          UPDATE "Contact" SET "personId" = ${row.personId} WHERE id = ${row.contactId}
        `;
      }

      const persons = await count(tx as unknown as PrismaClient, "Person");
      const gpLinked = await tx.$queryRaw<Array<{ n: number }>>`
        SELECT COUNT(*)::int AS n FROM "GuestPerson" WHERE "personId" IS NOT NULL
      `;
      const cLinked = await tx.$queryRaw<Array<{ n: number }>>`
        SELECT COUNT(*)::int AS n FROM "Contact" WHERE "personId" IS NOT NULL
      `;
      const mLinked = await tx.$queryRaw<Array<{ n: number }>>`
        SELECT COUNT(*)::int AS n FROM "MealGuest" WHERE "personId" IS NOT NULL
      `;
      const orphans = await tx.$queryRaw<Array<{ n: number }>>`
        SELECT COUNT(*)::int AS n
        FROM "GuestPerson" gp
        LEFT JOIN "Person" p ON p.id = gp."personId"
        WHERE gp."personId" IS NOT NULL AND p.id IS NULL
      `;
      const contactOrphans = await tx.$queryRaw<Array<{ n: number }>>`
        SELECT COUNT(*)::int AS n
        FROM "Contact" c
        LEFT JOIN "Person" p ON p.id = c."personId"
        WHERE c."personId" IS NOT NULL AND p.id IS NULL
      `;
      const failures: string[] = [];
      if (persons !== PHASE_1B1_EXPECTED_END.persons) {
        failures.push(`Person ${persons} != ${PHASE_1B1_EXPECTED_END.persons}`);
      }
      if (gpLinked[0]!.n !== PHASE_1B1_EXPECTED_END.guestPeopleLinked) {
        failures.push(`GuestPerson linked ${gpLinked[0]!.n} != ${PHASE_1B1_EXPECTED_END.guestPeopleLinked}`);
      }
      if (cLinked[0]!.n !== PHASE_1B1_EXPECTED_END.contactsLinked) {
        failures.push(`Contact linked ${cLinked[0]!.n} != ${PHASE_1B1_EXPECTED_END.contactsLinked}`);
      }
      if (mLinked[0]!.n !== PHASE_1B1_EXPECTED_END.mealGuestsLinked) {
        failures.push(`MealGuest linked ${mLinked[0]!.n} != ${PHASE_1B1_EXPECTED_END.mealGuestsLinked}`);
      }
      if (orphans[0]!.n !== 0) failures.push(`orphan GuestPerson personId ${orphans[0]!.n}`);
      if (contactOrphans[0]!.n !== 0) failures.push(`orphan Contact personId ${contactOrphans[0]!.n}`);
      if (failures.length) throw new Error(`Validation failed, rolling back: ${failures.join("; ")}`);
    },
    { timeout: 120000, maxWait: 20000 },
  );
}

async function main() {
  assertPhase1b1Manifest();
  const apply = process.argv.includes("--apply");
  const { url, host } = neonConnectionUrl();
  const client = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: url }),
    log: ["error"],
  });

  try {
    const snapshot = await loadSnapshot(client);
    const errors = verifyAgainstManifest(snapshot);
    const guestLinks = phase1b1GuestPersonLinks();
    console.log(`host=${host}`);
    console.log(`mode=${apply ? "APPLY" : "DRY-RUN"}`);
    console.log(
      `start Person=${snapshot.counts.persons} GuestPerson=${snapshot.counts.guestPeople} Contact=${snapshot.counts.contacts} MealGuest=${snapshot.counts.mealGuests}`,
    );
    console.log(
      `plan CREATE=${PHASE_1B1_CREATES.length} RENAME=${PHASE_1B1_RENAMES.length} LINK_GP=${guestLinks.length} LINK_CONTACT=${PHASE_1B1_CONTACT_LINKS.length}`,
    );
    if (errors.length) {
      console.error("NOT READY");
      for (const error of errors) console.error(`  ${error}`);
      process.exitCode = 1;
      return;
    }
    console.log("preflight OK");
    if (!apply) {
      console.log("READY (dry-run only; pass --apply to write)");
      return;
    }
    await applyMutation(client);
    console.log(
      `applied Person=${PHASE_1B1_EXPECTED_END.persons} GuestPerson linked=${PHASE_1B1_EXPECTED_END.guestPeopleLinked} Contact linked=${PHASE_1B1_EXPECTED_END.contactsLinked} MealGuest linked=${PHASE_1B1_EXPECTED_END.mealGuestsLinked}`,
    );
    console.log("READY");
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
