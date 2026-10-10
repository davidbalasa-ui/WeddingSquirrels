import assert from "node:assert/strict";
import { test } from "node:test";
import { planPlaybookRewords } from "./playbook-corrections";

const OLD = "Avalon is contracted to assist. Exact timing (before ceremony vs 4:00 PM) is still TBD.";

test("the license signing gets its 4:00 PM time while the row reads as the app wrote it", () => {
  const [row] = planPlaybookRewords([{ id: "p1", sourceKey: "avalon-license", title: "Marriage license signing", notes: OLD }]);
  assert.equal(row?.before, OLD);
  assert.equal(row?.correction, "time TBD → 4:00 PM");
  assert.equal(row?.notes, "Avalon is contracted to assist. Signing is at 4:00 PM, immediately after the recessional.");
});

test("a license note David changed is left alone", () => {
  assert.deepEqual(planPlaybookRewords([{ id: "p1", sourceKey: "avalon-license", title: "Marriage license signing", notes: "Ask Avalon" }]), []);
  assert.deepEqual(planPlaybookRewords([{ id: "p1", sourceKey: "avalon-license", title: "Marriage license signing", notes: null }]), []);
});
