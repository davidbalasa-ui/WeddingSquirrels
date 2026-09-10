import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMcRunOfShow } from "./mc-run-of-show";
import { type OfflinePack, shouldRefreshOfflinePack } from "./offline-db";
import { playbookByKind } from "./playbook";
import { PRODUCTION_CUE_BLOCKS } from "./mc-cue-fixture";

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

test("offline pack projects MC cues from the same timeline snapshot", () => {
  const pack: OfflinePack = {
    fetchedAt: "2026-09-09T00:00:00Z",
    weddingDate: "2026-10-16",
    coupleNames: "David & Haley",
    timezone: "America/Detroit",
    tasks: [],
    people: [{ name: "Kurt Huizenga", directoryLabel: "MC" }],
    timeline: PRODUCTION_CUE_BLOCKS.map((row, index) => ({
      ...row,
      id: `block-${index}`,
      schedule: "wedding",
    })),
    contacts: [],
    assignments: [],
    guests: [],
    budgetItems: [],
    requests: [],
    shopping: [],
    stay: [],
    playbook: [
      {
        sourceKey: "hm-1100-haley-hair",
        kind: "hair_makeup",
        section: "11:00 AM",
        startAt: "11:00 AM",
        title: "Haley starts hair with Katie",
        detail: "Hair",
        location: "Airbnb",
        notes: null,
        sortOrder: 50,
        completed: false,
      },
    ],
  };
  const show = buildMcRunOfShow(pack.timeline as typeof PRODUCTION_CUE_BLOCKS, pack.people as Array<{ name: string; directoryLabel?: string }>);
  assert.ok(show.cues.length >= 13);
  assert.equal(playbookByKind(pack.playbook as never, "hair_makeup").length, 1);
});
