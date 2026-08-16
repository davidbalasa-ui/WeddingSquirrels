import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyRsvpChange,
  giftDescriptions,
  giftPrintRows,
  guestAddressLines,
  guestNameLines,
  summarizeGuestRsvp,
} from "./guest-gifts";

test("guest names stack person 2 on its own line", () => {
  assert.deepEqual(guestNameLines({ nameLine1: "Jane Smith", nameLine2: "John Smith" }), [
    "Jane Smith",
    "John Smith",
  ]);
  assert.deepEqual(guestNameLines({ nameLine1: "Aunt May", nameLine2: "  " }), ["Aunt May"]);
});

test("guest address uses mailing lines", () => {
  assert.deepEqual(
    guestAddressLines({
      street: "123 Oak St",
      city: "Detroit",
      state: "MI",
      zip: "48201",
    }),
    ["123 Oak St", "Detroit, MI 48201"],
  );
  assert.deepEqual(
    guestAddressLines({ street: null, city: null, state: null, zip: null }),
    [],
  );
});

test("gift descriptions drop blank items", () => {
  assert.deepEqual(
    giftDescriptions([{ description: "Mixer" }, { description: "  " }, { description: "Towels" }]),
    ["Mixer", "Towels"],
  );
});

test("print rows keep names, address, and gifts in two columns", () => {
  const rows = giftPrintRows([
    {
      id: "1",
      nameLine1: "Jane Smith",
      nameLine2: "John Smith",
      street: "123 Oak St",
      city: "Detroit",
      state: "MI",
      zip: "48201",
      gifts: [{ description: "Mixer" }, { description: "Card" }],
    },
  ]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0]?.nameLines, ["Jane Smith", "John Smith"]);
  assert.deepEqual(rows[0]?.addressLines, ["123 Oak St", "Detroit, MI 48201"]);
  assert.deepEqual(rows[0]?.gifts, ["Mixer", "Card"]);
});

test("inferred invited count is 2 when a second name is present", () => {
  const couple = applyRsvpChange(
    { nameLine2: "John", rsvpStatus: "pending", invitedCount: 0, acceptedCount: 0 },
    {},
  );
  assert.equal(couple.invitedCount, 2);
  assert.equal(
    applyRsvpChange(
      { nameLine2: null, rsvpStatus: "pending", invitedCount: 0, acceptedCount: 0 },
      {},
    ).invitedCount,
    1,
  );
});

test("marking attending fills accepted from invited when none were accepted", () => {
  const next = applyRsvpChange(
    { nameLine2: "John", rsvpStatus: "pending", invitedCount: 2, acceptedCount: 0 },
    { rsvpStatus: "attending" },
  );
  assert.equal(next.rsvpStatus, "attending");
  assert.equal(next.acceptedCount, 2);
});

test("marking not attending clears accepted", () => {
  const next = applyRsvpChange(
    { nameLine2: "John", rsvpStatus: "attending", invitedCount: 2, acceptedCount: 2 },
    { rsvpStatus: "not_attending" },
  );
  assert.equal(next.rsvpStatus, "not_attending");
  assert.equal(next.acceptedCount, 0);
});

test("accepted cannot exceed invited", () => {
  const next = applyRsvpChange(
    { nameLine2: null, rsvpStatus: "attending", invitedCount: 2, acceptedCount: 1 },
    { acceptedCount: 9 },
  );
  assert.equal(next.acceptedCount, 2);
});

test("RSVP report totals people and household replies", () => {
  const report = summarizeGuestRsvp([
    { nameLine2: "John", rsvpStatus: "attending", invitedCount: 2, acceptedCount: 2 },
    { nameLine2: null, rsvpStatus: "not_attending", invitedCount: 1, acceptedCount: 1 },
    { nameLine2: null, rsvpStatus: "pending", invitedCount: 3, acceptedCount: 0 },
  ]);
  assert.equal(report.households, 3);
  assert.equal(report.attending, 1);
  assert.equal(report.notAttending, 1);
  assert.equal(report.pending, 1);
  assert.equal(report.invited, 6);
  assert.equal(report.accepted, 2);
  assert.equal(report.awaiting, 4);
});

