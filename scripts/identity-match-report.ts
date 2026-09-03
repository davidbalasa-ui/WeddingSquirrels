/**
 * READ-ONLY identity match report. Never writes columns. Uses raw SELECT id, name
 * so it runs on the current Neon schema even when personId does not exist.
 *
 *   npx tsx scripts/identity-match-report.ts [--json] [--out path]
 *
 * Connection: NEON_DATABASE_URL, or PGHOST+PGUSER+PGPASSWORD+PGDATABASE,
 * or DATABASE_URL when the host is *.neon.tech. Local URLs are refused.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import {
  buildIdentityMatchReport,
  formatIdentityMatchReport,
  type NamedIdentity,
} from "@/lib/identity-match";

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
    if (!isNeonHost(host)) {
      throw new Error(`NEON_DATABASE_URL host is not Neon: ${host || "(unparseable)"}`);
    }
    return { url: explicit, host };
  }

  const pgHost = process.env.PGHOST?.trim();
  const pgUser = process.env.PGUSER?.trim();
  const pgPassword = process.env.PGPASSWORD ?? "";
  const pgDatabase = process.env.PGDATABASE?.trim();
  if (pgHost || pgUser || pgDatabase || process.env.PGPASSWORD !== undefined) {
    const missing: string[] = [];
    if (!pgHost) missing.push("PGHOST");
    if (!pgUser) missing.push("PGUSER");
    if (!pgPassword) missing.push("PGPASSWORD");
    if (!pgDatabase) missing.push("PGDATABASE");
    if (missing.length) {
      throw new Error(`Neon parameter set is incomplete. Missing: ${missing.join(", ")}`);
    }
    if (!isNeonHost(pgHost)) {
      throw new Error(`PGHOST is not a Neon host: ${pgHost}`);
    }
    const sslmode = process.env.PGSSLMODE?.trim() || "require";
    const url = `postgresql://${encodeURIComponent(pgUser)}:${encodeURIComponent(pgPassword)}@${pgHost}/${pgDatabase}?sslmode=${sslmode}`;
    return { url, host: pgHost };
  }

  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  const host = parseHost(databaseUrl);
  if (databaseUrl && isNeonHost(host)) return { url: databaseUrl, host };

  if (databaseUrl) {
    throw new Error(
      `DATABASE_URL host ${host || "(unparseable)"} is not Neon. Set NEON_DATABASE_URL or PGHOST/PGUSER/PGPASSWORD/PGDATABASE. Do not point this report at local Postgres.`,
    );
  }

  throw new Error(
    "No Neon credentials. Missing NEON_DATABASE_URL, and DATABASE_URL is not a Neon URL. The Neon screenshot password was masked — PGPASSWORD is required.",
  );
}

async function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const outFlag = args.indexOf("--out");
  const outPath = outFlag >= 0 ? args[outFlag + 1] : undefined;

  const { url, host } = neonConnectionUrl();
  const adapter = new PrismaNeon({ connectionString: url });
  const client = new PrismaClient({ adapter, log: ["error"] });

  try {
    const [persons, guestPeople, contacts, mealGuests] = await Promise.all([
      client.$queryRaw<NamedIdentity[]>`SELECT id, name FROM "Person" ORDER BY name ASC`,
      client.$queryRaw<NamedIdentity[]>`SELECT id, name FROM "GuestPerson" ORDER BY name ASC`,
      client.$queryRaw<NamedIdentity[]>`SELECT id, name FROM "Contact" ORDER BY name ASC`,
      client.$queryRaw<NamedIdentity[]>`SELECT id, name FROM "MealGuest" ORDER BY name ASC`,
    ]);

    const report = buildIdentityMatchReport({
      persons,
      guestPeople,
      contacts,
      mealGuests,
    });
    const payload = {
      generatedAt: new Date().toISOString(),
      readOnly: true,
      backfillPerformed: false,
      schemaMutated: false,
      databaseHost: host,
      databaseIsLocal: false,
      ...report,
    };

    const text = [`databaseHost=${host}`, formatIdentityMatchReport(report)].join("\n");
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
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
