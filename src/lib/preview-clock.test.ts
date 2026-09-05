import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appendPreviewAsOf,
  buildPreviewPresets,
  canShowPreviewHarness,
  instantAtLocalClock,
  isTemporalPreviewAllowed,
} from "./preview-clock";

const DETROIT = "America/Detroit";
const WEDDING = new Date("2026-10-16T16:00:00.000Z");

test("temporal preview is blocked on real Vercel production", () => {
  assert.equal(isTemporalPreviewAllowed({ NODE_ENV: "production", VERCEL_ENV: "production" }), false);
});

test("temporal preview is available on Vercel Preview even when NODE_ENV is production", () => {
  assert.equal(isTemporalPreviewAllowed({ NODE_ENV: "production", VERCEL_ENV: "preview" }), true);
});

test("temporal preview is available in local development", () => {
  assert.equal(isTemporalPreviewAllowed({ NODE_ENV: "development" }), true);
  assert.equal(isTemporalPreviewAllowed({ NODE_ENV: "test" }), true);
});

test("local production-mode start without VERCEL_ENV stays closed", () => {
  assert.equal(isTemporalPreviewAllowed({ NODE_ENV: "production" }), false);
});

test("preview harness is master-only", () => {
  assert.equal(
    canShowPreviewHarness({ isMaster: false, env: { NODE_ENV: "development" } }),
    false,
  );
  assert.equal(
    canShowPreviewHarness({ isMaster: true, env: { VERCEL_ENV: "production" } }),
    false,
  );
  assert.equal(
    canShowPreviewHarness({ isMaster: true, env: { NODE_ENV: "development" } }),
    true,
  );
});

test("10:42 AM preset lands on Detroit wedding-morning overlap", () => {
  const presets = buildPreviewPresets(WEDDING, DETROIT);
  const overlap = presets.find((row) => row.id === "overlap");
  assert.ok(overlap);
  const clock = new Date(overlap.asOf).toLocaleTimeString("en-US", {
    timeZone: DETROIT,
    hour: "numeric",
    minute: "2-digit",
  });
  assert.equal(clock, "10:42 AM");
  assert.equal(
    new Date(overlap.asOf).toLocaleDateString("en-CA", { timeZone: DETROIT }),
    "2026-10-16",
  );
});

test("appendPreviewAsOf only adds a query param and never invents a clock", () => {
  assert.equal(appendPreviewAsOf("/today", null), "/today");
  assert.equal(
    appendPreviewAsOf("/day", "2026-10-16T14:42:00.000Z"),
    "/day?asOf=2026-10-16T14%3A42%3A00.000Z",
  );
  assert.equal(
    appendPreviewAsOf("/day", "2026-10-16T14:42:00.000Z", "production-wedding"),
    "/day?asOf=2026-10-16T14%3A42%3A00.000Z&fixture=production-wedding",
  );
});

test("instantAtLocalClock respects America/Detroit on wedding day", () => {
  const ceremony = instantAtLocalClock("2026-10-16", 15, 35, DETROIT);
  assert.equal(
    ceremony.toLocaleTimeString("en-US", {
      timeZone: DETROIT,
      hour: "numeric",
      minute: "2-digit",
    }),
    "3:35 PM",
  );
});
