import assert from "node:assert/strict";
import { test } from "node:test";
import { correctionKey, pendingTaskCorrections, pendingTimelineCorrections, taskCorrectionsApplied, timelineCorrectionsApplied } from "./applied-corrections";
import type { PrintoutCorrectionsPlan } from "./printout-corrections-data";
import { planReconciledTimeline } from "./reconciled-timeline";
import { planTaskCorrections } from "./task-corrections";

function plan(): PrintoutCorrectionsPlan {
  return {
    tasks: planTaskCorrections([{ id: "b", title: "Bank and post office before the post office closes at noon", status: "todo", parentId: null }]),
    phones: [
      { label: "Pam Balasa", personName: "Pam Balasa", phone: "269-475-3751", current: null, status: "add", write: { kind: "guest", guestId: "g", phone: "269-475-3751" } },
      { label: "John Wiewiora", personName: "John Wiewiora", phone: "231-798-5825", current: "555", status: "differs", write: { kind: "guest", guestId: "h", phone: "231-798-5825" } },
    ],
    contacts: [{ name: "Victoria Resort", phone: "(269) 637-6414", directoryLabel: "Mini moon" }],
    dayJobs: [{ title: "Wendy and Kurt begin setup.", notes: "10:30 AM" }],
    dayJobRewords: [],
    playbookRewords: [],
  };
}

test("everything applied is recorded, and a recorded change is never planned again", () => {
  const first = plan();
  const applied = taskCorrectionsApplied(first);
  assert.ok(applied.keys.includes(correctionKey.taskDone(null, "Bank and post office before the post office closes at noon")));
  assert.ok(applied.lines.includes("Marked done: Bank and post office before the post office closes at noon"));
  assert.ok(applied.lines.includes("Saved Pam Balasa’s number: 269-475-3751"));
  // A number David has to pick between is not applied on its own.
  assert.equal(applied.lines.some((line) => /John/.test(line)), false);

  const again = pendingTaskCorrections(plan(), new Set(applied.keys));
  assert.equal(again.tasks.inserts.length, 0);
  assert.equal(again.tasks.marks.length, 0);
  assert.equal(again.contacts.length, 0);
  assert.equal(again.dayJobs.length, 0);
  assert.deepEqual(again.phones.map((row) => row.label), ["John Wiewiora"]);
  assert.deepEqual(taskCorrectionsApplied(again).keys, []);
});

test("a new job added already done records both, so neither comes back", () => {
  const fresh = planTaskCorrections([]);
  const keys = new Set(taskCorrectionsApplied({ ...plan(), tasks: fresh }).keys);
  assert.ok(keys.has(correctionKey.taskAdd("Send the check to Precious Peony")));
  assert.ok(keys.has(correctionKey.taskDone(null, "Send the check to Precious Peony")));
});

test("timeline: new moments are applied once; removals are never recorded and stay for David's tap", () => {
  const timeline = planReconciledTimeline([]);
  assert.ok(timeline.inserts.length > 40);
  const applied = timelineCorrectionsApplied(timeline);
  assert.ok(applied.lines.includes("Added to the Wedding Day timeline: 8:50 PM Night-sky photos and Barry finishes"));
  assert.ok(applied.lines.includes("Added to the Thursday timeline: 1:00 PM Airbnb check in"));
  const again = pendingTimelineCorrections(timeline, new Set(applied.keys));
  assert.equal(again.inserts.length, 0);
  assert.deepEqual(again.removals, timeline.removals);
});
