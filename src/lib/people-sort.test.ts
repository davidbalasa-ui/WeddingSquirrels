import assert from "node:assert/strict";
import { test } from "node:test";
import { sortGuestRecords } from "@/lib/people-sort";
import type { GuestRecord } from "@/lib/guests";

const sampleGuest = (names: string[], rsvp = "pending"): GuestRecord => ({
  id: "g1",
  phone: null,
  street: null,
  city: null,
  state: null,
  zip: null,
  rsvpStatus: rsvp,
  invitedCount: names.length,
  acceptedCount: 0,
  gifts: [],
  people: names.map((name, index) => ({
    id: `p${index}`,
    name,
    directoryLabel: null,
    isDayOfContact: false,
    rsvpStatus: rsvp,
    photoData: null,
    tableNumber: index + 1,
    tableSpot: null,
  })),
});

test("sortGuestRecords orders by name", () => {
  const guests = [sampleGuest(["Zoe"]), sampleGuest(["Aaron"])];
  const sorted = sortGuestRecords(guests, "name");
  assert.equal(sorted[0]?.people[0]?.name, "Aaron");
});
