import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addCalendarDays,
  calendarDateKey,
  calendarDaysBetween,
  getWeddingPhase,
  instantOnCalendarDate,
  phaseForDaysUntil,
  usesExecutionLayout,
  weddingPhaseHeroCopy,
} from "./wedding-phase";

const DETROIT = "America/Detroit";
const WEDDING = new Date("2026-10-16T16:00:00.000Z");

function phaseAt(iso: string) {
  return getWeddingPhase({
    weddingDate: WEDDING,
    timezone: DETROIT,
    now: new Date(iso),
  });
}

test("8 days before is planning", () => {
  const info = getWeddingPhase({
    weddingDate: WEDDING,
    timezone: DETROIT,
    now: instantOnCalendarDate("2026-10-08", DETROIT),
  });
  assert.equal(info.phase, "planning");
  assert.equal(info.daysUntilWedding, 8);
  assert.equal(usesExecutionLayout(info.phase), false);
});

test("7 days before is wedding_week", () => {
  const info = getWeddingPhase({
    weddingDate: WEDDING,
    timezone: DETROIT,
    now: instantOnCalendarDate("2026-10-09", DETROIT),
  });
  assert.equal(info.phase, "wedding_week");
  assert.equal(info.daysUntilWedding, 7);
  assert.equal(usesExecutionLayout(info.phase), true);
});

test("2 days before is wedding_week", () => {
  const info = getWeddingPhase({
    weddingDate: WEDDING,
    timezone: DETROIT,
    now: instantOnCalendarDate("2026-10-14", DETROIT),
  });
  assert.equal(info.phase, "wedding_week");
  assert.equal(info.daysUntilWedding, 2);
});

test("1 day before is day_before", () => {
  const info = getWeddingPhase({
    weddingDate: WEDDING,
    timezone: DETROIT,
    now: instantOnCalendarDate("2026-10-15", DETROIT),
  });
  assert.equal(info.phase, "day_before");
  assert.equal(info.daysUntilWedding, 1);
});

test("wedding date is wedding_day", () => {
  const info = getWeddingPhase({
    weddingDate: WEDDING,
    timezone: DETROIT,
    now: instantOnCalendarDate("2026-10-16", DETROIT),
  });
  assert.equal(info.phase, "wedding_day");
  assert.equal(info.daysUntilWedding, 0);
});

test("after wedding is post_wedding", () => {
  const info = getWeddingPhase({
    weddingDate: WEDDING,
    timezone: DETROIT,
    now: instantOnCalendarDate("2026-10-17", DETROIT),
  });
  assert.equal(info.phase, "post_wedding");
  assert.equal(info.daysUntilWedding, -1);
  assert.equal(usesExecutionLayout(info.phase), false);
});

test("timezone boundary uses AppSettings timezone, not UTC midnight", () => {
  // 2026-10-16T03:30:00Z is still Oct 15 in Detroit (EDT, UTC-4).
  const lateDetroit = phaseAt("2026-10-16T03:30:00.000Z");
  assert.equal(calendarDateKey(new Date("2026-10-16T03:30:00.000Z"), DETROIT), "2026-10-15");
  assert.equal(lateDetroit.phase, "day_before");
  assert.equal(lateDetroit.daysUntilWedding, 1);

  // 2026-10-16T04:30:00Z is Oct 16 12:30am in Detroit.
  const earlyDetroit = phaseAt("2026-10-16T04:30:00.000Z");
  assert.equal(calendarDateKey(new Date("2026-10-16T04:30:00.000Z"), DETROIT), "2026-10-16");
  assert.equal(earlyDetroit.phase, "wedding_day");
  assert.equal(earlyDetroit.daysUntilWedding, 0);
});

test("DST spring-forward does not produce off-by-one day behavior", () => {
  // America/Detroit springs forward 2026-03-08 02:00 → 03:00.
  const wedding = new Date("2026-03-09T16:00:00.000Z");
  const before = getWeddingPhase({
    weddingDate: wedding,
    timezone: DETROIT,
    now: new Date("2026-03-07T23:30:00-05:00"),
  });
  assert.equal(before.todayKey, "2026-03-07");
  assert.equal(before.daysUntilWedding, 2);
  assert.equal(before.phase, "wedding_week");

  const afterSpring = getWeddingPhase({
    weddingDate: wedding,
    timezone: DETROIT,
    now: new Date("2026-03-08T03:30:00-04:00"),
  });
  assert.equal(afterSpring.todayKey, "2026-03-08");
  assert.equal(afterSpring.daysUntilWedding, 1);
  assert.equal(afterSpring.phase, "day_before");

  const rawHours = (wedding.getTime() - new Date("2026-03-07T23:30:00-05:00").getTime()) / 3_600_000;
  assert.ok(rawHours < 48, "raw hours would be a confusing 24-hour difference");
  assert.equal(calendarDaysBetween(new Date("2026-03-07T23:30:00-05:00"), wedding, DETROIT), 2);
});

test("phaseForDaysUntil matches product boundaries", () => {
  assert.equal(phaseForDaysUntil(8), "planning");
  assert.equal(phaseForDaysUntil(7), "wedding_week");
  assert.equal(phaseForDaysUntil(2), "wedding_week");
  assert.equal(phaseForDaysUntil(1), "day_before");
  assert.equal(phaseForDaysUntil(0), "wedding_day");
  assert.equal(phaseForDaysUntil(-1), "post_wedding");
});

test("hero copy never claims readiness and post-wedding has no countdown", () => {
  const week = weddingPhaseHeroCopy("wedding_week", 7);
  assert.equal(week.kicker, "7 DAYS");
  assert.equal(week.lede, "One week to go.");
  assert.match(week.lede ?? "", /week/i);
  assert.doesNotMatch(week.lede ?? "", /ready/i);

  const almost = weddingPhaseHeroCopy("wedding_week", 3);
  assert.equal(almost.lede, "Almost here.");

  const before = weddingPhaseHeroCopy("day_before", 1);
  assert.equal(before.kicker, "TOMORROW");

  const day = weddingPhaseHeroCopy("wedding_day", 0);
  assert.equal(day.kicker, "TODAY IS THE DAY");

  const after = weddingPhaseHeroCopy("post_wedding", -3);
  assert.equal(after.kicker, "WE DID IT.");
  assert.equal(after.lede, null);
});

test("addCalendarDays stays on calendar keys", () => {
  assert.equal(addCalendarDays("2026-10-09", 1), "2026-10-10");
  assert.equal(addCalendarDays("2026-03-07", 1), "2026-03-08");
});
