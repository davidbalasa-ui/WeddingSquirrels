import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AFTER_MIDNIGHT_END_MINUTES,
  applyPeerOrder,
  bucketForTime,
  clockPartsFromRaw,
  compareParsedTimes,
  endsBeforeStart,
  formatClock,
  isTimelineSchedule,
  missingMeridiem,
  normalizeClockHour,
  normalizeClockMinute,
  parseDayOfTime,
  parseTimelineSchedule,
  peerKey,
  prepareTimelineCreate,
  prepareTimelineSave,
  rawFromClockParts,
  reviewNoteLines,
  sortTimelineBlocks,
} from "./day-of-time";

function timed(raw: string, minutes: number, dayOffset: 0 | 1, display: string) {
  return { kind: "timed" as const, raw, minutes, dayOffset, display };
}

function untimed(raw: string) {
  return { kind: "untimed" as const, raw };
}

const PARSE_CASES: Array<{
  raw: string;
  expected: ReturnType<typeof parseDayOfTime>;
}> = [
  { raw: "3:30 PM", expected: timed("3:30 PM", 15 * 60 + 30, 0, "3:30 PM") },
  { raw: "3:30pm", expected: timed("3:30pm", 15 * 60 + 30, 0, "3:30 PM") },
  { raw: "3:30 p.m.", expected: timed("3:30 p.m.", 15 * 60 + 30, 0, "3:30 PM") },
  { raw: "3:37 PM", expected: timed("3:37 PM", 15 * 60 + 37, 0, "3:37 PM") },
  { raw: "15:30", expected: timed("15:30", 15 * 60 + 30, 0, "3:30 PM") },
  { raw: "15.30", expected: timed("15.30", 15 * 60 + 30, 0, "3:30 PM") },
  { raw: "3 PM", expected: timed("3 PM", 15 * 60, 0, "3:00 PM") },
  { raw: "3pm", expected: timed("3pm", 15 * 60, 0, "3:00 PM") },
  { raw: "15", expected: timed("15", 15 * 60, 0, "3:00 PM") },
  { raw: "3:30", expected: untimed("3:30") },
  { raw: "3:37", expected: untimed("3:37") },
  { raw: "3", expected: untimed("3") },
  { raw: "12:00 PM", expected: timed("12:00 PM", 12 * 60, 0, "12:00 PM") },
  { raw: "12pm", expected: timed("12pm", 12 * 60, 0, "12:00 PM") },
  { raw: "noon", expected: timed("noon", 12 * 60, 0, "12:00 PM") },
  { raw: "12:00 AM", expected: timed("12:00 AM", 0, 1, "12:00 AM") },
  { raw: "12am", expected: timed("12am", 0, 1, "12:00 AM") },
  { raw: "midnight", expected: timed("midnight", 0, 1, "12:00 AM") },
  { raw: "12:30 AM", expected: timed("12:30 AM", 30, 1, "12:30 AM") },
  { raw: "1:00 AM", expected: timed("1:00 AM", 60, 1, "1:00 AM") },
  { raw: "4:59 AM", expected: timed("4:59 AM", 4 * 60 + 59, 1, "4:59 AM") },
  { raw: "5:00 AM", expected: timed("5:00 AM", 5 * 60, 0, "5:00 AM") },
  { raw: "11:59 AM", expected: timed("11:59 AM", 11 * 60 + 59, 0, "11:59 AM") },
  { raw: "00:00", expected: timed("00:00", 0, 1, "12:00 AM") },
  { raw: "0:00", expected: timed("0:00", 0, 1, "12:00 AM") },
  { raw: "00:30", expected: timed("00:30", 30, 1, "12:30 AM") },
  { raw: "23:59", expected: timed("23:59", 23 * 60 + 59, 0, "11:59 PM") },
  { raw: "0.4375", expected: untimed("0.4375") },
  { raw: "TBD", expected: untimed("TBD") },
  { raw: "tbd", expected: untimed("tbd") },
  { raw: "?", expected: untimed("?") },
  { raw: "—", expected: untimed("—") },
  { raw: "", expected: untimed("") },
  { raw: "   ", expected: untimed("") },
  { raw: "2ish", expected: untimed("2ish") },
  { raw: "around 3", expected: untimed("around 3") },
  { raw: "afternoon", expected: untimed("afternoon") },
  { raw: "at 3:30 PM", expected: untimed("at 3:30 PM") },
  { raw: "24:00", expected: untimed("24:00") },
  { raw: "13:00 PM", expected: untimed("13:00 PM") },
  { raw: "3:60 PM", expected: untimed("3:60 PM") },
];

test("parseTimelineSchedule defaults to wedding", () => {
  assert.equal(parseTimelineSchedule(undefined), "wedding");
  assert.equal(parseTimelineSchedule("wedding"), "wedding");
  assert.equal(parseTimelineSchedule("rehearsal"), "rehearsal");
  assert.equal(parseTimelineSchedule("other"), "wedding");
  assert.equal(isTimelineSchedule("rehearsal"), true);
  assert.equal(isTimelineSchedule("day"), false);
});

test("AFTER_MIDNIGHT_END_MINUTES is 5:00 AM", () => {
  assert.equal(AFTER_MIDNIGHT_END_MINUTES, 300);
});

test("parseDayOfTime fixtures", () => {
  for (const { raw, expected } of PARSE_CASES) {
    assert.deepEqual(parseDayOfTime(raw), expected, raw);
  }
});

test("formatClock keeps minute precision", () => {
  assert.equal(formatClock(15 * 60 + 37), "3:37 PM");
  assert.equal(formatClock(7 * 60 + 1), "7:01 AM");
});

test("12:30 AM sorts after 11:00 PM", () => {
  const late = parseDayOfTime("11:00 PM");
  const after = parseDayOfTime("12:30 AM");
  assert.equal(compareParsedTimes(late, after) < 0, true);
  assert.equal(compareParsedTimes(after, late) > 0, true);
});

test("4:00 PM sorts after 2:00 PM", () => {
  assert.equal(compareParsedTimes(parseDayOfTime("2:00 PM"), parseDayOfTime("4:00 PM")) < 0, true);
});

test("untimed sorts before timed", () => {
  assert.equal(compareParsedTimes(parseDayOfTime("TBD"), parseDayOfTime("10:30 AM")) < 0, true);
});

test("same clock time compares equal", () => {
  assert.equal(compareParsedTimes(parseDayOfTime("3:30 PM"), parseDayOfTime("15:30")), 0);
});

test("endsBeforeStart flags same-day typo", () => {
  assert.equal(endsBeforeStart("3:30 PM", "3:00 PM"), true);
  assert.equal(endsBeforeStart("10:00 AM", "9:00 AM"), true);
  assert.equal(endsBeforeStart("2:00 AM", "1:00 AM"), true);
});

test("endsBeforeStart allows overnight spans", () => {
  assert.equal(endsBeforeStart("11:00 PM", "1:00 AM"), false);
  assert.equal(endsBeforeStart("11:00 PM", "5:00 AM"), false);
  assert.equal(endsBeforeStart("10:00 PM", "6:00 AM"), false);
});

test("endsBeforeStart ignores untimed", () => {
  assert.equal(endsBeforeStart("3:30 PM", "TBD"), false);
  assert.equal(endsBeforeStart("afternoon", "2:00 PM"), false);
});

test("prepareTimelineSave does not wipe a blank time", () => {
  const last = { startAt: "10:30 AM", endAt: "11:00 AM", notes: "Getting ready" };
  const result = prepareTimelineSave({ startAt: "", endAt: "11:00 AM", notes: "Getting ready" }, last);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "noop");
});

test("prepareTimelineSave keeps a note change when time was cleared", () => {
  const last = { startAt: "10:30 AM", endAt: "11:00 AM", notes: "Getting ready" };
  const result = prepareTimelineSave({ startAt: "", endAt: "11:00 AM", notes: "Hair and makeup" }, last);
  assert.deepEqual(result, {
    ok: true,
    startAt: "10:30 AM",
    endAt: "11:00 AM",
    notes: "Hair and makeup",
    revertedNotes: false,
  });
});

test("prepareTimelineSave does not wipe blank notes", () => {
  const last = { startAt: "10:30 AM", endAt: "", notes: "Getting ready" };
  const result = prepareTimelineSave({ startAt: "10:30 AM", endAt: "", notes: "   " }, last);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "noop");
    assert.equal(result.revertNotes, "Getting ready");
  }
});

test("prepareTimelineSave keeps a time change when notes were cleared", () => {
  const last = { startAt: "4:00 PM", endAt: "", notes: "Ceremony" };
  const result = prepareTimelineSave({ startAt: "3:37 PM", endAt: "", notes: "" }, last);
  assert.deepEqual(result, {
    ok: true,
    startAt: "3:37 PM",
    endAt: null,
    notes: "Ceremony",
    revertedNotes: true,
  });
});

test("prepareTimelineSave reports noop when nothing changed", () => {
  const last = { startAt: "10:30 AM", endAt: "", notes: "Hair" };
  const result = prepareTimelineSave(last, last);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "noop");
});

test("prepareTimelineCreate rejects an abandoned blank card", () => {
  assert.deepEqual(prepareTimelineCreate({ startAt: "", endAt: "", notes: "" }), {
    ok: false,
    reason: "invalid",
  });
  assert.deepEqual(prepareTimelineCreate({ startAt: "TBD", endAt: "", notes: "" }), {
    ok: false,
    reason: "invalid",
  });
});

test("prepareTimelineCreate allows time-only with Untitled moment", () => {
  assert.deepEqual(prepareTimelineCreate({ startAt: "3:37 PM", endAt: "", notes: "" }), {
    ok: true,
    startAt: "3:37 PM",
    endAt: null,
    notes: "Untitled moment",
  });
});

test("prepareTimelineCreate allows notes-only as TBD", () => {
  assert.deepEqual(prepareTimelineCreate({ startAt: "", endAt: "", notes: "First look" }), {
    ok: true,
    startAt: "TBD",
    endAt: null,
    notes: "First look",
  });
});

test("bucketForTime cuts afternoon at noon and evening at 5 PM", () => {
  assert.equal(bucketForTime("TBD"), "untimed");
  assert.equal(bucketForTime("11:59 AM"), "morning");
  assert.equal(bucketForTime("12:00 PM"), "afternoon");
  assert.equal(bucketForTime("4:59 PM"), "afternoon");
  assert.equal(bucketForTime("5:00 PM"), "evening");
  assert.equal(bucketForTime("11:59 PM"), "evening");
  assert.equal(bucketForTime("12:30 AM"), "after");
  assert.equal(bucketForTime("4:59 AM"), "after");
  assert.equal(bucketForTime("5:00 AM"), "morning");
});

test("missingMeridiem only flags ambiguous clock times", () => {
  assert.equal(missingMeridiem("3:37"), true);
  assert.equal(missingMeridiem("3:37 PM"), false);
  assert.equal(missingMeridiem("15:30"), false);
  assert.equal(missingMeridiem("TBD"), false);
});

test("sortTimelineBlocks puts untimed first and 12:30 AM last", () => {
  const sorted = sortTimelineBlocks([
    { id: "c", startAt: "12:30 AM", sortOrder: 0 },
    { id: "a", startAt: "TBD", sortOrder: 2 },
    { id: "b", startAt: "4:00 PM", sortOrder: 1 },
    { id: "d", startAt: "2:00 PM", sortOrder: 3 },
  ]);
  assert.deepEqual(sorted.map((row) => row.id), ["a", "d", "b", "c"]);
});

test("sortTimelineBlocks keeps same-time order stable", () => {
  const sorted = sortTimelineBlocks([
    { id: "b", startAt: "3:30 PM", sortOrder: 2 },
    { id: "a", startAt: "3:30 PM", sortOrder: 1 },
  ]);
  assert.deepEqual(sorted.map((row) => row.id), ["a", "b"]);
});

test("peerKey requires the same start and end span", () => {
  assert.equal(peerKey("3:30 PM", ""), peerKey("15:30", ""));
  assert.equal(peerKey("3:30 PM", "4:00 PM"), peerKey("15:30", "16:00"));
  assert.notEqual(peerKey("3:30 PM", "4:00 PM"), peerKey("3:30 PM", "4:15 PM"));
  assert.notEqual(peerKey("3:30 PM", ""), peerKey("3:30 PM", "4:00 PM"));
  assert.equal(peerKey("TBD", ""), null);
  assert.equal(peerKey("3:30 PM", "afternoon"), null);
});

test("applyPeerOrder only permutes the same start and end span", () => {
  const blocks = [
    { id: "a", startAt: "3:30 PM", endAt: "4:00 PM" },
    { id: "b", startAt: "3:30 PM", endAt: "4:00 PM" },
    { id: "c", startAt: "3:30 PM", endAt: "4:15 PM" },
    { id: "d", startAt: "TBD", endAt: "" },
  ];
  const next = applyPeerOrder(blocks, ["b", "a"]);
  assert.deepEqual(next?.map((row) => row.id), ["b", "a", "c", "d"]);
  assert.equal(applyPeerOrder(blocks, ["a", "c"]), null);
  assert.equal(applyPeerOrder(blocks, ["d", "a"]), null);
});

test("clock parts round-trip common Day-of times", () => {
  assert.deepEqual(clockPartsFromRaw("9:30 AM"), { hour: "9", minute: "30", meridiem: "AM" });
  assert.deepEqual(clockPartsFromRaw("10:30 AM"), { hour: "10", minute: "30", meridiem: "AM" });
  assert.deepEqual(clockPartsFromRaw("12:00 PM"), { hour: "12", minute: "00", meridiem: "PM" });
  assert.deepEqual(clockPartsFromRaw("12:30 AM"), { hour: "12", minute: "30", meridiem: "AM" });
  assert.deepEqual(clockPartsFromRaw("3:37 PM"), { hour: "3", minute: "37", meridiem: "PM" });
  assert.equal(rawFromClockParts({ hour: "9", minute: "30", meridiem: "AM" }), "9:30 AM");
  assert.equal(rawFromClockParts({ hour: "12", minute: "00", meridiem: "PM" }), "12:00 PM");
  assert.equal(rawFromClockParts({ hour: "12", minute: "30", meridiem: "AM" }), "12:30 AM");
  assert.equal(rawFromClockParts({ hour: "", minute: "30", meridiem: "AM" }), "");
  assert.equal(rawFromClockParts({ hour: "9", minute: "", meridiem: "AM" }), "9:00 AM");
});

test("clock parts recover a time that is missing AM/PM", () => {
  assert.deepEqual(clockPartsFromRaw("3:30"), { hour: "3", minute: "30", meridiem: "AM" });
  assert.equal(rawFromClockParts({ hour: "3", minute: "30", meridiem: "PM" }), "3:30 PM");
});

test("clock hour and minute normalize like an alarm", () => {
  assert.equal(normalizeClockHour(""), "");
  assert.equal(normalizeClockHour("9"), "9");
  assert.equal(normalizeClockHour("0"), "12");
  assert.equal(normalizeClockHour("13"), "12");
  assert.equal(normalizeClockMinute(""), "00");
  assert.equal(normalizeClockMinute("5"), "05");
  assert.equal(normalizeClockMinute("60"), "59");
});

test("review notes split on semicolons into line items", () => {
  assert.deepEqual(reviewNoteLines("Brunch"), ["Brunch"]);
  assert.deepEqual(reviewNoteLines("Access begins; vendor arrivals + set up"), [
    "Access begins",
    "vendor arrivals + set up",
  ]);
  assert.deepEqual(reviewNoteLines("  one ; two ;  ; three  "), ["one", "two", "three"]);
  assert.deepEqual(reviewNoteLines("line one\nline two"), ["line one", "line two"]);
  assert.deepEqual(reviewNoteLines(""), []);
});
