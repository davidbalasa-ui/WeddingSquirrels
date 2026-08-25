import assert from "node:assert/strict";
import { test } from "node:test";
import type { AccountModuleFlags } from "@/lib/types";
import { flagDiffCount, flagEnabledCount, toggleAccountFlag } from "./account-flags";
import { DEFAULT_CREATE_FLAGS, matchPreset } from "./presets";

function flags(): AccountModuleFlags {
  return { ...DEFAULT_CREATE_FLAGS };
}

test("turning off Money See clears Money Edit", () => {
  const base = { ...flags(), canSeeBudget: true, canEditBudget: true };
  const f = toggleAccountFlag(base, "canSeeBudget", false);
  assert.equal(f.canSeeBudget, false);
  assert.equal(f.canEditBudget, false);
});

test("turning on Money Edit forces See", () => {
  const f = toggleAccountFlag(flags(), "canEditBudget", true);
  assert.equal(f.canSeeBudget, true);
});

test("turning off Day-of See clears its Edit", () => {
  const base = { ...flags(), canSeeTimeline: true, canEditTimeline: true };
  const f = toggleAccountFlag(base, "canSeeTimeline", false);
  assert.equal(f.canSeeTimeline, false);
  assert.equal(f.canEditTimeline, false);
});

test("turning on Dinner Edit forces Rehearsal See", () => {
  const f = toggleAccountFlag(flags(), "canEditDinner", true);
  assert.equal(f.canSeeDinner, true);
});

test("turning on Rehearsal Edit forces Rehearsal See", () => {
  const f = toggleAccountFlag(flags(), "canEditRehearsal", true);
  assert.equal(f.canSeeDinner, true);
});

test("account managers keep dinner see when dinner see is toggled off", () => {
  const base = { ...flags(), canManageAccounts: true, canSeeDinner: true, canEditDinner: true };
  const f = toggleAccountFlag(base, "canSeeDinner", false);
  assert.equal(f.canSeeDinner, true);
  assert.equal(f.canEditDinner, false);
});

test("granting account management also grants dinner see + edit", () => {
  const f = toggleAccountFlag(flags(), "canManageAccounts", true);
  assert.equal(f.canSeeDinner, true);
  assert.equal(f.canEditDinner, true);
});

test("default create flags match the Helper preset", () => {
  assert.equal(matchPreset(DEFAULT_CREATE_FLAGS), "helper");
});

test("arbitrary custom flags don't match a named preset", () => {
  const f = { ...DEFAULT_CREATE_FLAGS, canSeeStay: true };
  assert.equal(matchPreset(f), "custom");
});

test("flagDiffCount counts only differing flags", () => {
  const a = flags();
  const b = { ...a, canSeeStay: true, canSeeTasks: false };
  assert.equal(flagDiffCount(a, b), 2);
});

test("flagEnabledCount counts enabled flags", () => {
  assert.equal(flagEnabledCount(flags()), 5);
});
