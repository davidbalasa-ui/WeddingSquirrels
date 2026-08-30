import assert from "node:assert/strict";
import test from "node:test";
import { isLocalDatabaseUrl } from "./seed-safety";

test("isLocalDatabaseUrl accepts localhost postgres URLs", () => {
  assert.equal(isLocalDatabaseUrl("postgresql://user:pass@localhost:5432/wedding"), true);
  assert.equal(isLocalDatabaseUrl("postgresql://user:pass@127.0.0.1/wedding"), true);
  assert.equal(isLocalDatabaseUrl("postgresql://user:pass@db:5432/wedding"), true);
});

test("isLocalDatabaseUrl rejects remote hosts", () => {
  assert.equal(
    isLocalDatabaseUrl("postgresql://user:pass@ep-cool-name.us-east-2.aws.neon.tech/neondb"),
    false,
  );
  assert.equal(isLocalDatabaseUrl(""), false);
});
