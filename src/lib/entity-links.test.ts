import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calendarHref,
  dayAssignmentHref,
  moneyHref,
  peopleProfileHref,
  personProfileHref,
  requestHref,
  taskHref,
  timelineHref,
} from "./entity-links";

test("person profiles use canonical person:{id} URLs", () => {
  assert.equal(personProfileHref("david"), "/people/person%3Adavid");
  assert.equal(peopleProfileHref("guest:abc"), "/people/guest%3Aabc");
  assert.equal(peopleProfileHref("contact:c1"), "/people/contact%3Ac1");
});

test("task, money, request, and plan destinations are specific", () => {
  assert.equal(taskHref("t1"), "/work/t1");
  assert.equal(moneyHref("b1"), "/money/b1");
  assert.equal(moneyHref("b1", { paymentId: "p9" }), "/money/b1?payment=p9");
  assert.equal(requestHref("r1"), "/today?filter=asks&ask=r1");
  assert.equal(timelineHref(), "/plan/timeline");
  assert.equal(timelineHref({ schedule: "rehearsal", blockId: "tb1" }), "/plan/rehearsal#block-tb1");
  assert.equal(dayAssignmentHref(), "/people/responsibilities");
  assert.equal(calendarHref(), "/plan/calendar");
});

test("entity links never invent vendor or name-match destinations", () => {
  assert.equal(moneyHref("Photography"), "/money/Photography");
  assert.notEqual(personProfileHref("david"), "/people/contact%3Adavid");
});
