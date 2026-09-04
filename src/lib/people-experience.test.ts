import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildDirectoryEntries,
  canonicalProfileIdForSource,
  filterEntriesByTab,
  profileIdForContact,
  profileIdForGuestPerson,
  profileIdForPerson,
} from "./people-directory";
import {
  directoryRoleContext,
  filterDirectoryByAttendance,
  omitFabricatedValue,
  peopleHubTabCounts,
  presentDirectoryRow,
  presentDirectoryRows,
  profileContactActions,
  profilePhotoSrc,
  profileRoleChips,
  searchDirectoryEntries,
  tasksEmptyLabel,
  visibleProfileSections,
} from "./people-experience";
import type { PeopleProfile } from "./people-profile";
import { roleEditMustPreservePersonId } from "./people-identity-write";

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

function emptyProfile(overrides: Partial<PeopleProfile> = {}): PeopleProfile {
  return {
    profileId: "person:sarah",
    name: "Sarah Chen",
    subtitle: null,
    photoSrc: null,
    phone: null,
    email: null,
    roles: ["Family & helpers"],
    directoryLabel: null,
    primaryList: "guests",
    isDayOfContact: false,
    canEditLabel: false,
    canEditPrimaryList: false,
    canEditDayOf: false,
    canDelete: false,
    canSeeTasks: false,
    openTasks: [],
    completedTaskCount: 0,
    assignments: [],
    guestInfo: null,
    gifts: [],
    vendorContext: null,
    stayLabel: null,
    mealStatus: null,
    budgetContracts: [],
    relatedLinks: [],
    ...overrides,
  };
}

test("ALL returns one card for Person + GuestPerson", () => {
  const entries = buildDirectoryEntries({
    persons: [{ id: "wendy_rush", name: "Wendy Rush" }],
    contacts: [],
    guestPeople: [guestRow("gp-wendy", "Wendy Rush", { personId: "wendy_rush", rsvpLabel: "Attending" })],
  });
  const cards = presentDirectoryRows(entries);
  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.profileId, profileIdForPerson("wendy_rush"));
  assert.equal(cards[0]?.roleContext, "Guest");
  assert.equal(cards[0]?.secondary, "RSVP accepted");
  assert.equal(peopleHubTabCounts(entries).all, 1);
});

test("ALL returns one card for Person + Contact", () => {
  const entries = buildDirectoryEntries({
    persons: [{ id: "belle_genton", name: "Belle Genton" }],
    contacts: [
      contactRow("c-belle", "Belle Genton · Photography", {
        personId: "belle_genton",
        directoryLabel: "Photography",
      }),
    ],
    guestPeople: [],
  });
  const cards = presentDirectoryRows(entries);
  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.profileId, profileIdForPerson("belle_genton"));
  assert.equal(cards[0]?.roleContext, "Vendor contact");
  assert.equal(cards[0]?.secondary, "Photography");
});

test("ALL returns one card for Person + GuestPerson + Contact", () => {
  const entries = buildDirectoryEntries({
    persons: [{ id: "bri", name: "Bri Eling" }],
    contacts: [contactRow("c-bri", "Bri Eling", { personId: "bri" })],
    guestPeople: [guestRow("gp-bri", "Bri Eling", { personId: "bri", rsvpLabel: "Attending" })],
  });
  const cards = presentDirectoryRows(entries);
  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.roleContext, "Guest · Vendor");
  assert.equal(peopleHubTabCounts(entries).all, 1);
});

test("role tabs can contain the same canonical Person independently", () => {
  const entries = buildDirectoryEntries({
    persons: [{ id: "bri", name: "Bri Eling" }],
    contacts: [contactRow("c-bri", "Bri Eling", { personId: "bri" })],
    guestPeople: [guestRow("gp-bri", "Bri Eling", { personId: "bri" })],
  });
  const guests = filterEntriesByTab(entries, "guests").map((entry) => entry.profileId);
  const vendors = filterEntriesByTab(entries, "vendors").map((entry) => entry.profileId);
  assert.deepEqual(guests, [profileIdForPerson("bri")]);
  assert.deepEqual(vendors, [profileIdForPerson("bri")]);
  assert.equal(peopleHubTabCounts(entries).guests, 1);
  assert.equal(peopleHubTabCounts(entries).vendors, 1);
});

test("similar-named distinct Persons remain distinct in the hub", () => {
  const entries = buildDirectoryEntries({
    persons: [
      { id: "david", name: "David", directoryList: "guests" },
      { id: "david_berman", name: "David Berman", directoryList: "guests" },
    ],
    contacts: [],
    guestPeople: [],
  });
  const ids = presentDirectoryRows(entries).map((row) => row.profileId).sort();
  assert.deepEqual(ids, [profileIdForPerson("david"), profileIdForPerson("david_berman")].sort());
});

test("null-personId legacy rows remain independent hub cards", () => {
  const entries = buildDirectoryEntries({
    persons: [],
    contacts: [contactRow("c-avalon", "Avalon Green · Planner")],
    guestPeople: [guestRow("gp-random", "Random Guest")],
  });
  const ids = presentDirectoryRows(entries).map((row) => row.profileId).sort();
  assert.deepEqual(ids, [profileIdForContact("c-avalon"), profileIdForGuestPerson("gp-random")].sort());
});

test("linked guest and contact references resolve to the canonical Person", () => {
  assert.equal(
    canonicalProfileIdForSource({ kind: "guest", id: "gp-1", personId: "wendy_rush" }),
    profileIdForPerson("wendy_rush"),
  );
  assert.equal(
    canonicalProfileIdForSource({ kind: "contact", id: "c-1", personId: "belle_genton" }),
    profileIdForPerson("belle_genton"),
  );
});

test("canonical profile includes guest role data without inventing extra roles", () => {
  const profile = emptyProfile({
    guestInfo: { household: "Sarah & Alex · Chicago", rsvpStatus: "attending", table: "Table 4" },
    gifts: ["Crystal vase"],
  });
  assert.deepEqual(profileRoleChips(profile), ["Guest"]);
  assert.deepEqual(profileRoleChips(emptyProfile({ primaryList: "vendors" })), []);
  assert.ok(visibleProfileSections(profile).includes("guest"));
  assert.equal(profile.guestInfo?.table, "Table 4");
  assert.deepEqual(profile.gifts, ["Crystal vase"]);
  assert.equal(visibleProfileSections(profile).includes("vendor"), false);
});

test("canonical profile includes contact role data", () => {
  const profile = emptyProfile({
    primaryList: "vendors",
    phone: "555-0100",
    email: "belle@example.com",
    vendorContext: "Photography",
    photoSrc: "data:image/jpeg;base64,xx",
  });
  assert.deepEqual(profileRoleChips(profile), ["Vendor"]);
  const sections = visibleProfileSections(profile);
  assert.ok(sections.includes("contact"));
  assert.ok(sections.includes("vendor"));
  assert.equal(sections.includes("guest"), false);
  assert.equal(profileContactActions(profile).length, 3);
});

test("canonical profile includes both guest and contact when both are linked", () => {
  const profile = emptyProfile({
    primaryList: "vendors",
    isDayOfContact: true,
    guestInfo: { household: "Bri & Evan", rsvpStatus: "attending", table: null },
    vendorContext: "Planner",
    phone: "555-0142",
  });
  assert.deepEqual(profileRoleChips(profile), ["Guest", "Vendor", "Day-of contact"]);
  const sections = visibleProfileSections(profile);
  assert.ok(sections.includes("guest"));
  assert.ok(sections.includes("vendor"));
  assert.ok(sections.includes("contact"));
});

test("role-specific data is not lost on the unified profile", () => {
  const profile = emptyProfile({
    guestInfo: { household: "Wendy Rush", rsvpStatus: "attending", table: "Table 3 · A" },
    mealStatus: "Bridal party",
    stayLabel: "House · Room 2",
    assignments: [{ title: "Processional cue", notes: "Stand left" }],
    openTasks: [{ id: "t1", title: "Confirm florist", dueLabel: "Due today", href: "/work/t1" }],
    canSeeTasks: true,
  });
  const sections = visibleProfileSections(profile);
  assert.deepEqual(sections, ["guest", "tasks", "meals", "stay", "day-of"]);
  assert.equal(profile.guestInfo?.rsvpStatus, "attending");
  assert.equal(profile.assignments[0]?.title, "Processional cue");
});

test("restricted domain information is omitted from the profile", () => {
  const restricted = emptyProfile({
    guestInfo: null,
    stayLabel: null,
    mealStatus: null,
    budgetContracts: [],
    canSeeTasks: false,
    openTasks: [],
    assignments: [],
    relatedLinks: [],
  });
  assert.deepEqual(visibleProfileSections(restricted), []);
  assert.equal(restricted.budgetContracts.length, 0);
  assert.equal(restricted.canSeeTasks, false);
});

test("missing photo uses the initials fallback and does not invent a photo", () => {
  const row = presentDirectoryRow(
    buildDirectoryEntries({
      persons: [{ id: "sarah", name: "Sarah Chen", directoryList: "guests" }],
      contacts: [],
      guestPeople: [],
    })[0]!,
  );
  assert.equal(row.photoSrc, null);
  assert.equal(profilePhotoSrc(null), null);
  assert.equal(profilePhotoSrc("  "), null);
  assert.equal(profilePhotoSrc("data:image/jpeg;base64,xx"), "data:image/jpeg;base64,xx");
});

test("missing optional fields do not generate fake values", () => {
  const profile = emptyProfile();
  assert.equal(omitFabricatedValue(profile.phone), null);
  assert.equal(omitFabricatedValue(profile.email), null);
  assert.equal(omitFabricatedValue("N/A"), null);
  assert.equal(omitFabricatedValue("null"), null);
  assert.deepEqual(profileContactActions(profile), []);
  assert.equal(profile.photoSrc, null);
  assert.equal(profile.stayLabel, null);
  assert.equal(directoryRoleContext({
    ...buildDirectoryEntries({
      persons: [{ id: "sarah", name: "Sarah Chen", directoryList: "guests" }],
      contacts: [],
      guestPeople: [],
    })[0]!,
  }), "Guest");
});

test("profile rename/edit behavior does not alter personId", () => {
  assert.equal(roleEditMustPreservePersonId("bri", null), "bri");
  assert.equal(roleEditMustPreservePersonId("belle_genton", undefined), "belle_genton");
});

test("directory and profile search do not create or infer identity links", () => {
  const entries = buildDirectoryEntries({
    persons: [
      { id: "david", name: "David", directoryList: "guests" },
      { id: "david_berman", name: "David Berman", directoryList: "guests" },
    ],
    contacts: [contactRow("c-avalon", "Avalon Green · Planner")],
    guestPeople: [guestRow("gp-wendy", "Wendy Rush")],
  });
  const before = entries.map((entry) => entry.profileId).sort();
  const found = searchDirectoryEntries(entries, "david");
  const after = entries.map((entry) => entry.profileId).sort();
  assert.deepEqual(after, before);
  assert.ok(found.every((entry) => before.includes(entry.profileId)));
  assert.equal(found.some((entry) => entry.profileId === profileIdForPerson("david_berman")), true);
  assert.equal(
    found.some((entry) => entry.profileId === profileIdForGuestPerson("gp-wendy")),
    false,
  );
  assert.equal(searchDirectoryEntries(entries, "planner").length, 1);
});

test("human empty copy never uses database-admin phrasing", () => {
  assert.equal(tasksEmptyLabel("Sarah Chen"), "Nothing open for Sarah.");
  assert.equal(omitFabricatedValue("No records found"), "No records found");
});

test("RSVP attendance filter is presentation-only", () => {
  const entries = buildDirectoryEntries({
    persons: [],
    contacts: [],
    guestPeople: [
      guestRow("gp-1", "Ada", { rsvpLabel: "Attending" }),
      guestRow("gp-2", "Bea", { rsvpLabel: "No reply" }),
    ],
  });
  const attending = filterDirectoryByAttendance(entries, "attending");
  assert.equal(attending.length, 1);
  assert.equal(attending[0]?.name, "Ada");
  assert.equal(entries.length, 2);
});
