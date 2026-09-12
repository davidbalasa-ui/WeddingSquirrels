import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyGuestPersonNameInStore,
  applyProfileGuestNameInStore,
  type NameWriteContact,
  type NameWriteGuest,
  type NameWriteGuestPerson,
  type NameWriteMealGuest,
  type NameWritePerson,
  type NameWriteStaySlot,
  type NameWriteStore,
} from "./guest-person-name";

function emptyStore(): NameWriteStore {
  return { persons: [], guests: [], guestPeople: [], contacts: [], staySlots: [], mealGuests: [] };
}

function addPerson(store: NameWriteStore, id: string, name: string): NameWritePerson {
  const person = { id, name };
  store.persons.push(person);
  return person;
}

function addGuest(store: NameWriteStore, id: string, nameLine1: string, nameLine2: string | null = null): NameWriteGuest {
  const guest = { id, nameLine1, nameLine2 };
  store.guests.push(guest);
  return guest;
}

function addGuestPerson(
  store: NameWriteStore,
  row: Partial<NameWriteGuestPerson> & { id: string; name: string; guestId: string },
): NameWriteGuestPerson {
  const guestPerson: NameWriteGuestPerson = {
    id: row.id,
    guestId: row.guestId,
    name: row.name,
    personId: row.personId ?? null,
    rsvpStatus: row.rsvpStatus ?? "pending",
    tableNumber: row.tableNumber ?? 4,
    tableSpot: row.tableSpot ?? "A",
    photoData: row.photoData ?? "data:image/jpeg;base64,abc",
    directoryLabel: row.directoryLabel ?? null,
    isDayOfContact: row.isDayOfContact ?? false,
  };
  store.guestPeople.push(guestPerson);
  return guestPerson;
}

function addContact(store: NameWriteStore, row: Partial<NameWriteContact> & { id: string; name: string }): NameWriteContact {
  const contact: NameWriteContact = {
    id: row.id,
    name: row.name,
    personId: row.personId ?? null,
  };
  store.contacts.push(contact);
  return contact;
}

function addStay(store: NameWriteStore, id: string, occupant: string): NameWriteStaySlot {
  const slot = { id, occupant };
  store.staySlots?.push(slot);
  return slot;
}

function addMeal(store: NameWriteStore, row: NameWriteMealGuest): NameWriteMealGuest {
  store.mealGuests?.push(row);
  return row;
}

function snapshotIds(store: NameWriteStore) {
  return {
    persons: store.persons.map((row) => row.id),
    guests: store.guests.map((row) => row.id),
    guestPeople: store.guestPeople.map((row) => row.id),
    links: store.guestPeople.map((row) => ({ id: row.id, personId: row.personId, guestId: row.guestId })),
    rsvp: store.guestPeople.map((row) => ({ id: row.id, rsvpStatus: row.rsvpStatus })),
    seating: store.guestPeople.map((row) => ({
      id: row.id,
      tableNumber: row.tableNumber,
      tableSpot: row.tableSpot,
      photoData: row.photoData,
    })),
  };
}

test("linked GuestPerson name edit updates the existing canonical Person", () => {
  const store = emptyStore();
  addPerson(store, "andi_cartwright", "Andi Cartwright");
  addGuest(store, "hh_andi", "Andi Cartwright");
  addGuestPerson(store, {
    id: "gp_andi",
    guestId: "hh_andi",
    name: "Andi Cartwright",
    personId: "andi_cartwright",
    rsvpStatus: "attending",
  });
  const before = snapshotIds(store);
  const result = applyGuestPersonNameInStore(store, {
    guestPersonId: "gp_andi",
    name: "Andi C.",
    authorized: true,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.createdPerson, false);
  assert.equal(result.createdGuestPerson, false);
  assert.equal(result.personId, "andi_cartwright");
  assert.equal(result.guestPersonId, "gp_andi");
  assert.equal(store.persons[0]?.name, "Andi C.");
  assert.equal(store.guestPeople[0]?.name, "Andi C.");
  assert.deepEqual(snapshotIds(store), { ...before, rsvp: before.rsvp, seating: before.seating, links: before.links });
  assert.equal(store.guestPeople[0]?.rsvpStatus, "attending");
});

test("profile person: id name edit uses the same Person, no new identity", () => {
  const store = emptyStore();
  addPerson(store, "bri", "Bri Eling");
  addGuest(store, "hh_trinity_bri", "Trinity Medler", "Bri Eling");
  addGuestPerson(store, { id: "gp_bri", guestId: "hh_trinity_bri", name: "Bri Eling", personId: "bri" });
  addGuestPerson(store, {
    id: "gp_trinity",
    guestId: "hh_trinity_bri",
    name: "Trinity Medler",
    personId: "trinity_medler",
    rsvpStatus: "pending",
  });
  addPerson(store, "trinity_medler", "Trinity Medler");
  const result = applyProfileGuestNameInStore(store, {
    profileId: "person:bri",
    name: "Bri E.",
    authorized: true,
  });
  assert.equal(result.ok, true);
  assert.equal(store.persons.find((row) => row.id === "bri")?.name, "Bri E.");
  assert.equal(store.persons.length, 2);
  assert.equal(store.guestPeople.length, 2);
  assert.equal(store.guestPeople.find((row) => row.id === "gp_bri")?.personId, "bri");
  assert.equal(store.guestPeople.find((row) => row.id === "gp_trinity")?.name, "Trinity Medler");
});

test("unlinked generic guest name can change without creating a Person", () => {
  const store = emptyStore();
  addGuest(store, "hh_plus", "Guest of Mari");
  addGuestPerson(store, { id: "gp_plus", guestId: "hh_plus", name: "Guest of Mari / Plus One", personId: null });
  const result = applyGuestPersonNameInStore(store, {
    guestPersonId: "gp_plus",
    name: "Alex Smith",
    authorized: true,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.personId, null);
  assert.equal(result.guestPersonId, "gp_plus");
  assert.equal(store.persons.length, 0);
  assert.equal(store.guestPeople[0]?.id, "gp_plus");
  assert.equal(store.guestPeople[0]?.name, "Alex Smith");
  assert.equal(store.guestPeople[0]?.personId, null);
  assert.equal(store.guests[0]?.nameLine1, "Alex Smith");
});

test("generic +1 rename keeps the GuestPerson slot, household, RSVP, seating, and photo", () => {
  const store = emptyStore();
  addPerson(store, "cynthia_berman", "Cynthia Berman");
  addGuest(store, "hh_cynthia", "Cynthia Berman", "Guest of Cynthia");
  addGuestPerson(store, {
    id: "gp_cynthia",
    guestId: "hh_cynthia",
    name: "Cynthia Berman",
    personId: "cynthia_berman",
    rsvpStatus: "attending",
    tableNumber: 6,
    tableSpot: "A",
  });
  addGuestPerson(store, {
    id: "gp_plus",
    guestId: "hh_cynthia",
    name: "Guest of Cynthia",
    personId: null,
    rsvpStatus: "not_attending",
    tableNumber: 6,
    tableSpot: "B",
    photoData: "data:image/jpeg;base64,plus",
  });
  const result = applyGuestPersonNameInStore(store, {
    guestPersonId: "gp_plus",
    name: "Alex Smith",
    authorized: true,
  });
  assert.equal(result.ok, true);
  const plus = store.guestPeople.find((row) => row.id === "gp_plus");
  assert.equal(plus?.name, "Alex Smith");
  assert.equal(plus?.guestId, "hh_cynthia");
  assert.equal(plus?.rsvpStatus, "not_attending");
  assert.equal(plus?.tableNumber, 6);
  assert.equal(plus?.tableSpot, "B");
  assert.equal(plus?.photoData, "data:image/jpeg;base64,plus");
  assert.equal(store.guestPeople.find((row) => row.id === "gp_cynthia")?.rsvpStatus, "attending");
  assert.equal(store.guestPeople.find((row) => row.id === "gp_cynthia")?.name, "Cynthia Berman");
});

test("linked rename updates Contact and stay/meal copies of the same Person only", () => {
  const store = emptyStore();
  addPerson(store, "wendy_rush", "Wendy Rush");
  addGuest(store, "hh_wendy", "Wendy Rush");
  addGuestPerson(store, { id: "gp_wendy", guestId: "hh_wendy", name: "Wendy Rush", personId: "wendy_rush" });
  addContact(store, { id: "c_wendy", name: "Wendy Rush", personId: "wendy_rush" });
  addContact(store, { id: "c_other", name: "Wendy Rush", personId: null });
  addStay(store, "stay_wendy", "Wendy Rush");
  addStay(store, "stay_other", "Kurt Huizenga");
  addMeal(store, { id: "meal_wendy", name: "Wendy Rush", personId: "wendy_rush" });
  addMeal(store, { id: "meal_other", name: "Kurt Huizenga", personId: "kurt" });
  applyGuestPersonNameInStore(store, { guestPersonId: "gp_wendy", name: "Wendy R.", authorized: true });
  assert.equal(store.contacts.find((row) => row.id === "c_wendy")?.name, "Wendy R.");
  assert.equal(store.contacts.find((row) => row.id === "c_other")?.name, "Wendy Rush");
  assert.equal(store.staySlots?.find((row) => row.id === "stay_wendy")?.occupant, "Wendy R.");
  assert.equal(store.staySlots?.find((row) => row.id === "stay_other")?.occupant, "Kurt Huizenga");
  assert.equal(store.mealGuests?.find((row) => row.id === "meal_wendy")?.name, "Wendy R.");
  assert.equal(store.mealGuests?.find((row) => row.id === "meal_other")?.name, "Kurt Huizenga");
});

test("read-only user cannot rename", () => {
  const store = emptyStore();
  addGuest(store, "hh", "Ada");
  addGuestPerson(store, { id: "gp", guestId: "hh", name: "Ada" });
  const result = applyGuestPersonNameInStore(store, { guestPersonId: "gp", name: "Ada Smith", authorized: false });
  assert.deepEqual(result, { ok: false, reason: "forbidden" });
  assert.equal(store.guestPeople[0]?.name, "Ada");
});
