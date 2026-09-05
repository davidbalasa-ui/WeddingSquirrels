import assert from "node:assert/strict";
import { test } from "node:test";
import { composeDayOfView } from "./day-of";
import {
  CANDIDATE_WEDDING_TIMELINE,
  dayOfRuntimeReadsDatabaseNotCandidates,
  planCandidateWeddingImport,
  proposedWeddingSortOrders,
  reviewCandidateWeddingTimeline,
  type ExistingTimelineRow,
} from "./day-of-bootstrap";
import {
  APPROVED_PIN_LINKS,
  APPROVED_UNFLAG_FAMILY_CONTACTS,
  APPROVED_VENDOR_DAY_OF_FLAGS,
  inspectKurtPresence,
  pinLinkByNameWouldBeRejected,
  planApprovedContactFlags,
  planApprovedPinLinks,
  planKurtMcWrite,
  plannedAssignmentAssignees,
  wendyIsLabeledMc,
} from "./day-of-confirmed";
import { getWeddingPhase } from "./wedding-phase";

const DETROIT = "America/Detroit";

function existing(partial: Partial<ExistingTimelineRow> & Pick<ExistingTimelineRow, "id" | "seedKey">): ExistingTimelineRow {
  return {
    startAt: "9:00 AM",
    endAt: "11:00 AM",
    notes: "Settle in at Airbnb",
    sortOrder: 0,
    schedule: "wedding",
    ...partial,
  };
}

test("candidate import detects a missing row", () => {
  const review = reviewCandidateWeddingTimeline([]);
  assert.equal(CANDIDATE_WEDDING_TIMELINE.length, 19);
  assert.equal(review.length, 19);
  assert.equal(review.every((row) => row.status === "MISSING"), true);
  assert.equal(review.some((row) => row.seedKey === "wedding_settle_in"), true);
});

test("existing TimelineBlock with the same seedKey is not overwritten", () => {
  const edited = existing({
    id: "live-1",
    seedKey: "wedding_settle_in",
    startAt: "8:45 AM",
    endAt: "10:50 AM",
    notes: "Edited settle notes",
    sortOrder: 12,
  });
  const plan = planCandidateWeddingImport([edited], ["wedding_settle_in"]);
  assert.deepEqual(plan.inserts, []);
  assert.deepEqual(plan.refusedOverwrite, ["wedding_settle_in"]);
});

test("edited startAt, endAt, notes, and sortOrder survive re-review", () => {
  const edited = existing({
    id: "live-1",
    seedKey: "wedding_settle_in",
    startAt: "8:45 AM",
    endAt: "10:50 AM",
    notes: "Edited settle notes",
    sortOrder: 12,
  });
  const row = reviewCandidateWeddingTimeline([edited]).find((item) => item.seedKey === "wedding_settle_in");
  assert.equal(row?.status, "DIFFERENT");
  assert.deepEqual(row?.differences.sort(), ["endAt", "notes", "sortOrder", "startAt"]);
  const again = planCandidateWeddingImport([edited], ["wedding_settle_in"]);
  assert.equal(again.inserts.length, 0);
});

test("selected missing candidate row can be inserted", () => {
  const plan = planCandidateWeddingImport([], ["wedding_settle_in"]);
  assert.equal(plan.inserts.length, 1);
  assert.equal(plan.inserts[0]?.seedKey, "wedding_settle_in");
  assert.equal(plan.inserts[0]?.startAt, "9:00 AM");
  assert.equal(plan.inserts[0]?.endAt, "11:00 AM");
  assert.equal(plan.inserts[0]?.notes.includes("Settle in at Airbnb"), true);
  assert.equal(plan.inserts[0]?.schedule, "wedding");
});

test("unselected missing candidate row is not inserted", () => {
  const plan = planCandidateWeddingImport([], ["wedding_settle_in"]);
  assert.equal(plan.inserts.some((row) => row.seedKey === "wedding_diy_hair"), false);
  assert.equal(plan.skippedUnselected.includes("wedding_diy_hair"), true);
});

test("candidate notes never invent an endAt", () => {
  const open = CANDIDATE_WEDDING_TIMELINE.find((row) => row.seedKey === "wedding_pack_up");
  assert.equal(open?.endAt, null);
});

test("proposed sortOrder is chronological, not file order", () => {
  const proposed = proposedWeddingSortOrders();
  assert.ok((proposed.get("wedding_settle_in") ?? 99) < (proposed.get("wedding_vendor_arrival") ?? -1));
  assert.ok((proposed.get("wedding_vendor_arrival") ?? 99) < (proposed.get("wedding_diy_hair") ?? -1));
});

test("production runtime /day uses provided DB blocks, not candidate constants", () => {
  assert.equal(dayOfRuntimeReadsDatabaseNotCandidates(), true);
  const phase = getWeddingPhase({
    weddingDate: new Date("2026-10-16T16:00:00.000Z"),
    timezone: DETROIT,
    now: new Date("2026-10-16T14:42:00.000Z"),
  });
  const view = composeDayOfView({
    phase,
    now: new Date("2026-10-16T14:42:00.000Z"),
    coupleNames: "David & Haley",
    weddingDateLabel: "Friday, October 16, 2026",
    blocks: [],
    contacts: [],
    assignments: [],
    linkedPersonId: "david",
    canSeeContacts: true,
  });
  assert.equal(view.position.fullDay.length, 0);
  assert.equal(CANDIDATE_WEDDING_TIMELINE.length, 19);
});

test("David, Haley, and Mother-in-law link by exact PinAccount id", () => {
  const accounts = [
    { id: "cmtnslqbt0000js87zguxlq64", name: "David", linkedPersonId: null },
    { id: "cmtnslqgw0001js87n7pfdwr4", name: "Haley", linkedPersonId: null },
    { id: "cmtnslqmj0002js871zyszgyc", name: "Mother in law", linkedPersonId: null },
  ];
  const plan = planApprovedPinLinks(accounts);
  assert.deepEqual(
    plan.updates.map((row) => [row.pinAccountId, row.to]),
    [
      ["cmtnslqbt0000js87zguxlq64", "david"],
      ["cmtnslqgw0001js87n7pfdwr4", "haley"],
      ["cmtnslqmj0002js871zyszgyc", "shelly"],
    ],
  );
  assert.deepEqual(plan.mismatches, []);
  assert.equal(
    APPROVED_PIN_LINKS.every((row) => row.pinAccountId.startsWith("cmt")),
    true,
  );
});

test("no PinAccount is linked by name matching", () => {
  const decoy = [
    { id: "other-david", name: "David", linkedPersonId: null },
    { id: "cmtnslqbt0000js87zguxlq64", name: "David", linkedPersonId: null },
  ];
  const plan = planApprovedPinLinks(decoy);
  assert.equal(plan.updates.some((row) => row.pinAccountId === "other-david"), false);
  assert.equal(
    pinLinkByNameWouldBeRejected([{ id: "random", name: "David", linkedPersonId: null }], "David", "david"),
    true,
  );
});

test("vendor Contact flags update only exact approved ids", () => {
  const contacts = [
    ...APPROVED_VENDOR_DAY_OF_FLAGS.map((row) => ({
      id: row.contactId,
      name: row.expectedName,
      directoryLabel: null,
      isDayOfContact: false,
      sortOrder: row.expectedSortOrder,
      hasPhone: true,
      hasEmail: false,
    })),
    {
      id: "unapproved-extra",
      name: "Someone Else",
      directoryLabel: null,
      isDayOfContact: false,
      sortOrder: 99,
      hasPhone: true,
      hasEmail: false,
    },
  ];
  const plan = planApprovedContactFlags(contacts, APPROVED_VENDOR_DAY_OF_FLAGS);
  assert.equal(plan.updates.length, 5);
  assert.equal(plan.updates.every((row) => row.isDayOfContact === true), true);
  assert.equal(plan.updates.some((row) => row.contactId === "unapproved-extra"), false);
});

test("Belle Family rows become non-Day-of where approved", () => {
  const contacts = APPROVED_UNFLAG_FAMILY_CONTACTS.map((row) => ({
    id: row.contactId,
    name: row.expectedName,
    directoryLabel: "Family",
    isDayOfContact: true,
    sortOrder: row.expectedSortOrder,
    hasPhone: false,
    hasEmail: false,
  }));
  const plan = planApprovedContactFlags(contacts, APPROVED_UNFLAG_FAMILY_CONTACTS);
  assert.deepEqual(
    plan.updates.map((row) => [row.contactId, row.isDayOfContact]),
    [
      ["cmtksa1gc0000ih04vwuu5age", false],
      ["cmtksbfxr0000l504jmwom5pu", false],
    ],
  );
});

test("contact snapshot mismatch stops the write", () => {
  const plan = planApprovedContactFlags(
    [
      {
        id: "cmt0oqlfj000qfhb8ze02e4o6",
        name: "Changed Name",
        directoryLabel: null,
        isDayOfContact: false,
        sortOrder: 0,
        hasPhone: true,
        hasEmail: false,
      },
    ],
    APPROVED_VENDOR_DAY_OF_FLAGS.slice(0, 1),
  );
  assert.equal(plan.updates.length, 0);
  assert.equal(plan.mismatches.length, 1);
});

test("no phone or email is fabricated for Kurt or Wendy", () => {
  const kurt = inspectKurtPresence({ contacts: [], personIds: [] });
  const write = planKurtMcWrite(kurt);
  assert.equal(write.createContact, false);
  assert.equal(write.update, null);
  assert.equal(wendyIsLabeledMc([]), false);
  assert.equal(
    CANDIDATE_WEDDING_TIMELINE.some((row) => /wendy/i.test(row.notes)),
    false,
  );
});

test("Kurt MC write uses only an existing Contact", () => {
  const withKurt = inspectKurtPresence({
    contacts: [
      {
        id: "kurt-contact",
        name: "Kurt Huizenga",
        directoryLabel: null,
        isDayOfContact: false,
        sortOrder: 8,
        hasPhone: true,
        hasEmail: false,
      },
    ],
    personIds: ["kurt"],
  });
  assert.equal(withKurt.hasAuthoritativeChannel, true);
  assert.equal(planKurtMcWrite(withKurt).update?.contactId, "kurt-contact");
});

test("Wendy is not labeled MC", () => {
  assert.equal(
    wendyIsLabeledMc([
      {
        name: "Wendy Rush",
        directoryLabel: "Family",
      },
    ]),
    false,
  );
  assert.equal(
    wendyIsLabeledMc([
      {
        name: "Wendy Rush · Mistress of Ceremonies",
        directoryLabel: null,
      },
    ]),
    true,
  );
});

test("Ice / S’mores / Lunch have no planned assignees", () => {
  assert.deepEqual(plannedAssignmentAssignees(), []);
});
