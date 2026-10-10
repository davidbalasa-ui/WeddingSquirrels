import assert from "node:assert/strict";
import { test } from "node:test";
import type { EnrichmentSnapshot } from "./contact-enrichment";
import { planPhoneCorrections } from "./phone-corrections";

function snapshot(over: Partial<EnrichmentSnapshot> = {}): EnrichmentSnapshot {
  return {
    persons: [
      { id: "pam", name: "Pam Balasa", directoryList: "guests", isDayOfContact: false },
      { id: "bryan", name: "Bryan Balasa", directoryList: "guests", isDayOfContact: false },
    ],
    guestPeople: [
      { id: "gp1", name: "Pam Balasa", personId: "pam", rsvpStatus: "yes", photoData: null, guestId: "house" },
      { id: "gp2", name: "Bryan Balasa", personId: "bryan", rsvpStatus: "yes", photoData: null, guestId: "house" },
    ],
    guests: [{ id: "house", phone: null, street: null, city: null, state: null, zip: null, rsvpStatus: "yes" }],
    contacts: [],
    ...over,
  };
}

const contact = (phone: string | null) => ({
  id: "c-pam",
  name: "Pam Balasa",
  personId: "pam",
  phone,
  email: null,
  photoData: null,
  directoryList: "guests",
  isDayOfContact: false,
});

test("Pam's number goes on her own contact, never the household Bryan shares", () => {
  const [row] = planPhoneCorrections(snapshot());
  assert.equal(row?.status, "add");
  assert.deepEqual(row?.write, { kind: "createContact", personId: "pam", name: "Pam Balasa", phone: "269-475-3751" });
});

test("an empty contact is filled; the same number in another format is left alone", () => {
  assert.deepEqual(planPhoneCorrections(snapshot({ contacts: [contact(null)] }))[0]?.write, {
    kind: "contact",
    contactId: "c-pam",
    phone: "269-475-3751",
  });
  assert.equal(planPhoneCorrections(snapshot({ contacts: [contact("(269) 475-3751")] }))[0]?.status, "matches");
});

test("a different saved number is shown for David to pick, not overwritten", () => {
  const [row] = planPhoneCorrections(snapshot({ contacts: [contact("231-555-0100")] }));
  assert.equal(row?.status, "differs");
  assert.equal(row?.current, "231-555-0100");
  assert.deepEqual(row?.write, { kind: "contact", contactId: "c-pam", phone: "269-475-3751" });
});

test("the People list's own spelling is matched, and nobody is guessed", () => {
  const pamela = snapshot();
  pamela.persons[0] = { ...pamela.persons[0]!, name: "Pamela Balasa" };
  assert.equal(planPhoneCorrections(pamela)[0]?.personName, "Pamela Balasa");
  assert.equal(planPhoneCorrections(snapshot({ persons: [] }))[0]?.status, "not_found");
  const both = snapshot();
  both.persons.push({ id: "pam2", name: "Pamela Balasa", directoryList: "guests", isDayOfContact: false });
  assert.equal(planPhoneCorrections(both)[0]?.status, "not_found");
});
