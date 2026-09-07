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

const PRODUCTION_CUE_BLOCKS = [
  {
    startAt: "10:30 AM",
    endAt: null,
    notes: "Venue Opens\nVenue:\n- vendors\n- coordinator Avalon\n- MC Kurt",
    sortOrder: 1,
  },
  {
    startAt: "3:15 PM",
    endAt: "3:30 PM",
    notes:
      "Pre-Ceremony Transition\n- guests arrive\nPlaylist: While They Wait 3:00–3:30\nMC cue 3:25 PM: \"Friends and travelers, welcome! Our ceremony will begin shortly. Please find your seats and silence your phones as we prepare to witness David and Haley begin their next chapter.\"",
    sortOrder: 11,
  },
  {
    startAt: "3:30 PM",
    endAt: "4:00 PM",
    notes:
      "Ceremony\nUnder the shelter\nPlaylist: Walking Down The Aisle\nMC cue at 4:00: \"The ceremony has concluded - let the celebration begin!\"",
    sortOrder: 12,
  },
  {
    startAt: "4:00 PM",
    endAt: "5:00 PM",
    notes:
      "Cocktail Hour\nMC cue 4:55: \"Honored guests, cocktail hour is nearing its end.\"",
    sortOrder: 13,
  },
  {
    startAt: "5:00 PM",
    endAt: "6:00 PM",
    notes:
      "Dinner begins\nGrand Entrance Song: Special Dances Playlist\nMC cue 5:00: \"If I may have your attention - it’s time! Please welcome the wedding party, and then join me in cheering for the newlyweds, David and Haley!\"\nDinner cue immediately after entrance: \"Our couple has arrived - let the feast begin!\"\nPlaylist: Dinner Minstrels, start of dinner through start of toasts",
    sortOrder: 14,
  },
  {
    startAt: "6:00 PM",
    endAt: "6:30 PM",
    notes:
      "Toasts + Cake cutting\nMC cue 6:00: \"As dinner winds down, please return to your seats.\"\nMC cue 6:15: \"With the toasts complete, gather near the cake table.\"",
    sortOrder: 15,
  },
  {
    startAt: "6:30 PM",
    endAt: "7:00 PM",
    notes:
      "First dances\nMusic: First Dance and Father Daughter\nMC cue 6:30: \"Please turn your attention to the center of the space.\"",
    sortOrder: 16,
  },
  {
    startAt: "7:00 PM",
    endAt: "10:00 PM",
    notes:
      "Open Dancing\nMC cue 7:00: \"The dance floor is officially open in the glass house.\"\nPlaylist: Wedding - Kids Section 7:00–8:15\nMC cue 8:00: \"A gentle reminder for our younger travelers.\"\nPlaylist: Wedding - Adults Section 8:15–8:30\nMC cue 8:30 — Dollar Dance: \"It’s time for a cherished tradition - the dollar dance.\"\nMusic: Dollar Dance Song, Special Dances Playlist\nMC cue 9:55 — Last Call + Final Dance: \"As the evening winds down, this is the last call for drinks.\"\nMusic: Last Dance Song, Special Dances Playlist\nMC cue 10:00 — Reception Conclusion: \"Our celebration has reached its end.\"",
    sortOrder: 17,
  },
];

test("Print Center is a More entry, not a primary navigation tab", () => {
  const print = MODULES.find((module) => module.key === "print");
  assert.equal(print?.href, "/print");
  assert.equal(print?.navTab, "more");
  assert.equal(print?.primary ?? false, false);
  assert.equal(print?.hideFromMore, true);
});

test("Full Binder preset includes money and guests; Day-of Packet excludes them", () => {
  assert.equal(FULL_BINDER_SECTIONS.includes("money"), true);
  assert.equal(FULL_BINDER_SECTIONS.includes("guests"), true);
  assert.equal(DAY_OF_PACKET_SECTIONS.includes("money"), false);
  assert.equal(DAY_OF_PACKET_SECTIONS.includes("guests"), false);
  assert.equal(DAY_OF_PACKET_SECTIONS.includes("mc"), true);
  assert.equal(DAY_OF_PACKET_SECTIONS.includes("setup"), true);
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
    "4:00",
    "4:55",
    "5:00",
    "Immediately after entrance",
    "6:00",
    "6:15",
    "6:30",
    "7:00",
    "8:00",
    "8:30",
    "9:55",
    "10:00",
  ]);
  assert.equal(
    cues.some((cue) => /While They Wait/i.test(cue.music.join(" "))),
    true,
  );
  assert.equal(
    cues.some((cue) => /Walking Down The Aisle/i.test(cue.music.join(" "))),
    true,
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
  assert.equal(cues.some((cue) => /Adults Section/i.test(cue.music.join(" "))), true);
  assert.equal(cues.some((cue) => /Dollar Dance Song/i.test(cue.music.join(" "))), true);
  assert.equal(cues.some((cue) => /Last Dance Song/i.test(cue.music.join(" "))), true);
  assert.equal(cues.every((cue) => !/Kurt/.test(cue.spoken)), true);
});

test("Kurt is MC from directory label; Wendy is not", () => {
  assert.equal(isMcDirectoryLabel("MC"), true);
  assert.equal(isMcDirectoryLabel("Setup / teardown / cleanup contact"), false);
  assert.deepEqual(
    mcPeopleFromDirectory([
      { name: "Kurt Huizenga", directoryLabel: "MC" },
      { name: "Wendy Rush", directoryLabel: "Setup / teardown / cleanup contact" },
    ]),
    ["Kurt Huizenga"],
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
    households: [{ names: ["Guest"], addressLines: [], rsvp: "pending" }],
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
