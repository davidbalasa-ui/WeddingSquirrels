import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildDirectoryEntries,
  classifyNameGroup,
  filterDirectoryEntries,
  groupDirectoryEntries,
  namesMatch,
  normalizePersonName,
  parseProfileId,
  profileIdForPerson,
  vendorSubtitle,
} from "./people-directory";

test("normalizePersonName strips punctuation and casing", () => {
  assert.equal(normalizePersonName("Avalon Green · Planner"), "avalon green planner");
});

test("namesMatch accepts exact and first-name matches", () => {
  assert.equal(namesMatch("Shelly Smith", "Shelly"), true);
  assert.equal(namesMatch("David Balasa", "Dave"), false);
});

test("parseProfileId round-trips person, contact, and guest ids", () => {
  assert.deepEqual(parseProfileId("person:david"), { kind: "person", id: "david" });
  assert.deepEqual(parseProfileId("contact:abc"), { kind: "contact", id: "abc" });
  assert.equal(parseProfileId("invalid"), null);
});

test("vendorSubtitle extracts the role after the dot separator", () => {
  assert.equal(vendorSubtitle("Avalon Green · Planner"), "Planner");
  assert.equal(vendorSubtitle("Barry Tilson"), null);
});

test("classifyNameGroup maps rehearsal dinner sections into party and family", () => {
  assert.equal(classifyNameGroup("Bri", ["Bri"], ["Shelly"]), "party");
  assert.equal(classifyNameGroup("Shelly", ["Bri"], ["Shelly"]), "family");
});

test("buildDirectoryEntries prefers person records over duplicate guest names", () => {
  const entries = buildDirectoryEntries({
    persons: [{ id: "shelly", name: "Shelly" }],
    contacts: [],
    guestPeople: [{ id: "guest-1", name: "Shelly", householdLabel: "Shelly · Orlando" }],
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.profileId, profileIdForPerson("shelly"));
});

test("buildDirectoryEntries keeps vendors as contacts", () => {
  const entries = buildDirectoryEntries({
    persons: [],
    contacts: [
      {
        id: "c1",
        name: "Avalon Green · Planner",
        phone: "555",
        email: null,
        photoData: null,
      },
    ],
    guestPeople: [],
  });
  assert.equal(entries[0]?.group, "vendor");
  assert.equal(entries[0]?.phone, "555");
});

test("filterDirectoryEntries searches names and subtitles", () => {
  const entries = buildDirectoryEntries({
    persons: [{ id: "bri", name: "Bri" }],
    contacts: [
      {
        id: "c1",
        name: "Avalon Green · Planner",
        phone: null,
        email: null,
        photoData: null,
      },
    ],
    guestPeople: [],
  });
  assert.equal(filterDirectoryEntries(entries, "avalon").length, 1);
  assert.equal(filterDirectoryEntries(entries, "bri").length, 1);
});

test("groupDirectoryEntries filters by group", () => {
  const entries = buildDirectoryEntries({
    persons: [
      { id: "bri", name: "Bri" },
      { id: "shelly", name: "Shelly" },
    ],
    contacts: [
      {
        id: "c1",
        name: "Avalon Green · Planner",
        phone: null,
        email: null,
        photoData: null,
      },
    ],
    guestPeople: [],
  });
  assert.equal(groupDirectoryEntries(entries, "vendor").length, 1);
  assert.ok(groupDirectoryEntries(entries, "party").some((entry) => entry.name === "Bri"));
});
