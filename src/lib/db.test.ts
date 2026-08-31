import assert from "node:assert/strict";
import { test } from "node:test";
import { isDatabaseUnreachable, withConnectionTimeouts } from "./db";

test("withConnectionTimeouts adds Neon-friendly timeouts", () => {
  const next = withConnectionTimeouts(
    "postgresql://user:pass@ep-example-pooler.c-11.us-east-1.aws.neon.tech/neondb?sslmode=require",
  );
  const url = new URL(next);
  assert.equal(url.searchParams.get("connect_timeout"), "10");
  assert.equal(url.searchParams.get("pool_timeout"), "10");
  assert.equal(url.searchParams.get("sslmode"), "require");
});

test("isDatabaseUnreachable detects Prisma P1001", () => {
  assert.equal(
    isDatabaseUnreachable(new Error("Can't reach database server at `ep-example.neon.tech:5432`")),
    true,
  );
  assert.equal(isDatabaseUnreachable(new Error("Incorrect PIN")), false);
});
