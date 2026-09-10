import assert from "node:assert/strict";
import { test } from "node:test";
import type { BudgetContractSnapshot } from "./money";
import { MODULES } from "./modules";
import {
  DAY_OF_PACKET_SECTIONS,
  FULL_BINDER_SECTIONS,
  assignmentOwnerLabel,
  documentContainsInternalSecrets,
  emptyPrintDocument,
  extractMcCues,
  formatPrintMoney,
  groupPrintContacts,
  isMcDirectoryLabel,
  mcPeopleFromDirectory,
  moneyFingerprint,
  presetMatchesSelection,
  printableSections,
  sectionsForPreset,
  toggleSection,
  triggerBrowserPrint,
  type PrintCenterDocument,
} from "./print-center";

import { PRODUCTION_CUE_BLOCKS } from "./mc-cue-fixture";
test("Print Center is a More entry, not a primary navigation tab", () => {
  const print = MODULES.find((module) => module.key === "print");
  assert.equal(print?.href, "/print");
  assert.equal(print?.navTab, "more");
  assert.equal(print?.primary ?? false, false);
  assert.equal(print?.hideFromMore, true);
});

test("Full Binder preset includes money, guests, setup, and coordinator; Day-of Packet excludes money and guests", () => {
  assert.equal(FULL_BINDER_SECTIONS.includes("money"), true);
  assert.equal(FULL_BINDER_SECTIONS.includes("guests"), true);
  assert.equal(FULL_BINDER_SECTIONS.includes("setup"), true);
  assert.equal(FULL_BINDER_SECTIONS.includes("coordinator"), true);
  assert.equal(FULL_BINDER_SECTIONS.includes("decor"), true);
  assert.equal(DAY_OF_PACKET_SECTIONS.includes("money"), false);
  assert.equal(DAY_OF_PACKET_SECTIONS.includes("guests"), false);
  assert.equal(DAY_OF_PACKET_SECTIONS.includes("hair"), true);
  assert.equal(DAY_OF_PACKET_SECTIONS.includes("shots"), true);
  assert.equal(DAY_OF_PACKET_SECTIONS.includes("setup"), true);
  assert.equal(DAY_OF_PACKET_SECTIONS.includes("coordinator"), true);
  assert.equal(FULL_BINDER_SECTIONS.includes("hair"), true);
  assert.equal(FULL_BINDER_SECTIONS.includes("shots"), true);
  assert.equal(presetMatchesSelection("binder", sectionsForPreset("binder")), true);
  assert.equal(presetMatchesSelection("packet", sectionsForPreset("packet")), true);
});

test("manual section toggles add and remove without preset persistence", () => {
  const next = toggleSection(sectionsForPreset("packet"), "money");
  assert.equal(next.includes("money"), true);
  assert.equal(presetMatchesSelection("packet", next), false);
  const removed = toggleSection(next, "money");
  assert.equal(removed.includes("money"), false);
});

test("MC extraction uses canonical note cues and does not invent Kurt contact data", () => {
  const cues = extractMcCues(PRODUCTION_CUE_BLOCKS);
  const times = cues.map((cue) => cue.time);
  assert.deepEqual(times, [
    "3:25 PM",
    "4:00 PM",
    "4:55 PM",
    "5:00 PM",
    "Immediately after 5:00 PM entrance",
    "6:00 PM",
    "6:15 PM",
    "6:30 PM",
    "7:00 PM",
    "8:00 PM",
    "8:30 PM",
    "9:55 PM",
    "10:00 PM",
  ]);
  assert.equal(
    cues.some((cue) => /While They Wait/i.test(cue.music.join(" "))),
    false,
  );
  assert.equal(
    cues.some((cue) => /Walking Down The Aisle/i.test(cue.music.join(" "))),
    false,
  );
  assert.equal(
    cues.some((cue) => /Grand Entrance Song/i.test(cue.music.join(" "))),
    true,
  );
  assert.equal(
    cues.some((cue) => /Dinner Minstrels/i.test(cue.music.join(" "))),
    true,
  );
  assert.equal(cues.some((cue) => /First Dance/i.test(cue.music.join(" "))), true);
  assert.equal(cues.some((cue) => /Kids Section/i.test(cue.music.join(" "))), true);
  assert.equal(cues.some((cue) => /Adults Section/i.test(cue.music.join(" "))), false);
  assert.equal(cues.some((cue) => /Dollar Dance Song/i.test(cue.music.join(" "))), true);
  assert.equal(cues.some((cue) => /Last Dance Song/i.test(cue.music.join(" "))), true);
  assert.equal(cues.every((cue) => !/Kurt/.test(cue.spoken)), true);
  const conclusion = cues.find((cue) => /ceremony has concluded/i.test(cue.spoken));
  assert.equal(conclusion?.music.some((line) => /Walking Down The Aisle/i.test(line)), false);
});

test("Kurt is MC from directory label; Wendy is Mistress of Ceremonies", () => {
  assert.equal(isMcDirectoryLabel("MC"), true);
  assert.equal(isMcDirectoryLabel("Mistress of Ceremonies"), true);
  assert.equal(isMcDirectoryLabel("Mistress of Ceremony"), true);
  assert.equal(isMcDirectoryLabel("Setup / teardown / cleanup contact"), false);
  assert.deepEqual(
    mcPeopleFromDirectory([
      { name: "Kurt Huizenga", directoryLabel: "MC" },
      { name: "Wendy Rush", directoryLabel: "Mistress of Ceremonies" },
    ]),
    ["Kurt Huizenga", "Wendy Rush"],
  );
});

test("unassigned day assignments print as UNASSIGNED", () => {
  assert.equal(assignmentOwnerLabel([]), "UNASSIGNED");
  assert.equal(assignmentOwnerLabel(["Shelly"]), "Shelly");
});

test("contact grouping avoids duplicate vendor/day-of cards", () => {
  const grouped = groupPrintContacts([
    {
      name: "Avalon Green · Planner",
      directoryLabel: "Planner",
      phone: "1",
      email: null,
      isDayOfContact: true,
      sortOrder: 0,
    },
    {
      name: "Wendy Rush",
      directoryLabel: "Setup / teardown / cleanup contact",
      phone: "2",
      email: null,
      isDayOfContact: true,
      sortOrder: 8,
    },
    {
      name: "Belle Genton",
      directoryLabel: "Family",
      phone: null,
      email: null,
      isDayOfContact: false,
      sortOrder: 5,
    },
  ]);
  assert.deepEqual(
    grouped.vendors.map((row) => row.name),
    ["Avalon Green · Planner"],
  );
  assert.deepEqual(
    grouped.dayOf.map((row) => row.name),
    ["Wendy Rush"],
  );
  assert.deepEqual(
    grouped.other.map((row) => row.name),
    ["Belle Genton"],
  );
});

test("day-of Kurt prints as MC without inventing a phone", () => {
  const grouped = groupPrintContacts([
    {
      name: "Kurt Huizenga",
      directoryLabel: null,
      phone: null,
      email: null,
      isDayOfContact: true,
      sortOrder: 1,
    },
  ]);
  assert.equal(grouped.dayOf[0]?.name, "Kurt Huizenga");
  assert.equal(grouped.dayOf[0]?.role, "MC");
  assert.equal(grouped.dayOf[0]?.phone, null);
  assert.equal(grouped.dayOf[0]?.email, null);
});

test("money fingerprint formats the current production totals", () => {
  const contracts: BudgetContractSnapshot[] = [
    {
      id: "hidden",
      name: "Photographer",
      price: 21485.83,
      amountPaid: 9167.22,
      ownerId: null,
      paidById: null,
      payByDate: new Date("2026-10-16T12:00:00"),
      note: null,
      sortOrder: 0,
      payments: [],
    },
  ];
  const money = moneyFingerprint(contracts);
  assert.equal(money.committed, 21485.83);
  assert.equal(money.paid, 9167.22);
  assert.equal(Number(money.remaining.toFixed(2)), 12318.61);
  assert.equal(formatPrintMoney(money.committed), "$21,485.83");
  assert.equal(formatPrintMoney(money.paid), "$9,167.22");
  assert.equal(formatPrintMoney(Number(money.remaining.toFixed(2))), "$12,318.61");
});

test("printable packet omits money and guests even if those sections have data", () => {
  const doc: PrintCenterDocument = {
    ...emptyPrintDocument(),
    timeline: Array.from({ length: 19 }, (_, i) => ({
      timeLabel: `${i}`,
      title: `Moment ${i}`,
      location: null,
      notes: ["detail"],
    })),
    rehearsal: Array.from({ length: 7 }, (_, i) => ({
      timeLabel: `${i}`,
      title: `Rehearsal ${i}`,
      location: null,
      notes: [],
    })),
    households: [{ title: "Guest", members: [{ name: "Guest", rsvpLabel: "Awaiting RSVP" }] }],
    money: {
      committed: 21485.83,
      paid: 9167.22,
      remaining: 12318.61,
      items: [{ name: "Photographer", total: 1000, paid: 0, remaining: 1000, dueLabel: null }],
    },
  };
  const printed = printableSections(doc, sectionsForPreset("packet"));
  assert.equal(printed.includes("money"), false);
  assert.equal(printed.includes("guests"), false);
  assert.equal(printed.includes("timeline"), true);
  assert.equal(doc.timeline.length, 19);
  assert.equal(doc.rehearsal.length, 7);
});

test("packet prints hair, shots, and decor when those projections have content", () => {
  const doc: PrintCenterDocument = {
    ...emptyPrintDocument(),
    hairMakeup: [{ timeLabel: "9:00 AM", title: "Braxton — hair", location: "Bathroom 1", notes: [], section: "9:00 AM" }],
    hairRooms: [{ title: "Bathroom 1", detail: "Hair · one station" }],
    shots: [{ timeLabel: null, title: "Invitations", location: null, notes: [], section: "Details" }],
    shotGroups: [{ section: "Details", confirmationNote: null, items: [{ title: "Invitations", notes: [], completed: false, inferredPairing: false }] }],
    setupDecor: [{ timeLabel: null, title: "Storm clouds", location: null, notes: [], section: "Tables" }],
    setupConfirmed: [{ owner: "Haley's parents", work: "Trash" }],
  };
  const printed = printableSections(doc, sectionsForPreset("packet"));
  assert.equal(printed.includes("hair"), true);
  assert.equal(printed.includes("shots"), true);
  assert.equal(printed.includes("setup"), true);
  assert.equal(printed.includes("decor"), true);
});

test("print document text does not include PIN or session internals", () => {
  const doc = emptyPrintDocument();
  const blob = JSON.stringify(doc);
  assert.equal(documentContainsInternalSecrets(blob), false);
  assert.equal(/pinHash|ws_session|PinAccount/.test(blob), false);
});

test("Print / Save PDF calls the browser print dialog", () => {
  let called = 0;
  triggerBrowserPrint({ print: () => { called += 1; } });
  assert.equal(called, 1);
});
