import assert from "node:assert/strict";
import { test } from "node:test";
import { parseContactPhoto } from "./contact-photo";
import { profilePhotoSrc } from "./people-experience";
import {
  applyProfilePhotoAndRead,
  canEditProfilePhoto,
} from "./people-profile-photo";
import {
  setProfilePhotoInStore,
  type IdentityContact,
  type IdentityGuestPerson,
  type IdentityPerson,
  type IdentityStore,
} from "./people-identity-write";

const JPEG = "data:image/jpeg;base64,abc";
const JPEG2 = "data:image/jpeg;base64,xyz";

function emptyStore(): IdentityStore {
  return { persons: [], guests: [], guestPeople: [], contacts: [] };
}

function addPerson(store: IdentityStore, id: string, name: string): IdentityPerson {
  const person: IdentityPerson = {
    id,
    name,
    sortOrder: store.persons.length,
    directoryLabel: null,
    directoryList: "guests",
    isDayOfContact: false,
  };
  store.persons.push(person);
  return person;
}

function addGuestPerson(
  store: IdentityStore,
  row: Partial<IdentityGuestPerson> & { id: string; name: string },
): IdentityGuestPerson {
  const guestId = row.guestId ?? `household_${row.id}`;
  if (!store.guests.some((guest) => guest.id === guestId)) {
    store.guests.push({ id: guestId, nameLine1: row.name, sortOrder: store.guests.length });
  }
  const guestPerson: IdentityGuestPerson = {
    id: row.id,
    guestId,
    name: row.name,
    personId: row.personId ?? null,
    rsvpStatus: row.rsvpStatus ?? "attending",
    tableNumber: row.tableNumber ?? 4,
    tableSpot: row.tableSpot ?? "A",
    photoData: row.photoData ?? null,
    directoryLabel: row.directoryLabel ?? null,
    isDayOfContact: row.isDayOfContact ?? false,
    sortOrder: row.sortOrder ?? 0,
  };
  store.guestPeople.push(guestPerson);
  return guestPerson;
}

function addContact(
  store: IdentityStore,
  row: Partial<IdentityContact> & { id: string; name: string },
): IdentityContact {
  const contact: IdentityContact = {
    id: row.id,
    name: row.name,
    personId: row.personId ?? null,
    phone: row.phone ?? "555-0100",
    email: row.email ?? "role@example.com",
    photoData: row.photoData ?? null,
    directoryLabel: row.directoryLabel ?? "Planner",
    directoryList: row.directoryList ?? "vendors",
    isDayOfContact: row.isDayOfContact ?? false,
    sortOrder: row.sortOrder ?? store.contacts.length,
  };
  store.contacts.push(contact);
  return contact;
}

test("existing linked guest/person can upload a profile photo onto the Person identity", () => {
  const store = emptyStore();
  addPerson(store, "andi", "Andi Cartwright");
  addGuestPerson(store, { id: "gp-andi", name: "Andi Cartwright", personId: "andi" });
  const result = setProfilePhotoInStore(store, { kind: "person", id: "andi" }, JPEG);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.personId, "andi");
  assert.equal(store.guestPeople[0]?.photoData, JPEG);
});

test("existing Person is referenced; no new Person, GuestPerson, or Contact is created", () => {
  const store = emptyStore();
  addPerson(store, "andi", "Andi Cartwright");
  addGuestPerson(store, {
    id: "gp-andi",
    name: "Andi Cartwright",
    personId: "andi",
    rsvpStatus: "attending",
    tableNumber: 2,
    tableSpot: "C",
    directoryLabel: "MOH",
  });
  const before = structuredClone(store);
  const result = setProfilePhotoInStore(store, { kind: "person", id: "andi" }, JPEG);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.createdPerson, false);
  assert.equal(result.createdGuestPerson, false);
  assert.equal(result.createdContact, false);
  assert.equal(store.persons.length, 1);
  assert.equal(store.guestPeople.length, 1);
  assert.equal(store.contacts.length, 0);
  assert.equal(store.persons[0]?.id, "andi");
  assert.equal(store.guestPeople[0]?.id, "gp-andi");
  assert.equal(store.guestPeople[0]?.rsvpStatus, before.guestPeople[0]?.rsvpStatus);
  assert.equal(store.guestPeople[0]?.tableNumber, before.guestPeople[0]?.tableNumber);
  assert.equal(store.guestPeople[0]?.tableSpot, before.guestPeople[0]?.tableSpot);
  assert.equal(store.guestPeople[0]?.directoryLabel, before.guestPeople[0]?.directoryLabel);
  assert.equal(store.guestPeople[0]?.name, "Andi Cartwright");
});

test("photo upload does not create a Contact merely for the photo", () => {
  const store = emptyStore();
  addPerson(store, "andi", "Andi Cartwright");
  addGuestPerson(store, { id: "gp-andi", name: "Andi Cartwright", personId: "andi" });
  setProfilePhotoInStore(store, { kind: "guest", id: "gp-andi" }, JPEG);
  assert.equal(store.contacts.length, 0);
});

test("unauthorized users cannot upload or change a photo", () => {
  assert.equal(
    canEditProfilePhoto({
      canSeeGuests: false,
      canEditContacts: false,
      hasGuestPhotoTarget: true,
      hasContactPhotoTarget: false,
    }),
    false,
  );
  assert.equal(
    canEditProfilePhoto({
      canSeeGuests: true,
      canEditContacts: false,
      hasGuestPhotoTarget: true,
      hasContactPhotoTarget: false,
    }),
    true,
  );
  assert.equal(
    canEditProfilePhoto({
      canSeeGuests: false,
      canEditContacts: true,
      hasGuestPhotoTarget: false,
      hasContactPhotoTarget: true,
    }),
    true,
  );
});

test("invalid file type and oversized input are rejected", () => {
  assert.throws(() => parseContactPhoto("data:text/plain;base64,abc"), /INVALID_PHOTO/);
  assert.throws(() => parseContactPhoto("https://example.com/photo.jpg"), /INVALID_PHOTO/);
  assert.throws(
    () => parseContactPhoto(`data:image/jpeg;base64,${"A".repeat(500_001)}`),
    /INVALID_PHOTO/,
  );
  assert.equal(parseContactPhoto(JPEG), JPEG);
  assert.equal(parseContactPhoto(""), null);
});

test("profile reads the new photo after a successful upload", () => {
  const store = emptyStore();
  addPerson(store, "andi", "Andi Cartwright");
  addGuestPerson(store, { id: "gp-andi", name: "Andi Cartwright", personId: "andi" });
  const result = applyProfilePhotoAndRead(store, "person:andi", JPEG);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.photoSrc, JPEG);
});

test("an existing photo can be changed", () => {
  const store = emptyStore();
  addPerson(store, "andi", "Andi Cartwright");
  addGuestPerson(store, { id: "gp-andi", name: "Andi Cartwright", personId: "andi", photoData: JPEG });
  const result = applyProfilePhotoAndRead(store, "person:andi", JPEG2);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.photoSrc, JPEG2);
  assert.equal(store.guestPeople[0]?.photoData, JPEG2);
});

test("photo removal clears existing GuestPerson and Contact photos for the identity", () => {
  const store = emptyStore();
  addPerson(store, "andi", "Andi Cartwright");
  addGuestPerson(store, { id: "gp-andi", name: "Andi Cartwright", personId: "andi", photoData: JPEG });
  addContact(store, { id: "c-andi", name: "Andi Cartwright", personId: "andi", photoData: JPEG });
  const result = applyProfilePhotoAndRead(store, "person:andi", null);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.photoSrc, null);
  assert.equal(store.guestPeople[0]?.photoData, null);
  assert.equal(store.contacts[0]?.photoData, null);
});

test("missing photo still renders the existing fallback and Kurt-style people have no photo target", () => {
  const store = emptyStore();
  addPerson(store, "kurt_huizenga", "Kurt Huizenga");
  const result = setProfilePhotoInStore(store, { kind: "person", id: "kurt_huizenga" }, JPEG);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "no_photo_target");
  assert.equal(profilePhotoSrc(null), null);
  assert.equal(store.persons.length, 1);
  assert.equal(store.guestPeople.length, 0);
  assert.equal(store.contacts.length, 0);
});

test("linked Contact photo is updated for the same personId, never a similar name", () => {
  const store = emptyStore();
  addPerson(store, "bri", "Bri Eling");
  addGuestPerson(store, { id: "gp-bri", name: "Bri Eling", personId: "bri" });
  addContact(store, { id: "c-bri", name: "Bri Eling", personId: "bri", photoData: null });
  addContact(store, { id: "c-other", name: "Bri", personId: null, photoData: null });
  setProfilePhotoInStore(store, { kind: "person", id: "bri" }, JPEG);
  assert.equal(store.contacts.find((row) => row.id === "c-bri")?.photoData, JPEG);
  assert.equal(store.contacts.find((row) => row.id === "c-other")?.photoData, null);
});
