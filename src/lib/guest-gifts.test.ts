import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyRsvpChange,
  compareTableSpot,
  giftDescriptions,
  giftPrintRows,
  groupGuestsByTable,
  guestAddressLines,
  guestNameLines,
  summarizeGuestRsvp,
} from "./guest-gifts";

test("guest names stack each person on its own line", () => {
  assert.deepEqual(guestNameLines({ nameLine1: "Jane Smith", nameLine2: "John Smith" }), [
    "Jane Smith",
    "John Smith",
  ]);
  assert.deepEqual(guestNameLines({ nameLine1: "Aunt May", nameLine2: "  " }), ["Aunt May"]);
  assert.deepEqual(
    guestNameLines({
      nameLine1: "Legacy",
      nameLine2: null,
      people: [{ name: "Jane" }, { name: "John" }, { name: "Timmy" }],
    }),
    ["Jane", "John", "Timmy"],
  );
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

test("inferred invited count follows named people", () => {
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
  const family = applyRsvpChange(
    {
      nameLine2: null,
      rsvpStatus: "pending",
      invitedCount: 0,
      acceptedCount: 0,
      people: [{ name: "Jane" }, { name: "John" }, { name: "Timmy" }],
    },
    {},
  );
  assert.equal(family.invitedCount, 3);
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

test("table spot order prefers numeric seats", () => {
  assert.ok(compareTableSpot("3", "10") < 0);
  assert.ok(compareTableSpot("head", "3") > 0);
  assert.ok(compareTableSpot(null, "2") > 0);
});

test("groupGuestsByTable sorts tables and seats", () => {
  const groups = groupGuestsByTable([
    {
      id: "h1",
      people: [
        { id: "p1", name: "Jane", tableNumber: 5, tableSpot: "4" },
        { id: "p2", name: "John", tableNumber: 5, tableSpot: "3" },
      ],
    },
    {
      id: "h2",
      people: [
        { id: "p3", name: "Alex", tableNumber: 2, tableSpot: "1" },
        { id: "p4", name: "Sam", tableNumber: null, tableSpot: null },
      ],
    },
    {
      id: "h3",
      people: [{ id: "p5", name: "Pat", tableNumber: 10, tableSpot: "head" }],
    },
  ]);

  assert.deepEqual(
    groups.map((group) => group.label),
    ["South 2", "South 5", "North 5", "No table"],
  );
  assert.deepEqual(
    groups[1]?.rows.map((row) => row.name),
    ["John", "Jane"],
  );
  assert.deepEqual(
    groups[3]?.rows.map((row) => row.name),
    ["Sam"],
  );
});

