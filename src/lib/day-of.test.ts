import assert from "node:assert/strict";
import { test } from "node:test";
import {
  composeDayOfView,
  formatMinutesUntil,
  formatWeddingClock,
  parseDayOfAsOf,
  pickDayOfContacts,
  pickResponsibilities,
  positionDayOfSchedule,
  resolveDayOfMode,
  toDayOfBlock,
  weddingLocalMinuteKey,
  type DayOfBlock,
} from "./day-of";
import {
  morningOverlapFixtureBlocks,
  productionWeddingTimelineFixtureBlocks,
  resolveDayOfUiFixture,
} from "./day-of-fixtures";
import { getWeddingPhase } from "./wedding-phase";

function ids(moments: Array<{ id: string }> | null | undefined): string[] {
  return (moments ?? []).map((row) => row.id);
}

const DETROIT = "America/Detroit";
const WEDDING = new Date("2026-10-16T16:00:00.000Z");

function detroit(stamp: string): Date {
  return new Date(`${stamp}-04:00`);
}

function block(
  id: string,
  startAt: string,
  endAt: string | null,
  notes = id,
  sortOrder = 0,
): DayOfBlock {
  return toDayOfBlock({ id, startAt, endAt, notes, sortOrder });
}

const SCHEDULE: DayOfBlock[] = [
  block("photos", "10:30 AM", "11:15 AM", "Bridal party photos\nLocation: Garden Terrace", 0),
  block("portraits", "11:30 AM", "11:50 AM", "Family portraits", 1),
  block("hideaway", "11:55 AM", "12:45 PM", "Hide away for ceremony", 2),
  block("ceremony", "1:00 PM", "1:45 PM", "Ceremony", 3),
  block("cocktails", "1:45 PM", "3:00 PM", "Cocktail hour", 4),
  block("dinner", "3:00 PM", "5:00 PM", "Dinner", 5),
  block("after", "12:30 AM", "2:00 AM", "After party", 6),
];

function positionAt(stamp: string, blocks: DayOfBlock[] = SCHEDULE) {
  return positionDayOfSchedule(blocks, { now: detroit(stamp), timezone: DETROIT });
}

test("wedding-local clock uses AppSettings timezone, not the server zone", () => {
  const now = detroit("2026-10-16T10:42:00");
  assert.equal(formatWeddingClock(now, DETROIT), "10:42 AM");
  assert.equal(weddingLocalMinuteKey(now, DETROIT), 10 * 60 + 42);
});

test("after-midnight minute keys stay on dayOffset 1", () => {
  const late = detroit("2026-10-17T00:30:00");
  assert.equal(weddingLocalMinuteKey(late, DETROIT), 1440 + 30);
  assert.equal(formatWeddingClock(late, DETROIT), "12:30 AM");
});

test("12:30 AM is sequenced after 10:00 AM, never before it", () => {
  const morning = block("morning", "10:00 AM", "11:00 AM", "Morning", 0);
  const late = block("late", "12:30 AM", "2:00 AM", "Late", 1);
  const ordered = positionDayOfSchedule([late, morning], {
    now: detroit("2026-10-16T10:30:00"),
    timezone: DETROIT,
  });
  assert.deepEqual(
    ordered.fullDay.map((row) => row.id),
    ["morning", "late"],
  );
  assert.equal(ordered.now?.id, "morning");
});

test("before the first block is not treated as NOW", () => {
  const pos = positionAt("2026-10-16T09:00:00");
  assert.equal(pos.kind, "before_first");
  assert.equal(pos.now, null);
  assert.deepEqual(ids(pos.nowBlocks), []);
  assert.equal(pos.next?.id, "photos");
  assert.deepEqual(ids(pos.nextBlocks), ["photos"]);
  assert.equal(pos.minutesUntilNext, 90);
});

test("startAt is inclusive and endAt is exclusive", () => {
  const atStart = positionAt("2026-10-16T10:30:00");
  assert.equal(atStart.kind, "during");
  assert.equal(atStart.now?.id, "photos");
  assert.deepEqual(ids(atStart.nowBlocks), ["photos"]);
  assert.equal(atStart.next?.id, "portraits");
  assert.deepEqual(ids(atStart.nextBlocks), ["portraits"]);

  const atEnd = positionAt("2026-10-16T11:15:00");
  assert.equal(atEnd.kind, "between");
  assert.equal(atEnd.now, null);
  assert.deepEqual(ids(atEnd.nowBlocks), []);
  assert.equal(atEnd.next?.id, "portraits");
});

test("a block that starts at the previous endAt becomes NOW", () => {
  const abutting = [
    block("a", "10:30 AM", "11:15 AM", "A", 0),
    block("b", "11:15 AM", "12:00 PM", "B", 1),
  ];
  const pos = positionDayOfSchedule(abutting, {
    now: detroit("2026-10-16T11:15:00"),
    timezone: DETROIT,
  });
  assert.equal(pos.kind, "during");
  assert.equal(pos.now?.id, "b");
  assert.equal(pos.next, null);
});

test("between blocks is a gap, not the previous event", () => {
  const pos = positionAt("2026-10-16T11:20:00");
  assert.equal(pos.kind, "between");
  assert.equal(pos.now, null);
  assert.equal(pos.next?.id, "portraits");
  assert.equal(pos.afterNext?.id, "hideaway");
  assert.equal(pos.minutesUntilNext, 10);
});

test("during a later event keeps the next upcoming block", () => {
  const pos = positionAt("2026-10-16T13:10:00");
  assert.equal(pos.kind, "during");
  assert.equal(pos.now?.id, "ceremony");
  assert.equal(pos.next?.id, "cocktails");
  assert.equal(pos.afterNext?.id, "dinner");
  assert.equal(
    pos.laterToday.map((row) => row.id).includes("ceremony"),
    false,
  );
});

test("after the final daytime block, late-night remains next", () => {
  const pos = positionAt("2026-10-16T17:30:00");
  assert.equal(pos.kind, "between");
  assert.equal(pos.now, null);
  assert.equal(pos.next?.id, "after");
});

test("after the final block including after midnight", () => {
  const pos = positionAt("2026-10-17T02:00:00");
  assert.equal(pos.kind, "after_final");
  assert.equal(pos.now, null);
  assert.equal(pos.next, null);
});

test("during the after-midnight block", () => {
  const pos = positionAt("2026-10-17T00:45:00");
  assert.equal(pos.kind, "during");
  assert.equal(pos.now?.id, "after");
  assert.equal(pos.next, null);
});

test("missing endAt stays current until the next start, and does not invent a duration", () => {
  const open = [
    block("open", "10:00 AM", null, "Open", 0),
    block("next", "11:30 AM", "12:00 PM", "Next", 1),
  ];
  const during = positionDayOfSchedule(open, {
    now: detroit("2026-10-16T11:00:00"),
    timezone: DETROIT,
  });
  assert.equal(during.kind, "during");
  assert.equal(during.now?.id, "open");
  assert.equal(during.now?.timeLabel, "10:00 AM");

  const atNext = positionDayOfSchedule(open, {
    now: detroit("2026-10-16T11:30:00"),
    timezone: DETROIT,
  });
  assert.equal(atNext.kind, "during");
  assert.equal(atNext.now?.id, "next");
});

test("empty schedule", () => {
  const pos = positionDayOfSchedule([], {
    now: detroit("2026-10-16T10:00:00"),
    timezone: DETROIT,
  });
  assert.equal(pos.kind, "empty");
  assert.equal(pos.now, null);
  assert.equal(pos.next, null);
});

test("formatMinutesUntil never returns a negative phrase", () => {
  assert.equal(formatMinutesUntil(null), null);
  assert.equal(formatMinutesUntil(0), null);
  assert.equal(formatMinutesUntil(-4), null);
  assert.equal(formatMinutesUntil(1), "In 1 minute");
  assert.equal(formatMinutesUntil(38), "In 38 minutes");
  assert.equal(formatMinutesUntil(60), "In 1 hour");
  assert.equal(formatMinutesUntil(90), "In 1 hr 30 min");
});

test("preview and completed modes do not invent a live NOW", () => {
  const previewPhase = getWeddingPhase({
    weddingDate: WEDDING,
    timezone: DETROIT,
    now: detroit("2026-10-09T10:42:00"),
  });
  const preview = composeDayOfView({
    phase: previewPhase,
    now: detroit("2026-10-09T10:42:00"),
    coupleNames: "David & Haley",
    weddingDateLabel: "Friday, October 16, 2026",
    blocks: SCHEDULE,
    contacts: [],
    assignments: [],
    linkedPersonId: "david",
    canSeeContacts: true,
  });
  assert.equal(preview.mode, "preview");
  assert.equal(preview.position.now, null);
  assert.equal(preview.position.next, null);
  assert.deepEqual(ids(preview.position.nowBlocks), []);
  assert.deepEqual(ids(preview.position.nextBlocks), []);
  assert.ok(preview.position.fullDay.length > 0);

  const completedPhase = getWeddingPhase({
    weddingDate: WEDDING,
    timezone: DETROIT,
    now: detroit("2026-10-17T10:42:00"),
  });
  const completed = composeDayOfView({
    phase: completedPhase,
    now: detroit("2026-10-17T10:42:00"),
    coupleNames: "David & Haley",
    weddingDateLabel: "Friday, October 16, 2026",
    blocks: SCHEDULE,
    contacts: [],
    assignments: [],
    linkedPersonId: "david",
    canSeeContacts: true,
  });
  assert.equal(completed.mode, "completed");
  assert.equal(completed.position.now, null);
  assert.deepEqual(ids(completed.position.nowBlocks), []);
  assert.equal(completed.position.kind, "after_final");
});

test("late night after the wedding calendar date stays live until 5am", () => {
  const late = detroit("2026-10-17T01:10:00");
  const phase = getWeddingPhase({ weddingDate: WEDDING, timezone: DETROIT, now: late });
  assert.equal(phase.phase, "post_wedding");
  assert.equal(resolveDayOfMode(phase.phase, late, DETROIT), "live");
});

test("asOf is ignored in production and accepted in non-production", () => {
  assert.equal(parseDayOfAsOf("2026-10-16T14:30:00.000Z", DETROIT, "production"), undefined);
  assert.equal(parseDayOfAsOf("2026-10-16", DETROIT, "production"), undefined);
  const dateOnly = parseDayOfAsOf("2026-10-16", DETROIT, "test");
  assert.ok(dateOnly);
  assert.equal(
    dateOnly.toLocaleDateString("en-CA", { timeZone: DETROIT }),
    "2026-10-16",
  );
  const stamped = parseDayOfAsOf("2026-10-16T10:30:00-04:00", DETROIT, "test");
  assert.ok(stamped);
  assert.equal(formatWeddingClock(stamped, DETROIT), "10:30 AM");
});

test("responsibilities require an exact linkedPersonId", () => {
  const assignments = [
    {
      id: "rings",
      title: "Bring rings to ceremony",
      notes: null,
      sortOrder: 0,
      assignees: [{ personId: "david" }],
    },
    {
      id: "garden",
      title: "Meet photographer at garden",
      notes: "Garden terrace",
      sortOrder: 1,
      assignees: [{ personId: "haley" }],
    },
  ];
  const david = pickResponsibilities(assignments, "david");
  assert.deepEqual(
    david.map((row) => row.id),
    ["rings"],
  );
  assert.equal(pickResponsibilities(assignments, null).length, 0);
  assert.equal(pickResponsibilities(assignments, "someone-else").length, 0);
});

test("contacts prefer isDayOfContact then stored sortOrder, never name guesses", () => {
  const contacts = pickDayOfContacts([
    {
      id: "dj",
      name: "A DJ Person",
      directoryLabel: "DJ",
      phone: "111",
      email: null,
      sortOrder: 9,
      isDayOfContact: false,
    },
    {
      id: "planner",
      name: "Z Planner",
      directoryLabel: "Planner",
      phone: "222",
      email: "p@example.com",
      sortOrder: 2,
      isDayOfContact: true,
    },
    {
      id: "photo",
      name: "M Photo",
      directoryLabel: "Photographer",
      phone: null,
      email: null,
      sortOrder: 1,
      isDayOfContact: true,
      personId: "barry",
      personName: "Barry Tilson",
    },
  ]);
  assert.deepEqual(
    contacts.map((row) => row.id),
    ["photo", "planner"],
  );
  assert.equal(contacts[0]?.name, "Barry Tilson");
  assert.equal(contacts[0]?.context, "Photographer");
});

test("one active block still fills nowBlocks as a single-item group", () => {
  const pos = positionAt("2026-10-16T13:10:00");
  assert.equal(pos.kind, "during");
  assert.deepEqual(ids(pos.nowBlocks), ["ceremony"]);
  assert.equal(pos.now?.id, "ceremony");
  assert.deepEqual(ids(pos.nextBlocks), ["cocktails"]);
  assert.deepEqual(ids(pos.afterNextBlocks), ["dinner"]);
});

test("two overlapping blocks are both active at 10:42", () => {
  const overlap = [
    block("settle", "9:00 AM", "11:00 AM", "Settle", 0),
    block("vendor", "10:30 AM", "12:30 PM", "Vendor", 1),
    block("diy", "11:00 AM", "11:45 AM", "DIY", 2),
  ];
  const pos = positionAt("2026-10-16T10:42:00", overlap);
  assert.equal(pos.kind, "during");
  assert.deepEqual(ids(pos.nowBlocks), ["settle", "vendor"]);
  assert.deepEqual(ids(pos.nextBlocks), ["diy"]);
  assert.equal(pos.next?.startAt, "11:00 AM");
  assert.notEqual(pos.now, pos.nowBlocks[0]);
  assert.notEqual(pos.next, pos.nextBlocks[0]);
});

test("activeBlocks keep wedding sequence, not alphabetical titles", () => {
  const overlap = [
    block("zebra", "10:30 AM", "12:30 PM", "Zebra arrival", 1),
    block("airbnb", "9:00 AM", "11:00 AM", "Airbnb settle", 0),
  ];
  const pos = positionAt("2026-10-16T10:42:00", overlap);
  assert.deepEqual(ids(pos.nowBlocks), ["airbnb", "zebra"]);
  assert.deepEqual(
    pos.nowBlocks.map((row) => row.title),
    ["Airbnb settle", "Zebra arrival"],
  );
});

test("NEXT during overlap is the nearest future start, not an active block", () => {
  const overlap = [
    block("settle", "9:00 AM", "11:00 AM", "Settle", 0),
    block("vendor", "10:30 AM", "12:30 PM", "Vendor", 1),
    block("diy", "11:00 AM", "11:45 AM", "DIY", 2),
  ];
  const pos = positionAt("2026-10-16T10:42:00", overlap);
  assert.ok(!ids(pos.nextBlocks).includes("settle"));
  assert.ok(!ids(pos.nextBlocks).includes("vendor"));
  assert.deepEqual(ids(pos.nextBlocks), ["diy"]);
});

test("two blocks that share the nearest future start both appear in nextBlocks", () => {
  const overlap = [
    block("settle", "9:00 AM", "11:00 AM", "Settle", 0),
    block("hair", "11:00 AM", "11:30 AM", "Hair", 1),
    block("makeup", "11:00 AM", "11:45 AM", "Makeup", 2),
  ];
  const pos = positionAt("2026-10-16T10:42:00", overlap);
  assert.deepEqual(ids(pos.nowBlocks), ["settle"]);
  assert.deepEqual(ids(pos.nextBlocks), ["hair", "makeup"]);
});

test("AFTER THAT skips the entire NEXT start group", () => {
  const overlap = [
    block("settle", "9:00 AM", "11:00 AM", "Settle", 0),
    block("hair", "11:00 AM", "11:30 AM", "Hair", 1),
    block("makeup", "11:00 AM", "11:45 AM", "Makeup", 2),
    block("pack", "11:45 AM", null, "Pack", 3),
  ];
  const pos = positionAt("2026-10-16T10:42:00", overlap);
  assert.deepEqual(ids(pos.nextBlocks), ["hair", "makeup"]);
  assert.deepEqual(ids(pos.afterNextBlocks), ["pack"]);
  assert.equal(pos.afterNext?.startAt, "11:45 AM");
});

test("before first event can show multiple simultaneous NEXT blocks", () => {
  const simultaneous = [
    block("airbnb", "10:00 AM", "11:00 AM", "Airbnb", 0),
    block("venue", "10:00 AM", "12:00 PM", "Venue", 1),
    block("later", "1:00 PM", "2:00 PM", "Later", 2),
  ];
  const pos = positionAt("2026-10-16T09:00:00", simultaneous);
  assert.equal(pos.kind, "before_first");
  assert.deepEqual(ids(pos.nowBlocks), []);
  assert.deepEqual(ids(pos.nextBlocks), ["airbnb", "venue"]);
  assert.deepEqual(ids(pos.afterNextBlocks), ["later"]);
});

test("gap behavior still uses breathing-room kind with future-start NEXT", () => {
  const pos = positionAt("2026-10-16T11:20:00");
  assert.equal(pos.kind, "between");
  assert.deepEqual(ids(pos.nowBlocks), []);
  assert.deepEqual(ids(pos.nextBlocks), ["portraits"]);
  assert.deepEqual(ids(pos.afterNextBlocks), ["hideaway"]);
});

test("exact start activates the new overlapping block without dropping the earlier one", () => {
  const overlap = [
    block("settle", "9:00 AM", "11:00 AM", "Settle", 0),
    block("vendor", "10:30 AM", "12:30 PM", "Vendor", 1),
  ];
  const before = positionAt("2026-10-16T10:29:00", overlap);
  assert.deepEqual(ids(before.nowBlocks), ["settle"]);
  const atStart = positionAt("2026-10-16T10:30:00", overlap);
  assert.deepEqual(ids(atStart.nowBlocks), ["settle", "vendor"]);
});

test("exact end removes only the ended block", () => {
  const overlap = [
    block("settle", "9:00 AM", "11:00 AM", "Settle", 0),
    block("vendor", "10:30 AM", "12:30 PM", "Vendor", 1),
    block("diy", "11:00 AM", "11:45 AM", "DIY", 2),
  ];
  const atEnd = positionAt("2026-10-16T11:00:00", overlap);
  assert.deepEqual(ids(atEnd.nowBlocks), ["vendor", "diy"]);
  assert.ok(!ids(atEnd.nowBlocks).includes("settle"));
});

test("one overlapping block can remain after the other ends", () => {
  const overlap = [
    block("settle", "9:00 AM", "11:00 AM", "Settle", 0),
    block("vendor", "10:30 AM", "12:30 PM", "Vendor", 1),
  ];
  const pos = positionAt("2026-10-16T11:00:00", overlap);
  assert.equal(pos.kind, "during");
  assert.deepEqual(ids(pos.nowBlocks), ["vendor"]);
});

test("after every bounded overlap ends, breathing room or completion is restored", () => {
  const overlap = [
    block("settle", "9:00 AM", "11:00 AM", "Settle", 0),
    block("vendor", "10:30 AM", "12:30 PM", "Vendor", 1),
    block("diy", "11:00 AM", "11:45 AM", "DIY", 2),
  ];
  const gap = positionAt("2026-10-16T12:30:00", [
    ...overlap,
    block("dinner", "3:00 PM", "5:00 PM", "Dinner", 3),
  ]);
  assert.equal(gap.kind, "between");
  assert.deepEqual(ids(gap.nowBlocks), []);
  assert.deepEqual(ids(gap.nextBlocks), ["dinner"]);

  const done = positionAt("2026-10-16T12:30:00", overlap);
  assert.equal(done.kind, "after_final");
  assert.deepEqual(ids(done.nowBlocks), []);
  assert.deepEqual(ids(done.nextBlocks), []);
});

test("late-night dayOffset overlap still sequences after daytime", () => {
  const blocks = [
    block("dinner", "3:00 PM", "5:00 PM", "Dinner", 0),
    block("after", "12:30 AM", "2:00 AM", "After party", 1),
    block("late-snack", "12:30 AM", "1:15 AM", "Late snack", 2),
  ];
  const evening = positionAt("2026-10-16T16:00:00", blocks);
  assert.deepEqual(ids(evening.nowBlocks), ["dinner"]);
  assert.deepEqual(ids(evening.nextBlocks), ["after", "late-snack"]);

  const late = positionAt("2026-10-17T00:45:00", blocks);
  assert.deepEqual(ids(late.nowBlocks), ["after", "late-snack"]);
  assert.deepEqual(ids(late.nextBlocks), []);
});

test("open-ended block is not closed by a same-start parallel block", () => {
  const open = [
    block("venue", "10:30 AM", null, "Venue open", 0),
    block("vendor", "10:30 AM", "12:30 PM", "Vendor arrival", 1),
    block("diy", "11:00 AM", "11:45 AM", "DIY", 2),
  ];
  const pos = positionAt("2026-10-16T10:42:00", open);
  assert.deepEqual(ids(pos.nowBlocks), ["venue", "vendor"]);
  assert.deepEqual(ids(pos.nextBlocks), ["diy"]);
});

test("open-ended block still ends at the next strictly later start", () => {
  const open = [
    block("open", "10:00 AM", null, "Open", 0),
    block("next", "11:30 AM", "12:00 PM", "Next", 1),
  ];
  const during = positionAt("2026-10-16T11:00:00", open);
  assert.deepEqual(ids(during.nowBlocks), ["open"]);
  const atNext = positionAt("2026-10-16T11:30:00", open);
  assert.deepEqual(ids(atNext.nowBlocks), ["next"]);
  assert.ok(!ids(atNext.nowBlocks).includes("open"));
});

test("production-style morning overlap at 10:42 AM", () => {
  const pos = positionAt("2026-10-16T10:42:00", morningOverlapFixtureBlocks());
  assert.equal(pos.kind, "during");
  assert.deepEqual(
    pos.nowBlocks.map((row) => row.title),
    ["Settle in at Airbnb", "Vendor + Wedding Party Arrival"],
  );
  assert.deepEqual(
    pos.nextBlocks.map((row) => ({ title: row.title, startAt: row.startAt })),
    [{ title: "Wedding party DIY hair & makeup", startAt: "11:00 AM" }],
  );
  assert.deepEqual(
    pos.afterNextBlocks.map((row) => ({ title: row.title, startAt: row.startAt })),
    [{ title: "Wedding party packs up", startAt: "11:45 AM" }],
  );
});

test("production 19-row wedding timeline at 10:42 AM", () => {
  const fixture = productionWeddingTimelineFixtureBlocks();
  assert.equal(fixture.length, 19);
  assert.equal(
    fixture.some((row) => /rehearsal/i.test(row.notes)),
    false,
  );
  const pos = positionAt("2026-10-16T10:42:00", fixture);
  assert.equal(pos.kind, "during");
  assert.deepEqual(
    pos.nowBlocks.map((row) => row.title),
    [
      "Settle in at Airbnb",
      "Venue Opens",
      "Vendor + Wedding Party Arrival",
    ],
  );
  assert.deepEqual(
    pos.nextBlocks.map((row) => ({ title: row.title, startAt: row.startAt })),
    [{ title: "Wedding party DIY hair & makeup", startAt: "11:00 AM" }],
  );
  assert.deepEqual(
    pos.afterNextBlocks.map((row) => ({ title: row.title, startAt: row.startAt })),
    [{ title: "Wedding party packs up", startAt: "11:45 AM" }],
  );
});

test("production 19-row wedding timeline later NOW moments", () => {
  const fixture = productionWeddingTimelineFixtureBlocks();
  assert.deepEqual(
    positionAt("2026-10-16T15:35:00", fixture).nowBlocks.map((row) => row.title),
    ["Ceremony"],
  );
  assert.deepEqual(
    positionAt("2026-10-16T17:15:00", fixture).nowBlocks.map((row) => row.title),
    ["Dinner begins"],
  );
  assert.deepEqual(
    positionAt("2026-10-16T19:30:00", fixture).nowBlocks.map((row) => row.title),
    ["Open Dancing"],
  );
  assert.deepEqual(
    positionAt("2026-10-16T22:30:00", fixture).nowBlocks.map((row) => row.title),
    ["Tear down / Clean up"],
  );
});

test("non-production fixture overlay is ignored in production", () => {
  assert.equal(resolveDayOfUiFixture("morning-overlap", "production"), undefined);
  assert.equal(resolveDayOfUiFixture("linear", "production"), undefined);
  assert.equal(resolveDayOfUiFixture("morning-overlap", "test"), "morning-overlap");
  assert.equal(resolveDayOfUiFixture("production-wedding", "production"), undefined);
  assert.equal(resolveDayOfUiFixture("production-wedding", "test"), "production-wedding");
});
