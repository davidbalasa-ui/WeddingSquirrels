import assert from "node:assert/strict";
import { test } from "node:test";
import { visibleProfileSections } from "./people-experience";
import type { PeopleProfile } from "./people-profile";

function guestOnlyProfile(overrides: Partial<PeopleProfile> = {}): PeopleProfile {
  return {
    profileId: "guest:gp1",
    name: "Test Guest",
    subtitle: "Household",
    photoSrc: null,
    phone: null,
    email: null,
    roles: ["Guest"],
    directoryLabel: null,
    primaryList: "guests",
    isDayOfContact: false,
    canEditLabel: false,
    canEditPrimaryList: false,
    canEditDayOf: false,
    canEditRsvp: true,
    canEditName: true,
    canEditPhoto: true,
    contactId: null,
    canEditContact: false,
    guestHouseholdId: "guest-house-1",
    canEditGuestPhone: true,
    canDelete: false,
    canSeeTasks: false,
    openTasks: [],
    completedTaskCount: 0,
    assignments: [],
    guestInfo: { household: "Household", rsvpStatus: "pending", table: null },
    gifts: [],
    vendorContext: null,
    stayLabel: null,
    mealStatus: null,
    budgetContracts: [],
    relatedLinks: [],
    ...overrides,
  };
}

test("guest-only profile shows contact section when household phone is editable", () => {
  const sections = visibleProfileSections(guestOnlyProfile());
  assert.equal(sections.includes("contact"), true);
});

test("contact editor takes precedence — guest phone hidden when contact is editable", () => {
  const sections = visibleProfileSections(
    guestOnlyProfile({
      canEditContact: true,
      canEditGuestPhone: false,
      email: "vendor@example.com",
    }),
  );
  assert.equal(sections.includes("contact"), true);
});
