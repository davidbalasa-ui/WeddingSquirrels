import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  PROTECTED_PRODUCTION_REFUSAL,
  assertDestructiveDatabaseAllowed,
  evaluateDestructiveDatabaseAccess,
  isLocalDatabaseUrl,
  isProtectedProductionTarget,
  parseDatabaseTarget,
} from "./seed-safety";

const DIRECT =
  "postgresql://neondb_owner:super-secret-password@ep-holy-mouse-avnzi9jd.c-11.us-east-1.aws.neon.tech/neondb?sslmode=require";
const POOLER =
  "postgresql://neondb_owner:super-secret-password@ep-holy-mouse-avnzi9jd-pooler.c-11.us-east-1.aws.neon.tech/neondb?sslmode=require";
const LOCAL = "postgresql://wedding:wedding@localhost:5432/wedding?sslmode=disable";

test("isLocalDatabaseUrl accepts localhost postgres URLs", () => {
  assert.equal(isLocalDatabaseUrl("postgresql://user:pass@localhost:5432/wedding"), true);
  assert.equal(isLocalDatabaseUrl("postgresql://user:pass@127.0.0.1/wedding"), true);
  assert.equal(isLocalDatabaseUrl("postgresql://user:pass@db:5432/wedding"), true);
});

test("isLocalDatabaseUrl rejects remote hosts", () => {
  assert.equal(isLocalDatabaseUrl(DIRECT), false);
  assert.equal(isLocalDatabaseUrl(""), false);
});

test("parseDatabaseTarget never requires the password to identify a host", () => {
  const target = parseDatabaseTarget(DIRECT);
  assert.deepEqual(target, {
    host: "ep-holy-mouse-avnzi9jd.c-11.us-east-1.aws.neon.tech",
    database: "neondb",
  });
});

test("localhost wedding database is allowed without ALLOW_DESTRUCTIVE_SEED", () => {
  const decision = evaluateDestructiveDatabaseAccess({
    operation: "db:seed",
    databaseUrl: LOCAL,
    allowDestructiveSeed: undefined,
  });
  assert.equal(decision.allowed, true);
});

test("production direct host is refused", () => {
  const decision = evaluateDestructiveDatabaseAccess({
    operation: "db:seed",
    databaseUrl: DIRECT,
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.message, PROTECTED_PRODUCTION_REFUSAL);
});

test("production pooler host is refused", () => {
  const decision = evaluateDestructiveDatabaseAccess({
    operation: "db:seed",
    databaseUrl: POOLER,
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.message, PROTECTED_PRODUCTION_REFUSAL);
});

test("ALLOW_DESTRUCTIVE_SEED=1 does not bypass protected production", () => {
  for (const databaseUrl of [DIRECT, POOLER]) {
    const decision = evaluateDestructiveDatabaseAccess({
      operation: "db:seed",
      databaseUrl,
      allowDestructiveSeed: "1",
    });
    assert.equal(decision.allowed, false);
    assert.equal(decision.message, PROTECTED_PRODUCTION_REFUSAL);
  }
});

test("refusal messages do not include credentials", () => {
  const decision = evaluateDestructiveDatabaseAccess({
    operation: "db:seed",
    databaseUrl: DIRECT,
    allowDestructiveSeed: "1",
  });
  assert.doesNotMatch(decision.message, /super-secret-password/);
  assert.doesNotMatch(decision.message, /neondb_owner/);
  assert.doesNotMatch(decision.message, /postgresql:\/\//);
});

test("malformed or missing DATABASE_URL fails closed", () => {
  assert.equal(
    evaluateDestructiveDatabaseAccess({ operation: "db:seed", databaseUrl: "" }).allowed,
    false,
  );
  assert.equal(
    evaluateDestructiveDatabaseAccess({ operation: "db:reset", databaseUrl: "not-a-url" }).allowed,
    false,
  );
  assert.equal(
    evaluateDestructiveDatabaseAccess({
      operation: "db:seed",
      databaseUrl: "",
      allowDestructiveSeed: "1",
    }).allowed,
    false,
  );
});

test("PGHOST production identity is refused even without DATABASE_URL", () => {
  const decision = evaluateDestructiveDatabaseAccess({
    operation: "db:reset",
    pgHost: "ep-holy-mouse-avnzi9jd.c-11.us-east-1.aws.neon.tech",
    pgDatabase: "neondb",
    allowDestructiveSeed: "1",
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.message, PROTECTED_PRODUCTION_REFUSAL);
});

test("non-production remote Neon can still use ALLOW_DESTRUCTIVE_SEED=1", () => {
  const decision = evaluateDestructiveDatabaseAccess({
    operation: "db:seed",
    databaseUrl: "postgresql://user:pass@ep-preview-branch.us-east-1.aws.neon.tech/neondb",
    allowDestructiveSeed: "1",
  });
  assert.equal(decision.allowed, true);
});

test("optional PROTECTED_DATABASE_HOSTS / production id extend the denylist", () => {
  assert.equal(
    isProtectedProductionTarget(
      { host: "ep-other-preview.us-east-1.aws.neon.tech", database: "neondb" },
      { extraProtectedHosts: ["ep-other-preview.us-east-1.aws.neon.tech"] },
    ),
    true,
  );
  assert.equal(
    isProtectedProductionTarget(
      { host: "ep-custom-id-abc.c-11.us-east-1.aws.neon.tech", database: "neondb" },
      { productionDbId: "ep-custom-id-abc" },
    ),
    true,
  );
});

test("assertDestructiveDatabaseAllowed throws the production refusal", () => {
  assert.throws(
    () =>
      assertDestructiveDatabaseAllowed("db:seed", {
        databaseUrl: DIRECT,
        allowDestructiveSeed: "1",
      }),
    (error: unknown) =>
      error instanceof Error && error.message === PROTECTED_PRODUCTION_REFUSAL,
  );
});

test("seed and reset entry points still hard-guard production", () => {
  const root = path.join(import.meta.dirname, "../..");
  const seed = readFileSync(path.join(root, "prisma/seed.ts"), "utf8");
  const reset = readFileSync(path.join(root, "scripts/db-reset.ts"), "utf8");
  assert.match(seed, /assertDestructiveDatabaseAllowed\("db:seed"\)/);
  assert.match(reset, /assertDestructiveDatabaseAllowed\("db:reset"\)/);
});

test("vercel build, postinstall, and npm test do not invoke prisma seed", () => {
  const root = path.join(import.meta.dirname, "../..");
  const vercelBuild = readFileSync(path.join(root, "scripts/vercel-build.sh"), "utf8");
  const generate = readFileSync(path.join(root, "scripts/prisma-generate.sh"), "utf8");
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
    prisma?: { seed?: string };
  };

  assert.doesNotMatch(vercelBuild, /db:seed|prisma\/seed/);
  assert.doesNotMatch(generate, /db:seed|prisma\/seed/);
  assert.doesNotMatch(pkg.scripts.postinstall ?? "", /db:seed|prisma\/seed/);
  assert.doesNotMatch(pkg.scripts.test ?? "", /db:seed|prisma\/seed/);
  assert.doesNotMatch(pkg.scripts.build ?? "", /db:seed|prisma\/seed/);
  assert.match(pkg.scripts["db:seed"] ?? "", /prisma\/seed/);
});
