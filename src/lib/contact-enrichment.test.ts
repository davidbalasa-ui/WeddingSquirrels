import assert from "node:assert/strict";
import test from "node:test";
import {
  CONTACT_ENRICHMENT_SOURCES,
  formatEnrichmentDryRunRow,
  planContactEnrichment,
  type EnrichmentSnapshot,
} from "./contact-enrichment";

function snapshot(overrides: Partial<EnrichmentSnapshot> = {}): EnrichmentSnapshot {
  return {
    persons: [],
    guestPeople: [],
    guests: [],
    contacts: [],
    ...overrides,
  };
}

test("planContactEnrichment adds guest phone when empty and preserves canonical name", () => {
  const plan = planContactEnrichment(
    snapshot({
      persons: [{ id: "andi_cartwright", name: "Andi Cartwright", directoryList: null, isDayOfContact: false }],
      guestPeople: [
        {
          id: "gp-andi",
          name: "Andi Cartwright",
          personId: "andi_cartwright",
          rsvpStatus: "pending",
          photoData: null,
          guestId: "g-andi",
        },
      ],
      guests: [
        {
          id: "g-andi",
          phone: null,
          street: null,
          city: null,
          state: null,
          zip: null,
          rsvpStatus: "pending",
        },
      ],
      contacts: [],
    }),
    new Map(),
  );
  const row = plan.rows.find((r) => r.sourceName === "Andy Cartwright");
  assert.ok(row);
  assert.equal(row?.matchConfidence, "HIGH");
  assert.equal(row?.phoneAction, "ADD_PHONE");
  assert.equal(row?.nameAction, "PRESERVE_CANONICAL_NAME");
  assert.equal(plan.guestPhoneUpdates.length, 1);
  assert.equal(plan.guestPhoneUpdates[0]?.phone, "231-329-3263");
});

test("planContactEnrichment detects phone conflict", () => {
  const plan = planContactEnrichment(
    snapshot({
      persons: [{ id: "bri", name: "Bri Eling", directoryList: null, isDayOfContact: false }],
      guestPeople: [
        {
          id: "gp-bri",
          name: "Bri Eling",
          personId: "bri",
          rsvpStatus: "attending",
          photoData: null,
          guestId: "g-bri",
        },
      ],
      guests: [
        {
          id: "g-bri",
          phone: "555-0000",
          street: null,
          city: null,
          state: null,
          zip: null,
          rsvpStatus: "attending",
        },
      ],
      contacts: [],
    }),
    new Map(),
  );
  const row = plan.rows.find((r) => r.canonicalPersonName === "Bri Eling");
  assert.equal(row?.phoneAction, "PHONE_CONFLICT");
  assert.equal(plan.guestPhoneUpdates.length, 0);
});

test("planContactEnrichment preserves mailing address over city-only source", () => {
  const plan = planContactEnrichment(
    snapshot({
      persons: [{ id: "victoria_owens", name: "Victoria Owens", directoryList: null, isDayOfContact: false }],
      guestPeople: [
        {
          id: "gp-v",
          name: "Victoria Owens",
          personId: "victoria_owens",
          rsvpStatus: "pending",
          photoData: null,
          guestId: "g-v",
        },
      ],
      guests: [
        {
          id: "g-v",
          phone: null,
          street: "123 Main St",
          city: "Grand Rapids",
          state: "MI",
          zip: "49503",
          rsvpStatus: "pending",
        },
      ],
      contacts: [],
    }),
    new Map(),
  );
  const row = plan.rows.find((r) => r.sourceName === "Victoria");
  assert.equal(row?.locationAction, "PRESERVE_EXISTING_ADDRESS");
  assert.equal(plan.guestLocationUpdates.length, 0);
});

test("planContactEnrichment marks missing photo file", () => {
  const plan = planContactEnrichment(
    snapshot({
      persons: [{ id: "trinity_medler", name: "Trinity Medler", directoryList: null, isDayOfContact: false }],
      guestPeople: [
        {
          id: "gp-t",
          name: "Trinity Medler",
          personId: "trinity_medler",
          rsvpStatus: "pending",
          photoData: null,
          guestId: "g-t",
        },
      ],
      guests: [{ id: "g-t", phone: null, street: null, city: null, state: null, zip: null, rsvpStatus: "pending" }],
      contacts: [],
    }),
    new Map(),
  );
  const row = plan.rows.find((r) => r.sourceName === "Trinity Medler");
  assert.equal(row?.photoAction, "PHOTO_FILE_MISSING");
});

test("formatEnrichmentDryRunRow always shows PRESERVE_CANONICAL_NAME", () => {
  const text = formatEnrichmentDryRunRow({
    sourceName: "Andy Cartwright",
    canonicalPersonName: "Andi Cartwright",
    personId: "andi_cartwright",
    guestPersonId: "gp",
    contactId: null,
    matchConfidence: "HIGH",
    matchReason: null,
    sourcePhone: "231-329-3263",
    currentPhone: null,
    phoneAction: "ADD_PHONE",
    sourceLocation: "Muskegon, MI",
    currentAddressLocation: null,
    locationAction: "ADD_LOCATION",
    sourcePhoto: "andi_cartwright.jpg",
    photoFileFound: false,
    currentPhotoExists: false,
    photoAction: "PHOTO_FILE_MISSING",
    contactAction: "NO_CONTACT_NEEDED",
    nameAction: "PRESERVE_CANONICAL_NAME",
  });
  assert.match(text, /NAME ACTION: PRESERVE_CANONICAL_NAME/);
});

test("CONTACT_ENRICHMENT_SOURCES has eight curated rows", () => {
  assert.equal(CONTACT_ENRICHMENT_SOURCES.length, 8);
});
