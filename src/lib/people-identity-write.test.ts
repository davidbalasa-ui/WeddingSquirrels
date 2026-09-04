import assert from "node:assert/strict";
import { test } from "node:test";
import { namesMatch } from "./people-directory";
import {
  allocatePersonId,
  convertPrimaryListInStore,
  createPersonInStore,
  editContactInStore,
  editGuestPersonInStore,
  editPersonInStore,
  linkContactInStore,
  linkGuestPersonInStore,
  photoCopyPeerByPersonId,
  planPersonForRoleWrite,
  roleEditMustPreservePersonId,
  type IdentityContact,
  type IdentityGuestPerson,
  type IdentityPerson,
  type IdentityStore,
} from "./people-identity-write";

function emptyStore(): IdentityStore {
  return { persons: [], guests: [], guestPeople: [], contacts: [] };
}

function addPerson(store: IdentityStore, id: string, name: string): IdentityPerson {
  const person: IdentityPerson = {
    id,
    name,
    sortOrder: store.persons.length,
    directoryLabel: null,
    directoryList: null,
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
    photoData: row.photoData ?? "data:image/jpeg;base64,abc",
    directoryLabel: row.directoryLabel ?? "Planner",
    directoryList: row.directoryList ?? "vendors",
    isDayOfContact: row.isDayOfContact ?? false,
    sortOrder: row.sortOrder ?? store.contacts.length,
  };
  store.contacts.push(contact);
  return contact;
}

test("editing a linked GuestPerson preserves personId", () => {
  const store = emptyStore();
  addPerson(store, "bri", "Bri Eling");
  addGuestPerson(store, { id: "gp-bri", name: "Bri Eling", personId: "bri" });

  const edited = editGuestPersonInStore(store, "gp-bri", { rsvpStatus: "not_attending", tableNumber: 9 });
  assert.equal(edited?.personId, "bri");
  assert.equal(roleEditMustPreservePersonId("bri", null), "bri");
});

test("editing a linked Contact preserves personId", () => {
  const store = emptyStore();
  addPerson(store, "belle_genton", "Belle Genton");
  addContact(store, { id: "c-belle", name: "Belle Genton", personId: "belle_genton" });

  const edited = editContactInStore(store, "c-belle", { phone: "555-0199", email: "belle@example.com" });
  assert.equal(edited?.personId, "belle_genton");
  assert.equal(roleEditMustPreservePersonId("belle_genton", undefined), "belle_genton");
});

test("renaming a linked role does not detach or create another Person", () => {
  const store = emptyStore();
  addPerson(store, "wendy_rush", "Wendy Rush");
  addGuestPerson(store, { id: "gp-wendy", name: "Wendy Rush", personId: "wendy_rush" });
  addContact(store, { id: "c-wendy", name: "Wendy Rush", personId: "wendy_rush" });

  editGuestPersonInStore(store, "gp-wendy", { name: "Wendy R." });
  editContactInStore(store, "c-wendy", { name: "Wendy R." });

  assert.equal(store.guestPeople[0]?.personId, "wendy_rush");
  assert.equal(store.contacts[0]?.personId, "wendy_rush");
  assert.equal(store.persons.length, 1);
  assert.equal(store.persons[0]?.id, "wendy_rush");
});

test("explicitly linking GuestPerson to an existing Person uses that Person", () => {
  const store = emptyStore();
  const person = createPersonInStore(store, "Kurt Huizenga");
  addGuestPerson(store, { id: "gp-kurt", name: "Kurt", personId: null });

  const linked = linkGuestPersonInStore(store, "gp-kurt", person.id);
  assert.equal(linked?.personId, "kurt_huizenga");
  assert.equal(store.persons.length, 1);
  assert.equal(planPersonForRoleWrite({ existingPersonId: null, explicitPersonId: person.id }).strategy, "reuse");
});

test("explicitly linking Contact to an existing Person uses that Person", () => {
  const store = emptyStore();
  const person = createPersonInStore(store, "Belle Genton");
  addContact(store, { id: "c-belle", name: "Belle Genton", personId: null });

  const linked = linkContactInStore(store, "c-belle", person.id);
  assert.equal(linked?.personId, "belle_genton");
  assert.equal(store.persons.length, 1);
});

test("converting an unlinked role creates one Person and establishes the link", () => {
  const store = emptyStore();
  addGuestPerson(store, { id: "gp-new", name: "Andi Cartwright", personId: null });

  const result = convertPrimaryListInStore(store, { kind: "guest", id: "gp-new", list: "vendors" });
  assert.equal(result.ok, true);
  assert.equal(store.persons.length, 1);
  assert.equal(store.guestPeople[0]?.personId, "andi_cartwright");
  assert.equal(store.contacts[0]?.personId, "andi_cartwright");
  assert.equal(store.guestPeople.length, 1);
  if (result.ok) assert.equal(result.profileId, "person:andi_cartwright");
});

test("converting an already-linked role does not create a duplicate Person", () => {
  const store = emptyStore();
  addPerson(store, "bri", "Bri Eling");
  addGuestPerson(store, { id: "gp-bri", name: "Bri Eling", personId: "bri" });
  addContact(store, { id: "c-bri", name: "Bri Eling", personId: "bri" });

  const first = convertPrimaryListInStore(store, { kind: "guest", id: "gp-bri", list: "vendors" });
  const second = convertPrimaryListInStore(store, { kind: "contact", id: "c-bri", list: "guests" });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(store.persons.length, 1);
  assert.equal(store.guestPeople.filter((row) => row.personId === "bri").length, 1);
  assert.equal(store.contacts.filter((row) => row.personId === "bri").length, 1);
});

test("similar-name existing Persons remain distinct on convert", () => {
  const store = emptyStore();
  createPersonInStore(store, "Wendy Rush");
  createPersonInStore(store, "Wendy");
  addGuestPerson(store, { id: "gp-wendy-legacy", name: "Wendy Rush", personId: null });

  convertPrimaryListInStore(store, { kind: "guest", id: "gp-wendy-legacy", list: "vendors" });

  assert.equal(store.persons.map((row) => row.id).sort().join(","), "wendy,wendy_rush,wendy_rush_2");
  assert.equal(store.guestPeople[0]?.personId, "wendy_rush_2");
  assert.equal(store.persons.find((row) => row.id === "wendy_rush")?.name, "Wendy Rush");
});

test("an unlinked legacy GuestPerson is not automatically linked by name", () => {
  const store = emptyStore();
  createPersonInStore(store, "Wendy Rush");
  addGuestPerson(store, { id: "gp-legacy", name: "Wendy Rush", personId: null });
  addContact(store, { id: "c-other", name: "Avalon Green", personId: null });

  editGuestPersonInStore(store, "gp-legacy", { name: "Wendy Rush" });
  convertPrimaryListInStore(store, { kind: "contact", id: "c-other", list: "guests" });

  assert.equal(store.guestPeople.find((row) => row.id === "gp-legacy")?.personId, null);
  assert.equal(namesMatch("Wendy Rush", "Wendy Rush"), true);
});

test("an unlinked legacy Contact is not automatically linked by name", () => {
  const store = emptyStore();
  createPersonInStore(store, "Belle Genton");
  addContact(store, { id: "c-legacy", name: "Belle Genton", personId: null });
  addGuestPerson(store, { id: "gp-other", name: "Marie Wiewiora", personId: null });

  editContactInStore(store, "c-legacy", { name: "Belle Genton" });
  convertPrimaryListInStore(store, { kind: "guest", id: "gp-other", list: "vendors" });

  assert.equal(store.contacts.find((row) => row.id === "c-legacy")?.personId, null);
});

test("role-specific GuestPerson data survives linking", () => {
  const store = emptyStore();
  addGuestPerson(store, {
    id: "gp-data",
    name: "Katie Kippe",
    personId: null,
    rsvpStatus: "attending",
    tableNumber: 3,
    tableSpot: "B",
  });

  convertPrimaryListInStore(store, { kind: "guest", id: "gp-data", list: "vendors" });
  const linked = store.guestPeople[0];
  assert.equal(linked?.personId, "katie_kippe");
  assert.equal(linked?.rsvpStatus, "attending");
  assert.equal(linked?.tableNumber, 3);
  assert.equal(linked?.tableSpot, "B");
  assert.equal(store.guestPeople.length, 1);
});

test("role-specific Contact data survives linking", () => {
  const store = emptyStore();
  addContact(store, {
    id: "c-data",
    name: "Belle Genton",
    personId: null,
    phone: "555-0147",
    email: "belle@example.com",
    photoData: "data:image/jpeg;base64,photo",
    directoryLabel: "Hair",
  });

  convertPrimaryListInStore(store, { kind: "contact", id: "c-data", list: "guests" });
  const linked = store.contacts[0];
  assert.equal(linked?.personId, "belle_genton");
  assert.equal(linked?.phone, "555-0147");
  assert.equal(linked?.email, "belle@example.com");
  assert.equal(linked?.photoData, "data:image/jpeg;base64,photo");
  assert.equal(linked?.directoryLabel, "Hair");
  assert.equal(store.contacts.length, 1);
});

test("photo copy only follows personId, never a similar name", () => {
  const match = photoCopyPeerByPersonId("bri", [
    { id: "c-name", personId: null, photoData: null },
    { id: "c-bri", personId: "bri", photoData: null },
  ]);
  assert.equal(match?.id, "c-bri");
  assert.equal(photoCopyPeerByPersonId(null, [{ id: "c-name", personId: null, photoData: null }]), null);
});

test("allocatePersonId never reuses an existing Person id", () => {
  assert.equal(allocatePersonId("Wendy Rush", ["wendy_rush"]), "wendy_rush_2");
  assert.equal(allocatePersonId("Wendy Rush", []), "wendy_rush");
});

test("editing a roleless Person does not create GuestPerson or Contact", () => {
  const store = emptyStore();
  addPerson(store, "david", "David");
  const edited = editPersonInStore(store, "david", { directoryLabel: "Partner", name: "David" });
  assert.equal(edited?.id, "david");
  assert.equal(edited?.directoryLabel, "Partner");
  assert.equal(edited?.directoryList, null);
  assert.equal(store.guestPeople.length, 0);
  assert.equal(store.contacts.length, 0);
  assert.equal(store.persons.length, 1);
});

test("keeping an unlinked guest on the guest list does not create a Person", () => {
  const store = emptyStore();
  addGuestPerson(store, { id: "gp-legacy", name: "David", personId: null });
  const result = convertPrimaryListInStore(store, { kind: "guest", id: "gp-legacy", list: "guests" });
  assert.equal(result.ok, true);
  assert.equal(store.persons.length, 0);
  assert.equal(store.guestPeople[0]?.personId, null);
});
