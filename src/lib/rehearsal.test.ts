import assert from "node:assert/strict";
import { test } from "node:test";
import { REHEARSAL_SCHEDULE_SEED } from "./rehearsal";
import { parseDayOfTime } from "./day-of-time";

test("rehearsal seed has unique ids and timed starts in order", () => {
  const ids = REHEARSAL_SCHEDULE_SEED.map((block) => block.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(REHEARSAL_SCHEDULE_SEED.length, 7);

  let previous = -1;
  for (const block of REHEARSAL_SCHEDULE_SEED) {
    const parsed = parseDayOfTime(block.startAt);
    assert.equal(parsed.kind, "timed", block.startAt);
    if (parsed.kind === "timed") {
      assert.equal(parsed.minutes > previous, true, block.startAt);
      previous = parsed.minutes;
    }
  }
});
