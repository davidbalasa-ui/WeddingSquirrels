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
  profileIdForContact,
  profileIdForGuestPerson,
  profileIdForPerson,
  resolveIsDayOfContact,
  resolvePrimaryList,
  vendorSubtitle,
} from "./people-directory";

test("isDayOfContactName matches bridal party and family roster names", () => {
  assert.equal(isDayOfContactName("Andi"), true);
  assert.equal(isDayOfContactName("Avalon Green"), false);
});

test("resolveIsDayOfContact uses only the saved checkbox flag", () => {
  assert.equal(resolveIsDayOfContact({ isDayOfContact: true }), true);
  assert.equal(resolveIsDayOfContact({ isDayOfContact: false, directoryList: "day-of" }), true);
  assert.equal(resolveIsDayOfContact({ isDayOfContact: false }), false);
});

test("day-of tab only includes guests or vendors with the checkbox on", () => {
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
    guestPeople: [
      {
        id: "guest-1",
        name: "Random Guest",
        householdLabel: "Random · City",
        isDayOfContact: false,
      },
      {
        id: "guest-2",
        name: "Denise Bordeaux",
        householdLabel: "Denise Bordeaux",
        address: "123 Main St",
        rsvpLabel: "No reply",
        isDayOfContact: true,
      },
    ],
  });

  const dayOf = filterEntriesByTab(entries, "day-of");
  assert.equal(
    dayOf.some((entry) => entry.name === "Andi"),
    false,
    "unlisted person records must not appear on day-of",
  );
  assert.ok(dayOf.some((entry) => entry.name === "Marie Wiewiora"));
  assert.ok(dayOf.some((entry) => entry.name === "Denise Bordeaux"));
  assert.equal(
    dayOf.find((entry) => entry.name === "Denise Bordeaux")?.address,
    "123 Main St",
  );
  assert.ok(filterEntriesByTab(entries, "vendors").some((entry) => entry.name.includes("Avalon")));
  assert.ok(filterEntriesByTab(entries, "guests").some((entry) => entry.name === "Random Guest"));
});

test("resolvePrimaryList only assigns vendors/guests when explicit", () => {
  assert.equal(resolvePrimaryList({ kind: "contact", directoryList: null }), "vendors");
  assert.equal(resolvePrimaryList({ kind: "person", directoryList: null }), null);
  assert.equal(resolvePrimaryList({ kind: "person", directoryList: "guests" }), "guests");
});

test("buildDirectoryEntries prefers guest records over unlisted person duplicates", () => {
  const entries = buildDirectoryEntries({
    persons: [{ id: "shelly", name: "Shelly", isDayOfContact: true }],
    contacts: [],
    guestPeople: [{ id: "guest-1", name: "Shelly", householdLabel: "Shelly · Orlando" }],
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.profileId, profileIdForGuestPerson("guest-1"));
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
  assert.equal(profileIdForPerson("shelly"), "person:shelly");
  assert.equal(profileIdForContact("c1"), "contact:c1");
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

test("namesMatch equates first names of sufficient length", () => {
  assert.equal(namesMatch("Kurt Huizenga", "Kurt"), true);
  assert.equal(normalizePersonName("Denise  Bordeaux"), "denise bordeaux");
});
