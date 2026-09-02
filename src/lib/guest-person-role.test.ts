import assert from "node:assert/strict";
import { test } from "node:test";
import {
  directoryLabelForRole,
  guestPersonRoleLabel,
  nextGuestPersonRole,
  resolveGuestPersonRole,
} from "@/lib/guest-person-role";

test("resolveGuestPersonRole maps labels", () => {
  assert.equal(resolveGuestPersonRole({ directoryLabel: "Wedding party" }), "wedding_party");
  assert.equal(resolveGuestPersonRole({ directoryLabel: "Family" }), "family");
  assert.equal(resolveGuestPersonRole({ directoryLabel: "Vendor" }), "vendor");
  assert.equal(resolveGuestPersonRole({ directoryLabel: null }), "guest");
});

test("nextGuestPersonRole cycles through roles", () => {
  assert.equal(nextGuestPersonRole("guest"), "wedding_party");
  assert.equal(nextGuestPersonRole("wedding_party"), "family");
  assert.equal(nextGuestPersonRole("family"), "vendor");
  assert.equal(nextGuestPersonRole("vendor"), "guest");
});

test("directoryLabelForRole returns labels", () => {
  assert.equal(directoryLabelForRole("guest"), null);
  assert.equal(guestPersonRoleLabel("wedding_party"), "Wedding");
});
