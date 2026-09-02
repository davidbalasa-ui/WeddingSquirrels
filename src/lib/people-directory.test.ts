import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildDirectoryEntries,
  classifyNameGroup,
  filterEntriesByTab,
  filterDirectoryEntries,
  groupDirectoryEntries,
  isDayOfContactName,
  namesMatch,
  normalizePersonName,
  parseProfileId,
  profileIdForPerson,
  resolveIsDayOfContact,
  resolvePrimaryList,
  vendorSubtitle,
} from "./people-directory";

test("isDayOfContactName matches bridal party and family roster names", () => {
  assert.equal(isDayOfContactName("Andi"), true);
  assert.equal(isDayOfContactName("Avalon Green"), false);
});

test("filterEntriesByTab separates guests, vendors, and day-of overlay", () => {
  const entries = buildDirectoryEntries({
    persons: [
      {
        id: "andi",
        name: "Andi",
        directoryLabel: "Best man",
        isDayOfContact: true,
      },
      {
        id: "avalon",
        name: "Avalon Green",
        directoryList: "vendors",
      },
    ],
    contacts: [
      {
        id: "c1",
        name: "Avalon Green · Planner",
        directoryList: "vendors",
        isDayOfContact: false,
        phone: null,
        email: null,
        photoData: null,
      },
      {
        id: "c2",
        name: "Marie Wiewiora",
        directoryList: "vendors",
        isDayOfContact: true,
        phone: "555",
        email: null,
        photoData: null,
      },
    ],
    guestPeople: [{ id: "guest-1", name: "Random Guest", householdLabel: "Random · City" }],
  });

  assert.ok(filterEntriesByTab(entries, "day-of").some((entry) => entry.name === "Andi"));
  assert.ok(filterEntriesByTab(entries, "day-of").some((entry) => entry.name === "Marie Wiewiora"));
  assert.ok(filterEntriesByTab(entries, "vendors").some((entry) => entry.name.includes("Avalon")));
  assert.ok(filterEntriesByTab(entries, "guests").some((entry) => entry.name === "Random Guest"));
});

test("resolvePrimaryList only assigns vendors/guests when explicit", () => {
  assert.equal(resolvePrimaryList({ kind: "contact", directoryList: null }), "vendors");
  assert.equal(resolvePrimaryList({ kind: "person", directoryList: null }), null);
  assert.equal(resolvePrimaryList({ kind: "person", directoryList: "guests" }), "guests");
});

test("buildDirectoryEntries prefers person records over duplicate guest names", () => {
  const entries = buildDirectoryEntries({
    persons: [{ id: "shelly", name: "Shelly", isDayOfContact: true }],
    contacts: [],
    guestPeople: [{ id: "guest-1", name: "Shelly", householdLabel: "Shelly · Orlando" }],
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.profileId, profileIdForPerson("shelly"));
  assert.equal(entries[0]?.isDayOfContact, true);
});

test("vendorSubtitle extracts the role after the dot separator", () => {
  assert.equal(vendorSubtitle("Avalon Green · Planner"), "Planner");
});

test("classifyNameGroup maps rehearsal dinner sections into party and family", () => {
  assert.equal(classifyNameGroup("Bri", ["Bri"], ["Shelly"]), "party");
});

test("parseProfileId round-trips person, contact, and guest ids", () => {
  assert.deepEqual(parseProfileId("person:david"), { kind: "person", id: "david" });
  assert.equal(parseProfileId("invalid"), null);
});

test("filterDirectoryEntries searches names and subtitles", () => {
  const entries = buildDirectoryEntries({
    persons: [{ id: "bri", name: "Bri", isDayOfContact: true }],
    contacts: [
      {
        id: "c1",
        name: "Avalon Green · Planner",
        directoryList: "vendors",
        isDayOfContact: false,
        phone: null,
        email: null,
        photoData: null,
      },
    ],
    guestPeople: [],
  });
  assert.equal(filterDirectoryEntries(entries, "avalon").length, 1);
});

test("groupDirectoryEntries filters by group", () => {
  const entries = buildDirectoryEntries({
    persons: [{ id: "bri", name: "Bri", isDayOfContact: true }],
    contacts: [
      {
        id: "c1",
        name: "Avalon Green · Planner",
        directoryList: "vendors",
        isDayOfContact: false,
        phone: null,
        email: null,
        photoData: null,
      },
    ],
    guestPeople: [],
  });
  assert.ok(groupDirectoryEntries(entries, "vendor").length >= 1);
});
