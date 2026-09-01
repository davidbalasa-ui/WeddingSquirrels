import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldRefreshOfflinePack } from "./offline-db";

test("offline pack refreshes when missing, invalid, or stale", () => {
  const now = new Date("2026-10-16T12:10:00Z");
  assert.equal(shouldRefreshOfflinePack(null, now), true);
  assert.equal(shouldRefreshOfflinePack("not-a-date", now), true);
  assert.equal(
    shouldRefreshOfflinePack("2026-10-16T12:00:00Z", now, 5 * 60 * 1000),
    true,
  );
});

test("offline pack stays fresh inside the sync interval", () => {
  assert.equal(
    shouldRefreshOfflinePack(
      "2026-10-16T12:08:00Z",
      new Date("2026-10-16T12:10:00Z"),
      5 * 60 * 1000,
    ),
    false,
  );
});
