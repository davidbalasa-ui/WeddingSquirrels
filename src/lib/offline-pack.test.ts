import assert from "node:assert/strict";
import { test } from "node:test";
import { pickDayOfContacts } from "./day-of";
import type { OfflinePack } from "./offline-db";
import {
  offlineAssignmentOwnerNames,
  offlineContactInputsFromPack,
  offlineDirectoryContactsFromPack,
  offlineGuestDisplayName,
  offlineGuestPersonRsvpRows,
  refreshedOfflinePack,
  sourceFromPack,
} from "./offline-pack";

const JPEG = "data:image/jpeg;base64,abc";

function pack(overrides: Partial<OfflinePack> = {}): OfflinePack {
  return {
    fetchedAt: "2026-09-09T12:00:00.000Z",
    weddingDate: "2026-10-16T00:00:00.000Z",
    coupleNames: "David & Haley",
    timezone: "America/Detroit",
    tasks: [],
    people: [],
    timeline: [],
    contacts: [],
    assignments: [],
    guests: [],
    budgetItems: [],
    requests: [],
    shopping: [],
    stay: [],
    ...overrides,
  };
}

const kurtPerson = {
  id: "kurt_huizenga",
  name: "Kurt Huizenga",
  directoryLabel: "MC",
  isDayOfContact: true,
  sortOrder: 8,
};

function dayOfFromPack(snapshot: OfflinePack) {
  return pickDayOfContacts(offlineContactInputsFromPack(snapshot));
}

test("flagged Person with no Contact row is included in offline Day-of Contacts", () => {
  const contacts = dayOfFromPack(
    pack({
      people: [kurtPerson],
      contacts: [],
    }),
  );
  const kurt = contacts.find((row) => row.personId === "kurt_huizenga");
  assert.ok(kurt);
  assert.equal(kurt?.id, "person:kurt_huizenga");
});

test("Kurt-style Person renders name + role offline without phone or email", () => {
  const contacts = dayOfFromPack(
    pack({
      people: [kurtPerson],
      contacts: [],
    }),
  );
  const kurt = contacts.find((row) => row.personId === "kurt_huizenga");
  assert.equal(kurt?.name, "Kurt Huizenga");
  assert.equal(kurt?.context, "MC");
  assert.equal(kurt?.phone, null);
  assert.equal(kurt?.email, null);
  const directory = offlineDirectoryContactsFromPack(
    pack({
      people: [kurtPerson],
      contacts: [],
    }),
  );
  assert.equal(directory.length, 1);
  assert.equal(directory[0]?.name, "Kurt Huizenga");
  assert.equal(directory[0]?.subtitle, "MC");
  assert.equal(directory[0]?.phone, null);
  assert.equal(directory[0]?.email, null);
});

test("a Person newly added to Day-of Contacts appears after the next pack refresh", () => {
  const before = pack({
    fetchedAt: "2026-09-09T12:00:00.000Z",
    people: [{ id: "wendy_rush", name: "Wendy Rush", isDayOfContact: true, directoryLabel: "MOH" }],
  });
  const after = pack({
    fetchedAt: "2026-09-09T12:06:00.000Z",
    people: [
      { id: "wendy_rush", name: "Wendy Rush", isDayOfContact: true, directoryLabel: "MOH" },
      kurtPerson,
    ],
  });
  const current = refreshedOfflinePack(before, after);
  assert.equal(current.fetchedAt, after.fetchedAt);
  const names = dayOfFromPack(current).map((row) => row.name);
  assert.ok(names.includes("Kurt Huizenga"));
  assert.ok(names.includes("Wendy Rush"));
});

test("a Person removed from Day-of Contacts disappears after the next successful refresh", () => {
  const before = pack({
    people: [
      kurtPerson,
      { id: "wendy_rush", name: "Wendy Rush", isDayOfContact: true, directoryLabel: "MOH" },
    ],
  });
  const after = pack({
    fetchedAt: "2026-09-09T12:10:00.000Z",
    people: [{ id: "wendy_rush", name: "Wendy Rush", isDayOfContact: false, directoryLabel: "MOH" }],
  });
  const current = refreshedOfflinePack(before, JSON.parse(JSON.stringify(after)) as OfflinePack);
  const contacts = dayOfFromPack(current);
  assert.equal(contacts.some((row) => row.personId === "kurt_huizenga"), false);
  assert.equal(contacts.some((row) => row.personId === "wendy_rush"), false);
});

test("offline refresh replaces people and does not duplicate canonical identities", () => {
  const before = pack({
    people: [kurtPerson],
    contacts: [
      {
        id: "c-kurt",
        name: "Kurt Huizenga",
        directoryLabel: "MC",
        phone: "555",
        email: null,
        photoData: null,
        isDayOfContact: true,
        personId: "kurt_huizenga",
        sortOrder: 1,
      },
    ],
  });
  const after = pack({
    fetchedAt: "2026-09-09T13:00:00.000Z",
    people: [kurtPerson],
    contacts: [
      {
        id: "c-kurt",
        name: "Kurt Huizenga",
        directoryLabel: "MC",
        phone: "555",
        email: null,
        photoData: JPEG,
        isDayOfContact: true,
        personId: "kurt_huizenga",
        sortOrder: 1,
      },
    ],
  });
  const current = refreshedOfflinePack(before, after);
  const contacts = dayOfFromPack(current);
  assert.equal(contacts.filter((row) => row.personId === "kurt_huizenga").length, 1);
  assert.equal(contacts[0]?.id, "c-kurt");
  assert.equal(contacts[0]?.name, "Kurt Huizenga");
});

test("canonical Person identity is preserved across JSON pack serialization", () => {
  const snapshot = JSON.parse(
    JSON.stringify(
      pack({
        people: [kurtPerson],
        contacts: [],
      }),
    ),
  ) as OfflinePack;
  const contacts = dayOfFromPack(snapshot);
  assert.equal(contacts[0]?.personId, "kurt_huizenga");
  assert.equal(contacts[0]?.id, "person:kurt_huizenga");
  const source = sourceFromPack(snapshot, new Date("2026-10-16T16:00:00Z"));
  assert.equal(source.contacts[0]?.personId, "kurt_huizenga");
  assert.equal(source.canSeeContacts, true);
});

test("next offline pack refresh carries the updated guest name and RSVP", () => {
  const previous = pack({
    people: [{ id: "andi", name: "Andi Cartwright", isDayOfContact: false }],
    guests: [
      {
        id: "g-andi",
        nameLine1: "Andi Cartwright",
        nameLine2: null,
        rsvpStatus: "pending",
        invitedCount: 1,
        acceptedCount: 0,
        people: [{ id: "gp-andi", name: "Andi Cartwright", personId: "andi", rsvpStatus: "pending" }],
        gifts: [],
      },
    ],
  });
  const incoming = pack({
    people: [{ id: "andi", name: "Andi C.", isDayOfContact: false }],
    guests: [
      {
        id: "g-andi",
        nameLine1: "Andi C.",
        nameLine2: null,
        rsvpStatus: "attending",
        invitedCount: 1,
        acceptedCount: 1,
        people: [{ id: "gp-andi", name: "Andi C.", personId: "andi", rsvpStatus: "attending" }],
        gifts: [],
      },
    ],
  });
  const current = refreshedOfflinePack(previous, incoming);
  const guests = current.guests as Array<{
    rsvpStatus: string;
    people?: Array<{ name: string; rsvpStatus?: string }>;
  }>;
  const people = current.people as Array<{ id: string; name: string }>;
  assert.equal(people[0]?.name, "Andi C.");
  assert.equal(offlineGuestDisplayName(guests[0] as never), "Andi C.");
  assert.equal(guests[0]?.rsvpStatus, "attending");
  assert.equal(guests[0]?.people?.[0]?.rsvpStatus, "attending");
});

test("offline guest RSVP rows use GuestPerson status, not household status", () => {
  const snapshot = pack({
    guests: [
      {
        id: "g-cynthia",
        nameLine1: "Cynthia Berman",
        nameLine2: "Guest of Cynthia",
        rsvpStatus: "attending",
        invitedCount: 2,
        acceptedCount: 1,
        people: [
          { id: "gp-cynthia", name: "Cynthia Berman", rsvpStatus: "attending" },
          { id: "gp-guest", name: "Guest of Cynthia", rsvpStatus: "not_attending" },
        ],
        gifts: [],
      },
    ],
  });
  const rows = offlineGuestPersonRsvpRows(
    (snapshot.guests as Array<{
      rsvpStatus: string;
      people?: Array<{ name: string; rsvpStatus?: string }>;
    }>)[0] as never,
  );
  assert.deepEqual(
    rows.map((row) => `${row.name}:${row.rsvpLabel}`),
    ["Cynthia Berman:Attending", "Guest of Cynthia:Declined"],
  );
});

test("GuestPerson names in the pack are used for offline guest display", () => {
  const snapshot = pack({
    people: [{ id: "andi", name: "Andi Cartwright", isDayOfContact: false }],
    guests: [
      {
        id: "g-andi",
        nameLine1: "Andi",
        nameLine2: null,
        rsvpStatus: "attending",
        invitedCount: 1,
        acceptedCount: 1,
        people: [{ id: "gp-andi", name: "Andi Cartwright", personId: "andi" }],
        gifts: [],
      },
    ],
  });
  const guests = snapshot.guests as Array<{ people?: { name: string }[] }>;
  assert.equal(offlineGuestDisplayName(guests[0] as never), "Andi Cartwright");
  const directory = offlineDirectoryContactsFromPack(snapshot);
  assert.equal(directory.some((row) => row.name === "Andi Cartwright"), false);
});

test("existing offline assignment owner names and timeline packing still work", () => {
  const snapshot = pack({
    people: [{ id: "haley", name: "Haley", isDayOfContact: false }],
    assignments: [
      {
        id: "rings",
        title: "Hold the rings",
        notes: null,
        assignees: [{ personId: "haley", person: { id: "haley", name: "Haley" } }],
      },
    ],
    timeline: [
      {
        id: "settle",
        schedule: "wedding",
        startAt: "3:00 PM",
        endAt: "3:30 PM",
        notes: "Settle in at Airbnb",
        sortOrder: 0,
      },
    ],
    contacts: [
      {
        id: "c-avalon",
        name: "Avalon Green · Planner",
        directoryLabel: "Planner",
        phone: "1",
        email: null,
        photoData: null,
        isDayOfContact: true,
        sortOrder: 0,
      },
    ],
  });
  const assignments = snapshot.assignments as Array<{
    assignees?: Array<{ personId: string; person?: { id: string; name: string } }>;
  }>;
  assert.deepEqual(offlineAssignmentOwnerNames(assignments[0] as never), ["Haley"]);
  const source = sourceFromPack(snapshot, new Date("2026-10-16T12:00:00Z"));
  assert.equal(source.blocks.length, 1);
  assert.equal(source.blocks[0]?.notes.includes("Settle in at Airbnb"), true);
  const dayOf = dayOfFromPack(snapshot);
  assert.equal(dayOf.some((row) => row.name.includes("Avalon")), true);
});
