import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PHASE_1B1_CONTACT_LINKS,
  PHASE_1B1_CREATES,
  PHASE_1B1_EXPECTED_END,
  PHASE_1B1_EXPECTED_START,
  PHASE_1B1_RENAMES,
  assertPhase1b1Manifest,
  phase1b1GuestPersonLinks,
} from "./phase-1b1-manifest";

test("Phase 1B-1 manifest counts reconcile", () => {
  assertPhase1b1Manifest();
  assert.equal(PHASE_1B1_CREATES.length, 62);
  assert.equal(PHASE_1B1_RENAMES.length, 6);
  assert.equal(phase1b1GuestPersonLinks().length, 72);
  assert.equal(PHASE_1B1_CONTACT_LINKS.length, 1);
  assert.equal(
    PHASE_1B1_EXPECTED_START.persons + PHASE_1B1_CREATES.length,
    PHASE_1B1_EXPECTED_END.persons,
  );
});

test("Phase 1B-1 does not touch deferred identities", () => {
  const gpIds = new Set(phase1b1GuestPersonLinks().map((row) => row.guestPersonId));
  const forbiddenGp = [
    "cmtk1ptxs0001lc0471bo6gc5", // David
    "cmtk102xg0001lc04v266e3c8", // Haley
    "cmsx9u57c000djsjrbwr3gs44", // Katie Wiewiora
    "cmtkc8dgc000njl049md96tta", // Belle +1
  ];
  for (const id of forbiddenGp) assert.equal(gpIds.has(id), false);
  assert.equal(
    PHASE_1B1_RENAMES.some((row) => ["david", "haley", "katie"].includes(row.id)),
    false,
  );
  assert.equal(
    PHASE_1B1_CONTACT_LINKS.some((row) => row.contactId !== "cmtksa1gc0000ih04vwuu5age"),
    false,
  );
  assert.equal(
    phase1b1GuestPersonLinks().some((row) => row.guestPersonId.endsWith("plus")),
    false,
  );
});
