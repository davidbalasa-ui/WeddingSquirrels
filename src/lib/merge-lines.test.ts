import assert from "node:assert/strict";
import test from "node:test";

import { mergeStaleTimelineSave, mergeTextLines } from "./merge-lines";

test("mergeTextLines keeps a line one device added and a location the other set", () => {
  const base = "Dinner begins\nPlated service";
  const theirs = "Dinner begins\nPlated service\nAdded in tab one";
  const mine = "Dinner begins\nlocation: Head table\nPlated service";
  assert.equal(mergeTextLines(base, theirs, mine), "Dinner begins\nlocation: Head table\nPlated service\nAdded in tab one");
});

test("mergeTextLines takes the only side that changed", () => {
  assert.equal(mergeTextLines("A\nB", "A\nB", "A\nB\nC"), "A\nB\nC");
  assert.equal(mergeTextLines("A\nB", "A\nB\nC", "A\nB"), "A\nB\nC");
  assert.equal(mergeTextLines("A\nB", "A\nX", "A\nX"), "A\nX");
});

test("mergeTextLines keeps both sides' new lines, the saved ones first", () => {
  assert.equal(mergeTextLines("A", "A\nfrom phone", "A\nfrom laptop"), "A\nfrom phone\nfrom laptop");
});

test("mergeTextLines lets the save being made win when both rewrote the same line", () => {
  assert.equal(mergeTextLines("A\nB\nC", "A\nB theirs\nC", "A\nB mine\nC"), "A\nB mine\nC");
});

test("mergeTextLines drops a line one side removed while the other left it alone", () => {
  assert.equal(mergeTextLines("A\nB\nC", "A\nC", "A\nB\nC\nD"), "A\nC\nD");
  assert.equal(mergeTextLines("A\nB\nC", "A\nB\nC\nD", "A\nC"), "A\nC\nD");
});

test("mergeTextLines keeps a line one side rewrote while the other removed it", () => {
  assert.equal(mergeTextLines("A\nB\nC", "A\nC", "A\nB changed\nC"), "A\nB changed\nC");
});

test("mergeTextLines ignores blank lines and surrounding spaces", () => {
  assert.equal(mergeTextLines("A\n\n B ", "A\nB\n\nC\n", " A\nB"), "A\nB\nC");
});

test("mergeStaleTimelineSave keeps the other device's time when this device only changed the notes", () => {
  const base = { startAt: "5:00 PM", endAt: "", notes: "Dinner\nPlated" };
  const current = { startAt: "5:30 PM", endAt: "6:30 PM", notes: "Dinner\nPlated" };
  const sent = { startAt: "5:00 PM", endAt: "", notes: "Dinner\nPlated\nSpeeches after" };
  assert.deepEqual(mergeStaleTimelineSave(sent, current, base), {
    startAt: "5:30 PM",
    endAt: "6:30 PM",
    notes: "Dinner\nPlated\nSpeeches after",
  });
});

test("mergeStaleTimelineSave takes the save as sent when nothing changed meanwhile or no base is known", () => {
  const base = { startAt: "5:00 PM", endAt: "", notes: "Dinner" };
  const sent = { startAt: "5:15 PM", endAt: "", notes: "Dinner\nLate" };
  assert.deepEqual(mergeStaleTimelineSave(sent, base, base), sent);
  assert.deepEqual(mergeStaleTimelineSave(sent, { ...base, notes: "Dinner\nOther" }), sent);
});

test("mergeStaleTimelineSave leaves notes typed away alone so the save step reverts them", () => {
  const base = { startAt: "5:00 PM", endAt: "", notes: "Dinner" };
  const current = { startAt: "5:00 PM", endAt: "", notes: "Dinner\nOther" };
  assert.equal(mergeStaleTimelineSave({ ...base, notes: "  " }, current, base).notes, "Dinner\nOther");
});
