import assert from "node:assert/strict";
import { test } from "node:test";
import {
  backLinkStepsBack,
  emptyMemory,
  parseMemory,
  previousUrl,
  pushEntry,
  rememberPosition,
  replaceEntry,
  savedPosition,
  serializeMemory,
  traverseTo,
} from "./navigation-memory";

test("a push, then back, lands on the remembered position", () => {
  let memory = emptyMemory("/plan/timeline");
  memory = rememberPosition(memory, 9335.4);
  memory = pushEntry(memory, "/people/contact:abc");
  assert.equal(savedPosition(memory), 0);
  const back = traverseTo(memory, "/plan/timeline");
  assert.equal(back.kind, "back");
  assert.equal(savedPosition(back.memory), 9335);
  const forward = traverseTo(back.memory, "/people/contact:abc");
  assert.equal(forward.kind, "forward");
  assert.equal(forward.memory.index, 1);
});

test("a push after going back drops the forward entries and their positions", () => {
  let memory = emptyMemory("/today");
  memory = pushEntry(memory, "/people");
  memory = rememberPosition(memory, 400);
  memory = traverseTo(memory, "/today").memory;
  memory = pushEntry(memory, "/day");
  assert.deepEqual(memory.stack, ["/today", "/day"]);
  assert.deepEqual(memory.positions, {});
});

test("a tab or filter change replaces the entry in place", () => {
  let memory = emptyMemory("/people?tab=guests");
  memory = rememberPosition(memory, 120);
  memory = replaceEntry(memory, "/people?tab=vendors");
  assert.deepEqual(memory.stack, ["/people?tab=vendors"]);
  assert.equal(savedPosition(memory), 120);
});

test("an unknown history entry is treated as a new screen", () => {
  const memory = emptyMemory("/today");
  const result = traverseTo(memory, "/money");
  assert.equal(result.kind, "unknown");
  assert.deepEqual(result.memory.stack, ["/today", "/money"]);
});

test("the back link steps back only when the previous screen is that page", () => {
  let memory = emptyMemory("/people?tab=day-of");
  memory = pushEntry(memory, "/people/contact:abc");
  assert.equal(backLinkStepsBack(memory, "/people"), true);
  assert.equal(previousUrl(memory), "/people?tab=day-of");
  let fromDay = emptyMemory("/day");
  fromDay = pushEntry(fromDay, "/people/person:kurt");
  assert.equal(backLinkStepsBack(fromDay, "/people"), false);
  assert.equal(backLinkStepsBack(emptyMemory("/people/contact:abc"), "/people"), false);
});

test("memory survives a round trip through storage and rejects junk", () => {
  let memory = emptyMemory("/today");
  memory = rememberPosition(memory, 50);
  memory = pushEntry(memory, "/plan");
  const restored = parseMemory(serializeMemory(memory), "/plan");
  assert.deepEqual(restored, memory);
  assert.deepEqual(parseMemory("not json", "/x"), emptyMemory("/x"));
  assert.deepEqual(parseMemory(JSON.stringify({ stack: [], index: 0 }), "/x"), emptyMemory("/x"));
  assert.deepEqual(parseMemory(JSON.stringify({ stack: ["/a"], index: 3 }), "/x"), emptyMemory("/x"));
});

test("the stack stays bounded", () => {
  let memory = emptyMemory("/0");
  for (let i = 1; i <= 100; i++) {
    memory = rememberPosition(memory, i);
    memory = pushEntry(memory, `/${i}`);
  }
  assert.equal(memory.stack.length, 60);
  assert.equal(memory.index, 59);
  assert.equal(memory.stack[59], "/100");
  assert.equal(memory.stack[58], "/99");
  assert.equal(memory.positions[58], 100);
});
