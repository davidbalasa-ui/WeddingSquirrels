import assert from "node:assert/strict";
import { test } from "node:test";
import { FAMILY_CONTACTS, familyRole } from "./family-contacts";
import { printContactRole } from "./print-projection";

// David, 2026-10-11 15:50: John is father of the bride, Pam mother of the groom, Bryan father of the groom, Denise and Lisa helpers.
test("family and helpers print under the role David gave, whatever an older saved label says", () => {
  assert.equal(printContactRole("John Wiewiora", "Guest"), "Father of the Bride");
  assert.equal(printContactRole("Pam Balasa", "Mother"), "Mother of the Groom");
  assert.equal(printContactRole("Pamela  Balasa", null), "Mother of the Groom");
  assert.equal(printContactRole("Bryan Balasa", null), "Father of the Groom");
  assert.equal(printContactRole("Denise", null), "Helper");
  assert.equal(printContactRole("Lisa", null), "Helper");
  assert.equal(printContactRole("Shelly Wiewiora", null), "Mother of the Bride");
  // Everyone else keeps their own label.
  assert.equal(printContactRole("Steve Crossbow", "Band"), "Band");
  assert.equal(familyRole("Katie Wiewiora"), null);
});

test("David's numbers for family and helpers, as he sent them", () => {
  const phone = (name: string) => FAMILY_CONTACTS.find((row) => row.name === name)?.phone?.replace(/\D/g, "");
  assert.equal(phone("Denise"), "2317403616");
  assert.equal(phone("Lisa"), "2317404390");
  assert.equal(phone("Bryan Balasa"), "2694753495");
  assert.equal(phone("Shelly Wiewiora"), "2319038127");
  // John's and Pam's numbers are saved by the phone corrections, which wait for David's pick on a clash.
  assert.equal(FAMILY_CONTACTS.find((row) => row.name === "John Wiewiora")?.phone, null);
});

test("Shelly's number comes only from her own guest record, never a household number she shares", async () => {
  const { savedGuestPhone } = await import("./printout-corrections-data");
  const person = (name: string, guestId: string) => ({ id: name, name, personId: null, rsvpStatus: null, photoData: null, guestId });
  const guest = (id: string, phone: string | null) => ({ id, phone, street: null, city: null, state: null, zip: null, rsvpStatus: null });
  const own = { guestPeople: [person("Shelly Wiewiora", "g1")], guests: [guest("g1", "555-0101")] };
  assert.equal(savedGuestPhone(own as never, "Shelly Wiewiora"), "555-0101");
  const shared = { guestPeople: [person("Shelly Wiewiora", "g1"), person("John Wiewiora", "g1")], guests: [guest("g1", "231-798-5825")] };
  assert.equal(savedGuestPhone(shared as never, "Shelly Wiewiora"), null);
  assert.equal(savedGuestPhone({ guestPeople: [], guests: [] }, "Shelly Wiewiora"), null);
});
