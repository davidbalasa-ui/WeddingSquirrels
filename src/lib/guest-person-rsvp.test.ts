import assert from "node:assert/strict";
import { test } from "node:test";
import { RSVP_STATUSES, type RsvpStatus } from "./guest-gifts";
import {
  applyGuestPersonRsvpInStore,
  applyProfileGuestRsvpInStore,
  PROFILE_RSVP_STATUSES,
  profileShowsRsvpEditor,
  readProfileRsvp,
  resolveLinkedGuestPersonForProfile,
  type ProfileRsvpContact,
  type ProfileRsvpGuest,
  type ProfileRsvpGuestPerson,
  type ProfileRsvpPerson,
  type ProfileRsvpStore,
} from "./guest-person-rsvp";

function emptyStore(): ProfileRsvpStore {
  return { persons: [], guests: [], guestPeople: [], contacts: [] };
}

function addPerson(store: ProfileRsvpStore, id: string): ProfileRsvpPerson {
  const person = { id };
  store.persons.push(person);
  return person;
}

function addGuest(
  store: ProfileRsvpStore,
  row: Partial<ProfileRsvpGuest> & { id: string },
): ProfileRsvpGuest {
  const guest: ProfileRsvpGuest = {
    id: row.id,
    rsvpStatus: row.rsvpStatus ?? "pending",
    invitedCount: row.invitedCount ?? 0,
    acceptedCount: row.acceptedCount ?? 0,
  };
  store.guests.push(guest);
  return guest;
}

function addGuestPerson(
  store: ProfileRsvpStore,
  row: Partial<ProfileRsvpGuestPerson> & { id: string; name: string; guestId: string },
): ProfileRsvpGuestPerson {
  if (!store.guests.some((guest) => guest.id === row.guestId)) {
    addGuest(store, { id: row.guestId });
  }
  const guestPerson: ProfileRsvpGuestPerson = {
    id: row.id,
    guestId: row.guestId,
    name: row.name,
    personId: row.personId ?? null,
    rsvpStatus: row.rsvpStatus ?? "pending",
    tableNumber: row.tableNumber ?? 3,
    tableSpot: row.tableSpot ?? "A",
    isDayOfContact: row.isDayOfContact ?? false,
  };
  store.guestPeople.push(guestPerson);
  return guestPerson;
}

function addContact(
  store: ProfileRsvpStore,
  row: Partial<ProfileRsvpContact> & { id: string },
): ProfileRsvpContact {
  const contact: ProfileRsvpContact = {
    id: row.id,
    personId: row.personId ?? null,
  };
  store.contacts.push(contact);
  return contact;
}

function snapshot(store: ProfileRsvpStore) {
  return {
    personIds: store.persons.map((row) => row.id),
    guestIds: store.guests.map((row) => row.id),
    guestPersonIds: store.guestPeople.map((row) => row.id),
    personLinks: store.guestPeople.map((row) => ({ id: row.id, personId: row.personId, guestId: row.guestId })),
    seating: store.guestPeople.map((row) => ({
      id: row.id,
      tableNumber: row.tableNumber,
      tableSpot: row.tableSpot,
    })),
    dayOf: store.guestPeople.map((row) => ({ id: row.id, isDayOfContact: row.isDayOfContact })),
    householdMembers: store.guestPeople.map((row) => ({ id: row.id, guestId: row.guestId, name: row.name })),
  };
}

function householdStore() {
  const store = emptyStore();
  addPerson(store, "bri");
  addPerson(store, "evan_eling");
  addGuest(store, { id: "household-eling", rsvpStatus: "pending", invitedCount: 3, acceptedCount: 0 });
  addGuestPerson(store, {
    id: "gp-bri",
    guestId: "household-eling",
    name: "Bri Eling",
    personId: "bri",
    rsvpStatus: "pending",
    tableNumber: 4,
    tableSpot: "B",
    isDayOfContact: true,
  });
  addGuestPerson(store, {
    id: "gp-evan",
    guestId: "household-eling",
    name: "Evan Eling",
    personId: "evan_eling",
    rsvpStatus: "pending",
    tableNumber: 4,
    tableSpot: "C",
    isDayOfContact: false,
  });
  addGuestPerson(store, {
    id: "gp-plus",
    guestId: "household-eling",
    name: "Plus One",
    personId: null,
    rsvpStatus: "pending",
    tableNumber: null,
    tableSpot: null,
    isDayOfContact: false,
  });
  return store;
}

test("profile RSVP statuses reuse the existing enum exactly", () => {
  assert.deepEqual(PROFILE_RSVP_STATUSES, RSVP_STATUSES);
  assert.deepEqual([...PROFILE_RSVP_STATUSES], ["pending", "attending", "not_attending"]);
});

test("existing guest RSVP can be changed from the profile write path", () => {
  const store = householdStore();
  const result = applyProfileGuestRsvpInStore(store, {
    profileId: "person:bri",
    rsvpStatus: "attending",
    authorized: true,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.guestPersonId, "gp-bri");
    assert.equal(result.guestId, "household-eling");
    assert.equal(result.rsvpStatus, "attending");
  }
  assert.equal(store.guestPeople.find((row) => row.id === "gp-bri")?.rsvpStatus, "attending");
});

test("profile write updates the canonical GuestPerson, not a name match", () => {
  const store = emptyStore();
  addPerson(store, "wendy_rush");
  addGuestPerson(store, {
    id: "gp-linked",
    guestId: "household-wendy",
    name: "Wendy Rush",
    personId: "wendy_rush",
    rsvpStatus: "pending",
  });
  addGuestPerson(store, {
    id: "gp-same-name",
    guestId: "household-other",
    name: "Wendy Rush",
    personId: null,
    rsvpStatus: "pending",
  });

  const result = applyProfileGuestRsvpInStore(store, {
    profileId: "person:wendy_rush",
    rsvpStatus: "not_attending",
    authorized: true,
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.guestPersonId, "gp-linked");
  assert.equal(store.guestPeople.find((row) => row.id === "gp-linked")?.rsvpStatus, "not_attending");
  assert.equal(store.guestPeople.find((row) => row.id === "gp-same-name")?.rsvpStatus, "pending");
});

test("RSVP update does not create Person, Guest, or GuestPerson", () => {
  const store = householdStore();
  const before = snapshot(store);
  applyProfileGuestRsvpInStore(store, {
    profileId: "person:bri",
    rsvpStatus: "attending",
    authorized: true,
  });
  const after = snapshot(store);
  assert.deepEqual(after.personIds, before.personIds);
  assert.deepEqual(after.guestIds, before.guestIds);
  assert.deepEqual(after.guestPersonIds, before.guestPersonIds);
  assert.equal(store.persons.length, 2);
  assert.equal(store.guests.length, 1);
  assert.equal(store.guestPeople.length, 3);
});

test("RSVP update does not alter personId linkage", () => {
  const store = householdStore();
  const before = snapshot(store);
  applyProfileGuestRsvpInStore(store, {
    profileId: "person:bri",
    rsvpStatus: "not_attending",
    authorized: true,
  });
  assert.deepEqual(snapshot(store).personLinks, before.personLinks);
});

test("RSVP update preserves household relationships", () => {
  const store = householdStore();
  const before = snapshot(store);
  applyProfileGuestRsvpInStore(store, {
    profileId: "person:bri",
    rsvpStatus: "attending",
    authorized: true,
  });
  assert.deepEqual(snapshot(store).householdMembers, before.householdMembers);
  assert.equal(store.guestPeople.find((row) => row.id === "gp-evan")?.guestId, "household-eling");
  assert.equal(store.guestPeople.find((row) => row.id === "gp-evan")?.rsvpStatus, "pending");
});

test("RSVP update preserves seating and Day-of Contact state", () => {
  const store = householdStore();
  const before = snapshot(store);
  applyProfileGuestRsvpInStore(store, {
    profileId: "person:bri",
    rsvpStatus: "attending",
    authorized: true,
  });
  const after = snapshot(store);
  assert.deepEqual(after.seating, before.seating);
  assert.deepEqual(after.dayOf, before.dayOf);
  const bri = store.guestPeople.find((row) => row.id === "gp-bri");
  assert.equal(bri?.tableNumber, 4);
  assert.equal(bri?.tableSpot, "B");
  assert.equal(bri?.isDayOfContact, true);
});

test("unauthorized user cannot mutate RSVP", () => {
  const store = householdStore();
  const result = applyProfileGuestRsvpInStore(store, {
    profileId: "person:bri",
    rsvpStatus: "attending",
    authorized: false,
  });
  assert.deepEqual(result, { ok: false, reason: "forbidden" });
  assert.equal(store.guestPeople.find((row) => row.id === "gp-bri")?.rsvpStatus, "pending");
  assert.equal(applyGuestPersonRsvpInStore(store, {
    guestPersonId: "gp-bri",
    rsvpStatus: "attending",
    authorized: false,
  }).ok, false);
});

test("Person with no guest record does not get an invented RSVP record or editor", () => {
  const store = emptyStore();
  addPerson(store, "david");
  const before = snapshot(store);
  const result = applyProfileGuestRsvpInStore(store, {
    profileId: "person:david",
    rsvpStatus: "attending",
    authorized: true,
  });
  assert.deepEqual(result, { ok: false, reason: "not_found" });
  assert.equal(readProfileRsvp(store, "person:david"), null);
  assert.equal(resolveLinkedGuestPersonForProfile(store, "person:david"), null);
  assert.equal(profileShowsRsvpEditor(null), false);
  assert.deepEqual(snapshot(store), before);
  assert.equal(store.guests.length, 0);
  assert.equal(store.guestPeople.length, 0);
  assert.equal(store.persons.length, 1);
});

test("profile reads back the new RSVP state after save", () => {
  const store = householdStore();
  assert.equal(readProfileRsvp(store, "person:bri"), "pending");
  applyProfileGuestRsvpInStore(store, {
    profileId: "person:bri",
    rsvpStatus: "attending",
    authorized: true,
  });
  assert.equal(readProfileRsvp(store, "person:bri"), "attending");
  applyProfileGuestRsvpInStore(store, {
    profileId: "guest:gp-bri",
    rsvpStatus: "not_attending",
    authorized: true,
  });
  assert.equal(readProfileRsvp(store, "guest:gp-bri"), "not_attending");
  assert.equal(readProfileRsvp(store, "person:bri"), "not_attending");
});

test("direct guest profile and personId links resolve; names never invent a link", () => {
  const store = emptyStore();
  addPerson(store, "katie_kippe");
  addGuestPerson(store, {
    id: "gp-unlinked",
    guestId: "household-unlinked",
    name: "Katie Kippe",
    personId: null,
    rsvpStatus: "pending",
  });
  addContact(store, { id: "c-katie", personId: null });

  assert.equal(resolveLinkedGuestPersonForProfile(store, "person:katie_kippe")?.id, undefined);
  assert.equal(resolveLinkedGuestPersonForProfile(store, "contact:c-katie"), null);
  assert.equal(resolveLinkedGuestPersonForProfile(store, "guest:gp-unlinked")?.id, "gp-unlinked");
  assert.equal(profileShowsRsvpEditor("gp-unlinked"), true);
});

test("household summary follows existing person-specific RSVP rules", () => {
  const store = householdStore();
  applyProfileGuestRsvpInStore(store, {
    profileId: "person:bri",
    rsvpStatus: "attending",
    authorized: true,
  });
  const household = store.guests.find((row) => row.id === "household-eling");
  assert.equal(household?.rsvpStatus, "attending");
  assert.equal(household?.acceptedCount, 1);
  assert.equal(household?.invitedCount, 3);
  assert.equal(store.guestPeople.find((row) => row.id === "gp-evan")?.rsvpStatus, "pending");
  assert.equal(store.guestPeople.find((row) => row.id === "gp-plus")?.rsvpStatus, "pending");
  assert.equal(store.guestPeople.find((row) => row.id === "gp-plus")?.name, "Plus One");
});

test("RSVP persists in every supported direction on the same GuestPerson", () => {
  const store = householdStore();
  const steps: Array<[RsvpStatus, RsvpStatus]> = [
    ["pending", "attending"],
    ["pending", "not_attending"],
    ["attending", "not_attending"],
    ["not_attending", "attending"],
    ["attending", "pending"],
  ];
  for (const [from, to] of steps) {
    store.guestPeople.find((row) => row.id === "gp-bri")!.rsvpStatus = from;
    const result = applyProfileGuestRsvpInStore(store, {
      profileId: "person:bri",
      rsvpStatus: to,
      authorized: true,
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.guestPersonId, "gp-bri");
    assert.equal(readProfileRsvp(store, "person:bri"), to);
    assert.equal(store.guestPeople.find((row) => row.id === "gp-evan")?.rsvpStatus, "pending");
    assert.equal(store.guestPeople.find((row) => row.id === "gp-plus")?.rsvpStatus, "pending");
    assert.deepEqual(
      store.guestPeople.map((row) => row.id),
      ["gp-bri", "gp-evan", "gp-plus"],
    );
    assert.deepEqual(
      store.persons.map((row) => row.id),
      ["bri", "evan_eling"],
    );
  }
});

test("read-only user cannot change RSVP", () => {
  const store = householdStore();
  const result = applyProfileGuestRsvpInStore(store, {
    profileId: "person:bri",
    rsvpStatus: "attending",
    authorized: false,
  });
  assert.deepEqual(result, { ok: false, reason: "forbidden" });
  assert.equal(store.guestPeople.find((row) => row.id === "gp-bri")?.rsvpStatus, "pending");
});

test("unknown RSVP values are rejected and existing statuses stay intact", () => {
  const store = householdStore();
  const result = applyProfileGuestRsvpInStore(store, {
    profileId: "person:bri",
    rsvpStatus: "maybe",
    authorized: true,
  });
  assert.deepEqual(result, { ok: false, reason: "invalid" });
  assert.equal(store.guestPeople.find((row) => row.id === "gp-bri")?.rsvpStatus, "pending");
  for (const status of RSVP_STATUSES) {
    const ok = applyProfileGuestRsvpInStore(store, {
      profileId: "person:bri",
      rsvpStatus: status,
      authorized: true,
    });
    assert.equal(ok.ok, true);
    assert.equal(readProfileRsvp(store, "person:bri"), status);
  }
});
