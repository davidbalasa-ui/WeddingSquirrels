import assert from "node:assert/strict";
import { test } from "node:test";
import {
  collectUploadedPhotos,
  filterGuestPeople,
  flattenGuestPeople,
  sortGuestPeople,
  sortGuestRecords,
} from "@/lib/people-sort";
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

const household = (
  id: string,
  people: Array<{ name: string; rsvp?: string; role?: string | null; photo?: string | null }>,
): GuestRecord => ({
  id,
  phone: null,
  street: null,
  city: null,
  state: null,
  zip: null,
  rsvpStatus: "pending",
  invitedCount: people.length,
  acceptedCount: 0,
  gifts: [],
  people: people.map((person, index) => ({
    id: `${id}-p${index}`,
    name: person.name,
    directoryLabel: person.role ?? null,
    isDayOfContact: false,
    rsvpStatus: person.rsvp ?? "pending",
    photoData: person.photo ?? null,
    tableNumber: index + 1,
    tableSpot: null,
  })),
});

test("flattenGuestPeople emits one row per person, not per household", () => {
  const guests = [
    household("h1", [{ name: "Alex" }, { name: "Blair" }]),
    household("h2", [{ name: "Casey" }]),
  ];
  const rows = flattenGuestPeople(guests);
  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows.map((row) => row.person.name),
    ["Alex", "Blair", "Casey"],
  );
});

test("filterGuestPeople combines role and attendance independently", () => {
  const rows = flattenGuestPeople([
    household("h1", [
      { name: "Alex", rsvp: "attending", role: "Family" },
      { name: "Blair", rsvp: "pending", role: "Family" },
    ]),
    household("h2", [{ name: "Casey", rsvp: "attending", role: "Wedding party" }]),
  ]);

  const familyAttending = filterGuestPeople(rows, { role: "family", attendance: "attending" });
  assert.deepEqual(
    familyAttending.map((row) => row.person.name),
    ["Alex"],
  );

  const attending = filterGuestPeople(rows, { attendance: "attending" });
  assert.deepEqual(
    attending.map((row) => row.person.name).sort(),
    ["Alex", "Casey"],
  );
});

test("filterGuestPeople searches person names without requiring household title", () => {
  const rows = flattenGuestPeople([
    household("h1", [{ name: "Alex Rivera" }, { name: "Blair Chen" }]),
  ]);
  const found = filterGuestPeople(rows, { query: "blair" });
  assert.equal(found.length, 1);
  assert.equal(found[0]?.person.name, "Blair Chen");
});

test("sortGuestPeople orders individuals by name", () => {
  const rows = flattenGuestPeople([
    household("h1", [{ name: "Zoe" }, { name: "Aaron" }]),
  ]);
  const sorted = sortGuestPeople(rows, "name");
  assert.deepEqual(
    sorted.map((row) => row.person.name),
    ["Aaron", "Zoe"],
  );
});

test("collectUploadedPhotos de-duplicates data URLs and keeps labels", () => {
  const photos = collectUploadedPhotos({
    guests: [
      household("h1", [
        { name: "Alex", photo: "data:image/jpeg;base64,AAA" },
        { name: "Blair", photo: "data:image/jpeg;base64,AAA" },
      ]),
    ],
    extraPhotos: [
      { src: "data:image/jpeg;base64,BBB", label: "Vendor" },
      { src: "data:image/jpeg;base64,AAA", label: "Dup" },
    ],
  });
  assert.equal(photos.length, 2);
  assert.equal(photos[0]?.label, "Alex");
  assert.equal(photos[1]?.label, "Vendor");
});

test("collectUploadedPhotos keeps every unique extra photo for the master list", () => {
  const extras = [
    { src: "data:image/jpeg;base64,ONE", label: "Andi" },
    { src: "data:image/jpeg;base64,TWO", label: "Marie" },
    { src: "data:image/jpeg;base64,THREE", label: "Kurt" },
    { src: "data:image/jpeg;base64,FOUR", label: "Shelly" },
    { src: "data:image/jpeg;base64,FIVE", label: "Avalon" },
    { src: "data:image/jpeg;base64,SIX", label: "Wendy" },
    { src: "data:image/jpeg;base64,SEVEN", label: "John" },
  ];
  const photos = collectUploadedPhotos({ guests: [], extraPhotos: extras });
  assert.equal(photos.length, 7);
  assert.deepEqual(
    photos.map((photo) => photo.label),
    extras.map((photo) => photo.label),
  );
});
