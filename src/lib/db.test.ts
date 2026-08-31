import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createPrismaClient,
  isDatabaseUnreachable,
  isNeonDatabaseUrl,
  prismaErrorCode,
  selectDatabaseTransport,
} from "./db";

test("Neon URLs select the serverless WebSocket transport", () => {
  assert.equal(
    selectDatabaseTransport(
      "postgresql://example:secret@ep-example-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require",
    ),
    "neon-websocket",
  );
  assert.equal(isNeonDatabaseUrl("postgresql://localhost:5432/wedding"), false);
  assert.equal(selectDatabaseTransport("not a url"), "native");
  assert.equal(selectDatabaseTransport(undefined), "native");
});

test("createPrismaClient preserves the Prisma Client API with the Neon adapter", async () => {
  const client = createPrismaClient(
    "postgresql://example:secret@ep-example-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require",
  );

  assert.equal(typeof client.pinAccount.count, "function");
  assert.equal(typeof client.$transaction, "function");
  await client.$disconnect();
});

test("isDatabaseUnreachable detects Prisma P1001", () => {
  assert.equal(
    isDatabaseUnreachable(new Error("Can't reach database server at `ep-example.neon.tech:5432`")),
    true,
  );
  assert.equal(isDatabaseUnreachable(new Error("Incorrect PIN")), false);
});

test("prismaErrorCode reads Prisma error codes", () => {
  assert.equal(prismaErrorCode({ code: "P1001" }), "P1001");
  assert.equal(prismaErrorCode(new Error("nope")), "");
});
