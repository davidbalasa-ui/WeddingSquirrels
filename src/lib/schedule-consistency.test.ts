import assert from "node:assert/strict";
import test from "node:test";
import { RECONCILED_TIMELINE, reconciledNotes } from "./reconciled-timeline";
import { BRIDAL_PARTY_PHOTOS_LINE, ceremonyLineUpTime, scheduleLines } from "./schedule-consistency";

const doc = RECONCILED_TIMELINE.filter((moment) => moment.schedule === "wedding").map((moment) => ({
  startAt: moment.startAt,
  notes: reconciledNotes(moment),
  schedule: "wedding",
}));

test("a schedule shows one bridal party photos line in place of the individual shots", () => {
  const photos = RECONCILED_TIMELINE.find((moment) => moment.seedKey === "wedding_party_photos")!;
  assert.equal(photos.lines.length, 16);
  assert.deepEqual(scheduleLines(photos.lines), [BRIDAL_PARTY_PHOTOS_LINE]);
  assert.deepEqual(scheduleLines(["Haley with mom.", "Bride with wedding party."]), ["Haley with mom.", "Bride with wedding party."]);
  assert.deepEqual(scheduleLines(["Arrive.", "Bride with Skila.", "Groom with Evan.", "Then quiet time."]), ["Arrive.", BRIDAL_PARTY_PHOTOS_LINE, "Then quiet time."]);
});

test("a bare line that a timed line repeats is dropped", () => {
  assert.deepEqual(
    scheduleLines(["Wedding party lines up", "Touch-ups", "3:20 PM — wedding party lines up (see MC Run of Show lineup)"]),
    ["Touch-ups", "3:20 PM — wedding party lines up (see MC Run of Show lineup)"],
  );
});

test("the line-up time is read from the wedding-day schedule", () => {
  // The reconciled document: the party lines up in "Get ready for the ceremony", 3:15–3:30 PM.
  assert.equal(ceremonyLineUpTime(doc), "3:15 PM");
  // A schedule that names the minute wins over the moment's start.
  assert.equal(
    ceremonyLineUpTime([
      { startAt: "3:15 PM", notes: "Pre-Ceremony Transition\nWedding party lines up\n3:20 PM — wedding party lines up (see MC Run of Show lineup)" },
      { startAt: "3:30 PM", notes: "Ceremony" },
      { startAt: "4:50 PM", notes: "Wedding party lines up\nMC confirms names and entrance order." },
    ]),
    "3:20 PM",
  );
  // The reception entrance line-up never counts.
  assert.equal(
    ceremonyLineUpTime([
      { startAt: "3:30 PM", notes: "Ceremony" },
      { startAt: "4:00 PM", notes: "Cocktail hour\n4:50 PM — bridal party lines up for reception entrances" },
    ]),
    null,
  );
});
