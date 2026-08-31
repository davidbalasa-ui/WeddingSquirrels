import assert from "node:assert/strict";
import { test } from "node:test";
import { isDatabaseUnreachable, prismaErrorCode } from "./db";

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
