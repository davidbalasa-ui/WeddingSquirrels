import assert from "node:assert/strict";
import { test } from "node:test";
import type { BudgetContractSnapshot } from "./money";
import { MODULES } from "./modules";
import { reviewMoment } from "./day-timeline-view";
import {
  DAY_OF_PACKET_SECTIONS,
  PRINT_PACKETS,
  FULL_BINDER_SECTIONS,
  WEDDING_PARTY_PACKET_SECTIONS,
  activePreset,
  assignmentOwnerLabel,
  documentContainsInternalSecrets,
  emptyPrintDocument,
  extractMcCues,
  formatPrintMoney,
  groupPrintContacts,
  contactRoleRepeatsName,
  isMcDirectoryLabel,
  masterChapters,
  masterContacts,
  masterHairNotes,
  masterPlaybookRows,
  masterSectionHasContent,
  masterQuickReference,
  mcPeopleFromDirectory,
  moneyFingerprint,
  presetMatchesSelection,
  sectionHasContent,
  printTitleKicker,
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

test("Master packet includes money, guests, and coordinator; Day-of Packet excludes money and guests", () => {
  assert.equal(FULL_BINDER_SECTIONS.includes("money"), true);
  assert.equal(FULL_BINDER_SECTIONS.includes("guests"), true);
  // Every line of these already prints elsewhere in the master packet (David, 2026-10-10: no redundancies).
  assert.equal(FULL_BINDER_SECTIONS.includes("setup"), false);
  assert.equal(FULL_BINDER_SECTIONS.includes("mc"), false);
  assert.equal(FULL_BINDER_SECTIONS.includes("calendar"), false);
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

test("Wedding Party Packet stays short: roster, their schedule, contacts; no jobs, MC cues, or money", () => {
  assert.deepEqual(WEDDING_PARTY_PACKET_SECTIONS, ["overview", "party", "schedule", "contacts"]);
  assert.equal(FULL_BINDER_SECTIONS.includes("party"), true);
  assert.equal(DAY_OF_PACKET_SECTIONS.includes("party"), false);
  assert.equal(presetMatchesSelection("party", sectionsForPreset("party")), true);
  assert.equal(activePreset(sectionsForPreset("party")), "party");
  assert.equal(activePreset(sectionsForPreset("packet")), "packet");
  assert.equal(activePreset(sectionsForPreset("binder")), "binder");
  assert.equal(activePreset(toggleSection(sectionsForPreset("party"), "money")), null);
  assert.equal(printTitleKicker("party"), "Wedding Party Packet");
  assert.equal(printTitleKicker("packet"), "Coordinator & Mistress of Ceremonies");
  assert.equal(printTitleKicker(null), "Wedding Binder");
});

test("only the groom's binder carries money; each packet keeps to its own group", () => {
  for (const packet of PRINT_PACKETS) {
    assert.equal(packet.sections.includes("money"), packet.id === "binder", packet.id);
    assert.equal(packet.sections.includes("guests"), packet.id === "binder", packet.id);
  }
  assert.equal(sectionsForPreset("bride").includes("mc"), false);
  assert.equal(sectionsForPreset("mc").includes("mc"), true);
  assert.equal(sectionsForPreset("photo").includes("shots"), true);
  // Both parents' packets share sections; the chosen one stays active.
  assert.equal(activePreset(sectionsForPreset("groomParents"), "groomParents"), "groomParents");
  assert.equal(activePreset(sectionsForPreset("groomParents"), "brideParents"), "brideParents");
});

test("party section prints only when the document has lineup or member rows", () => {
  const doc = emptyPrintDocument();
  assert.equal(printableSections(doc, ["party"]).includes("party"), false);
  doc.weddingParty.processional = [{ order: 1, title: "David" }];
  assert.equal(printableSections(doc, ["party"]).includes("party"), true);
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
    moments: {
      wedding: Array.from({ length: 19 }, (_, i) => reviewMoment({ startAt: "4:00 PM", endAt: null, notes: `Moment ${i}\ndetail` })),
      rehearsal: Array.from({ length: 7 }, (_, i) => reviewMoment({ startAt: "5:00 PM", endAt: null, notes: `Rehearsal ${i}` })),
    },
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
  assert.equal(doc.moments.wedding.length, 19);
  assert.equal(doc.moments.rehearsal.length, 7);
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

test("a packet still counts as picked when the session cannot see one of its sections", () => {
  const available = sectionsForPreset("bride").filter((id) => id !== "stay");
  assert.equal(activePreset(available, "bride", available), "bride");
  assert.equal(activePreset(available, "bride"), null);
});

test("the MC Run of Show section prints only when there are cues, not for a name alone", () => {
  const doc = { ...emptyPrintDocument(), mcNames: ["Kurt Huizenga"] };
  assert.equal(sectionHasContent(doc, "mc"), false);
  assert.equal(
    sectionHasContent({ ...doc, mcCues: [{ time: "5:00 PM", heading: null, momentTitle: "Dinner begins", spoken: "Overnight check", music: [] }] }, "mc"),
    true,
  );
});

test("a binder prints open work first, then Thursday and Friday, then everything else", () => {
  const doc = emptyPrintDocument();
  const order = printableSections(
    {
      ...doc,
      taskGroups: [{ title: "Monday, October 12", items: [{ title: "Total Wine", done: false, dueLabel: null, assignees: [] }] }],
      moments: {
        rehearsal: [reviewMoment({ startAt: "1:00 PM", endAt: null, notes: "Airbnb check in" })],
        wedding: [reviewMoment({ startAt: "3:30 PM", endAt: null, notes: "Ceremony" })],
      },
    },
    sectionsForPreset("binder"),
  );
  assert.deepEqual(order.slice(0, 3), ["tasks", "rehearsal", "timeline"]);
  // A packet with no open work keeps its own order.
  assert.deepEqual(printableSections(doc, ["overview", "timeline"]).indexOf("overview") <= 0, true);
});

test("the master packet prints open work, Thursday, Friday, then the rest in chapters", () => {
  const doc = {
    ...emptyPrintDocument(),
    taskGroups: [{ title: "Week before", items: [{ title: "Pack", done: false, dueLabel: null, assignees: [] }] }],
    moments: {
      rehearsal: [reviewMoment({ startAt: "1:00 PM", endAt: null, notes: "Airbnb check in" })],
      wedding: [reviewMoment({ startAt: "3:30 PM", endAt: null, notes: "Ceremony" })],
    },
    assignments: [{ title: "Ice", notes: null, assignees: [] }],
  };
  const order = printableSections(doc, sectionsForPreset("binder"), true);
  assert.deepEqual(order.slice(0, 4), ["overview", "tasks", "rehearsal", "timeline"]);
  const chapters = masterChapters(order);
  assert.deepEqual(chapters.map((chapter) => chapter.sections[0]), ["tasks", "rehearsal", "timeline", "assignments", "stay"]);
  assert.deepEqual(chapters.map((chapter) => chapter.number), [1, 2, 3, 4, 5]);
  // A section ticked on by hand gets a chapter of its own.
  assert.deepEqual(masterChapters(["tasks", "calendar"]).map((chapter) => chapter.sections), [["tasks"], ["calendar"]]);
});

test("the master packet lists each contact once", () => {
  const doc = emptyPrintDocument();
  doc.vendorContacts = [{ name: "Avalon Green", role: "Planner", phone: "386.589.7215", email: "a@example.com" }];
  doc.dayOfContacts = [
    { name: "Kurt Huizenga", role: "MC", phone: null, email: null },
    { name: "Andi Smith", role: "Best Man", phone: "(555) 123-4567", email: null },
    { name: "Bri Jones", role: null, phone: "(555) 999-0000", email: null },
  ];
  doc.setupContacts = [
    { name: "Avalon Green", role: "Planner", phone: "386.589.7215", email: null },
    { name: "Cleanup Crew", role: "Teardown", phone: null, email: null },
  ];
  doc.weddingParty = {
    ...doc.weddingParty,
    members: [
      { name: "Andi", role: "Wedding party", walksWith: null, phone: "555-123-4567" },
      { name: "Bri", role: "Wedding party", walksWith: null, phone: null },
    ] as typeof doc.weddingParty.members,
  };
  const contacts = masterContacts(doc);
  // Andi's number prints in the roster; Bri's roster says TBD, so her own number stays here.
  assert.deepEqual(contacts.dayOf.map((row) => row.name), ["Kurt Huizenga", "Bri Jones", "Cleanup Crew"]);
  // The cover leaves out people the contacts list.
  doc.quickReference = { ...doc.quickReference, coordinatorName: "Avalon Green", coordinatorPhone: "386-589-7215", mcName: "Kurt Huizenga", mistressOfCeremonies: "Wendy Rush" };
  const ref = masterQuickReference(doc);
  assert.equal(ref.coordinatorName, null);
  assert.equal(ref.coordinatorPhone, null);
  assert.equal(ref.mcName, null);
  assert.equal(ref.mistressOfCeremonies, "Wendy Rush");
  assert.equal(ref.ceremonyTime, null);
  assert.equal(ref.venueName, doc.quickReference.venueName);
  assert.equal(contactRoleRepeatsName({ name: "Belle Genton · Videographer", role: "Videographer" }), true);
  assert.equal(contactRoleRepeatsName({ name: "Barry Tilson", role: "Photographer" }), false);
});

test("the master packet's scope and décor pages do not repeat a contact or each other", () => {
  const doc = emptyPrintDocument();
  doc.vendorContacts = [{ name: "Avalon Green", role: "Planner", phone: "386.589.7215", email: "greengardeneventsmi@gmail.com" }];
  const row = (title: string, notes: string[], section = "Scope") => ({ timeLabel: null, title, location: null, notes, section });
  doc.coordinatorScope = [
    row("Emergency contact", ["Avalon Green · 386.589.7215 · greengardeneventsmi@gmail.com"]),
    row("Décor breakdown for the point person", ["Avalon handles décor breakdown. Haley's parents and assigned crew handle removal and transport."]),
    row("Vendor communication", ["Call (616) 555-0100 for the caterer."]),
  ];
  doc.setupDecor = [
    row("Decor goes home with Haley's parents", ["Avalon handles décor breakdown. Haley's parents and assigned crew handle removal and transport."], "Cleanup"),
    row("Trash", ["Haley's parents take trash."], "Cleanup"),
  ];
  const { coordinator, decor } = masterPlaybookRows(doc);
  assert.deepEqual(coordinator.map((item) => item.title), ["Décor breakdown for the point person", "Vendor communication"]);
  // A number nobody's contact card carries stays.
  assert.deepEqual(coordinator[1]!.notes, ["Call (616) 555-0100 for the caterer."]);
  assert.deepEqual(decor.map((item) => [item.title, item.notes]), [
    ["Decor goes home with Haley's parents", []],
    ["Trash", ["Haley's parents take trash."]],
  ]);
});

test("the master packet keeps the hair plan's own notes and leaves the run sheet's lines to the run sheet", () => {
  const doc = emptyPrintDocument();
  doc.moments = {
    rehearsal: [],
    wedding: [reviewMoment({ startAt: "11:00 AM", endAt: null, notes: "Hair & makeup at Airbnb\nEveryone else wraps up, does final touches, and starts to clean." })],
  };
  const hair = (person: string, notes: string[]) => ({ timeLabel: "9:00 AM", showTime: true, person, service: null, location: null, notes });
  doc.hairSchedule = [
    hair("Bridal party", ["Steam dresses. Lay out shoes, jewelry, and accessories."]),
    hair("Haley", ["Everyone else wraps up, does final touches, and starts to clean."]),
    hair("Braxton", []),
    hair("Bridal party", ["Pull dresses from bags (steam if needed)."]),
  ];
  assert.deepEqual(masterHairNotes(doc), [
    { who: "Bridal party", notes: ["Steam dresses. Lay out shoes, jewelry, and accessories.", "Pull dresses from bags (steam if needed)."] },
  ]);
});

test("the master packet skips the meals page while the menu is unpublished and nothing is on the shopping list", () => {
  const doc = emptyPrintDocument();
  doc.meals = [{ title: "Bridal Party", guests: [{ name: "Skila", selection: null }] }] as typeof doc.meals;
  doc.mealsPublished = false;
  assert.equal(masterSectionHasContent(doc, "meals"), false);
  doc.mealsPublished = true;
  assert.equal(masterSectionHasContent(doc, "meals"), true);
});
