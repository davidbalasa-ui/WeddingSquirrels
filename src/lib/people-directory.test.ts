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
  parsePeopleAttendanceFilter,
  parsePeopleRoleFilter,
  parsePeopleView,
  parseProfileId,
  profileIdForContact,
  profileIdForGuestPerson,
  profileIdForPerson,
  canonicalProfileIdForSource,
  countPeopleHubTabs,
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
  assert.equal(resolvePrimaryList({ kind: "contact", directoryList: "day-of" }), null);
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

test("parsePeopleRoleFilter and parsePeopleAttendanceFilter accept combo values", () => {
  assert.equal(parsePeopleRoleFilter("family"), "family");
  assert.equal(parsePeopleRoleFilter("nope"), null);
  assert.equal(parsePeopleAttendanceFilter("not_attending"), "not_attending");
  assert.equal(parsePeopleAttendanceFilter("maybe"), null);
  assert.equal(parsePeopleView("table"), "table");
  assert.equal(parsePeopleView("cards"), null);
});

function contactRow(
  id: string,
  name: string,
  extras: Partial<Parameters<typeof buildDirectoryEntries>[0]["contacts"][number]> = {},
) {
  return {
    id,
    name,
    phone: extras.phone ?? null,
    email: extras.email ?? null,
    photoData: extras.photoData ?? null,
    directoryList: extras.directoryList ?? "vendors",
    ...extras,
  };
}

function guestRow(
  id: string,
  name: string,
  extras: Partial<Parameters<typeof buildDirectoryEntries>[0]["guestPeople"][number]> = {},
) {
  return {
    id,
    name,
    householdLabel: extras.householdLabel ?? name,
    ...extras,
  };
}

test("Person + linked GuestPerson collapse to one canonical Person", () => {
  const entries = buildDirectoryEntries({
    persons: [{ id: "wendy_rush", name: "Wendy Rush" }],
    contacts: [],
    guestPeople: [guestRow("gp-wendy", "Wendy Rush", { personId: "wendy_rush", rsvpLabel: "Yes", tableLabel: "Table 3" })],
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.profileId, profileIdForPerson("wendy_rush"));
  assert.equal(entries[0]?.guestPersonId, "gp-wendy");
  assert.ok(entries[0]?.lists.includes("guests"));
  assert.equal(entries[0]?.rsvpLabel, "Yes");
  assert.equal(entries[0]?.tableLabel, "Table 3");
  assert.equal(filterEntriesByTab(entries, "guests").length, 1);
});

test("Person + linked Contact collapse to one canonical Person", () => {
  const entries = buildDirectoryEntries({
    persons: [{ id: "belle_genton", name: "Belle Genton" }],
    contacts: [
      contactRow("c-belle", "Belle Genton", {
        personId: "belle_genton",
        phone: "555",
        photoData: "data:image/jpeg;base64,xx",
      }),
    ],
    guestPeople: [],
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.profileId, profileIdForPerson("belle_genton"));
  assert.equal(entries[0]?.contactId, "c-belle");
  assert.equal(entries[0]?.phone, "555");
  assert.equal(entries[0]?.photoSrc, "data:image/jpeg;base64,xx");
  assert.ok(entries[0]?.lists.includes("vendors"));
  assert.equal(filterEntriesByTab(entries, "vendors").length, 1);
});

test("Person + GuestPerson + Contact is one All identity and appears in both role tabs", () => {
  const entries = buildDirectoryEntries({
    persons: [{ id: "bri", name: "Bri Eling" }],
    contacts: [contactRow("c-bri", "Bri Eling", { personId: "bri", email: "bri@example.com" })],
    guestPeople: [
      guestRow("gp-bri", "Bri Eling", {
        personId: "bri",
        householdLabel: "Bri & Evan · City",
        rsvpLabel: "Yes",
      }),
    ],
  });
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.profileId, profileIdForPerson("bri"));
  assert.deepEqual(entries[0]?.lists.slice().sort(), ["guests", "vendors"]);
  assert.equal(entries[0]?.email, "bri@example.com");
  assert.equal(entries[0]?.rsvpLabel, "Yes");
  assert.equal(filterEntriesByTab(entries, "guests").length, 1);
  assert.equal(filterEntriesByTab(entries, "vendors").length, 1);
  assert.equal(filterEntriesByTab(entries, "all").length, 1);
  assert.equal(
    countPeopleHubTabs({ entries, guestPersonCount: 1, dayOfContactCount: 0 }).all,
    1,
  );
});

test("similar-named canonical Persons never dedupe", () => {
  const entries = buildDirectoryEntries({
    persons: [
      { id: "david", name: "David", directoryList: "guests" },
      { id: "david_berman", name: "David Berman", directoryList: "guests" },
      { id: "katie", name: "Katie", directoryList: "guests" },
      { id: "katie_kippe", name: "Katie Kippe" },
    ],
    contacts: [],
    guestPeople: [guestRow("gp-katie-kippe", "Katie Kippe", { personId: "katie_kippe" })],
  });
  const ids = entries.map((entry) => entry.profileId).sort();
  assert.ok(ids.includes(profileIdForPerson("david")));
  assert.ok(ids.includes(profileIdForPerson("david_berman")));
  assert.ok(ids.includes(profileIdForPerson("katie")));
  assert.ok(ids.includes(profileIdForPerson("katie_kippe")));
  assert.equal(ids.length, 4);
});

test("unlinked legacy guest and contact entries still work", () => {
  const entries = buildDirectoryEntries({
    persons: [{ id: "david", name: "David" }],
    contacts: [contactRow("c-avalon", "Avalon Green · Planner")],
    guestPeople: [
      guestRow("gp-random", "Random Guest"),
      guestRow("gp-david", "David"),
    ],
  });
  assert.ok(entries.some((entry) => entry.profileId === profileIdForContact("c-avalon")));
  assert.ok(entries.some((entry) => entry.profileId === profileIdForGuestPerson("gp-random")));
  assert.equal(
    entries.find((entry) => entry.profileId === profileIdForPerson("david")),
    undefined,
    "unlisted Person without personId links stays hidden",
  );
  const davidGuest = entries.find((entry) => entry.profileId === profileIdForGuestPerson("gp-david"));
  assert.ok(davidGuest, "unlinked GuestPerson David remains its own fallback entry");
  assert.equal(davidGuest?.personId, null);
});

test("canonicalProfileIdForSource prefers personId when present", () => {
  assert.equal(
    canonicalProfileIdForSource({ kind: "guest", id: "gp-1", personId: "wendy_rush" }),
    profileIdForPerson("wendy_rush"),
  );
  assert.equal(
    canonicalProfileIdForSource({ kind: "contact", id: "c-1", personId: "belle_genton" }),
    profileIdForPerson("belle_genton"),
  );
  assert.equal(
    canonicalProfileIdForSource({ kind: "guest", id: "gp-1", personId: null }),
    profileIdForGuestPerson("gp-1"),
  );
});
