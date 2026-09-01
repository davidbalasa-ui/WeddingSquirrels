import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildDayNowNextSnapshot,
  formatNowClock,
  isWeddingDay,
  matchBlockContacts,
  nowMinuteKey,
  parseBlockNotes,
  pickNowNextBlocks,
  shouldShowDayNowTab,
} from "./day-of-now";

const BLOCKS = [
  {
    id: "settle",
    startAt: "9:00 AM",
    endAt: "11:00 AM",
    notes: "Settle in at Airbnb\nEveryone sets up stations",
    startMinutes: 9 * 60,
    endMinutes: 11 * 60,
    dayOffset: 0,
    sortOrder: 0,
  },
  {
    id: "ceremony",
    startAt: "3:30 PM",
    endAt: "4:00 PM",
    notes: "Ceremony\nUnder the shelter\nLocation: Black Sheep Shelter",
    startMinutes: 15 * 60 + 30,
    endMinutes: 16 * 60,
    dayOffset: 0,
    sortOrder: 1,
  },
  {
    id: "dinner",
    startAt: "5:00 PM",
    endAt: "6:00 PM",
    notes: "Dinner begins\nGuests seated",
    startMinutes: 17 * 60,
    endMinutes: 18 * 60,
    dayOffset: 0,
    sortOrder: 2,
  },
];

test("isWeddingDay and shouldShowDayNowTab", () => {
  assert.equal(isWeddingDay(0), true);
  assert.equal(isWeddingDay(1), false);
  assert.equal(shouldShowDayNowTab(0), true);
  assert.equal(shouldShowDayNowTab(1), true);
  assert.equal(shouldShowDayNowTab(2), false);
});

test("parseBlockNotes extracts title, location, and bullet names", () => {
  const parsed = parseBlockNotes(
    "Depart Airbnb\nDrive time 25–30 minutes\nLocation: Hawkshead, 523 Hawks Nest Dr\n· Vendors\n· Coordinator (Avalon)",
  );

  assert.equal(parsed.title, "Depart Airbnb");
  assert.equal(parsed.location, "Hawkshead, 523 Hawks Nest Dr");
  assert.deepEqual(parsed.involvedNames, ["Vendors", "Coordinator (Avalon)"]);
});

test("pickNowNextBlocks finds active and next blocks", () => {
  const atCeremony = pickNowNextBlocks(BLOCKS, {
    now: new Date("2026-10-16T15:45:00"),
  });

  assert.equal(atCeremony.now?.id, "ceremony");
  assert.equal(atCeremony.next?.id, "dinner");
  assert.equal(atCeremony.betweenMoments, false);
});

test("pickNowNextBlocks marks between moments when nothing is active", () => {
  const between = pickNowNextBlocks(BLOCKS, {
    now: new Date("2026-10-16T12:30:00"),
  });

  assert.equal(between.now, null);
  assert.equal(between.next?.id, "ceremony");
  assert.equal(between.betweenMoments, true);
});

test("matchBlockContacts links vendor names mentioned in notes", () => {
  const contacts = matchBlockContacts(
    "Venue Opens\nCoordinator (Avalon)\nPhotographer arrives",
    [
      {
        id: "c1",
        name: "Avalon Green · Planner",
        phone: "(386) 589-7215",
        email: null,
        photoData: null,
      },
      {
        id: "c2",
        name: "Barry Tilson · Photographer",
        phone: "(248) 704-3731",
        email: null,
        photoData: null,
      },
    ],
    [],
  );

  assert.equal(contacts.length, 2);
  assert.equal(contacts[0]?.name, "Avalon Green");
  assert.equal(contacts[1]?.name, "Barry Tilson");
});

test("buildDayNowNextSnapshot shapes now and next cards", () => {
  const snapshot = buildDayNowNextSnapshot(BLOCKS, [], [], {
    daysToGo: 0,
    now: new Date("2026-10-16T15:45:00"),
  });

  assert.equal(snapshot.isWeddingDay, true);
  assert.equal(snapshot.now?.status, "now");
  assert.equal(snapshot.now?.title, "Ceremony");
  assert.equal(snapshot.next?.status, "next");
  assert.equal(snapshot.next?.title, "Dinner begins");
  assert.equal(snapshot.upcoming.length, 0);
});

test("formatNowClock and nowMinuteKey", () => {
  const now = new Date("2026-10-16T15:45:00");
  assert.equal(nowMinuteKey(now), 15 * 60 + 45);
  assert.equal(formatNowClock(now), "3:45 PM");
});
