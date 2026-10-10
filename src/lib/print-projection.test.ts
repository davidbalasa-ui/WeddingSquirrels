import assert from "node:assert/strict";
import { test } from "node:test";
import { CANONICAL_PLAYBOOK, playbookByKind } from "./playbook";
import {
  buildQuickReference,
  householdPrintTitle,
  printGuestDisplayName,
  professionalizePrintLine,
  projectHairMakeup,
  projectHouseholds,
  projectKeyDates,
  printContactRole,
  projectCoordinatorRows,
  projectMealSections,
  projectRunSheet,
  projectShotGroups,
  projectStaySections,
  projectTaskGroups,
  projectWeddingParty,
  rsvpPrintLabel,
} from "./print-projection";
import { extractMcCues } from "./print-center";
import { mergePartyPhoneSources } from "./print-center-data";

test("print projection strips reconstruction language and keeps operational meaning", () => {
  assert.equal(
    professionalizePrintLine("Katie does Haley's hair — confirmed, not DIY"),
    "Katie — Haley's hairstylist",
  );
  assert.equal(
    professionalizePrintLine("Dance floor opens at 7:00 PM in the glass house (not the older 7:45 PDF time)"),
    "Dance floor opens at 7:00 PM in the glass house",
  );
  assert.equal(
    professionalizePrintLine("Cake cutting stays at 6:15 with toasts (not the 5:15 if-by-the-bar maybe)"),
    "Cake cutting at 6:15 PM with toasts",
  );
  assert.equal(
    professionalizePrintLine("$1,200 total. Signed January 2026. Week-of remaining balance is a Money fact, not a new Task."),
    "$1,200 total. Signed January 2026",
  );
  assert.match(
    professionalizePrintLine(
      "Avalon breaks down for the point person — Avalon does not own removal/transport.",
    ) ?? "",
    /Avalon handles décor breakdown/,
  );
  assert.equal(
    professionalizePrintLine(
      "Avalon is contracted to assist. Exact timing (before ceremony vs 4:00 PM) is still TBD.",
    ),
    "Avalon assists with the marriage-license signing. Time TBD.",
  );
});

test("plus-one names are humanized only at print time", () => {
  assert.equal(printGuestDisplayName("Belle Genton +1"), "Guest of Belle Genton");
  assert.equal(printGuestDisplayName("Braxton Wasilewski +1"), "Guest of Braxton Wasilewski");
  assert.equal(printGuestDisplayName("Guess of Tess"), "Guest of Tess — name TBD");
  assert.equal(rsvpPrintLabel("not_attending"), "Declined");
  assert.equal(rsvpPrintLabel("attending"), "Attending");
  assert.equal(rsvpPrintLabel("pending"), "Awaiting RSVP");
  assert.equal(
    householdPrintTitle([{ name: "Cynthia Berman" }, { name: "Cynthia Berman +1" }]),
    "Cynthia Berman Household",
  );
});

test("print households use the canonical updated name and person RSVP", () => {
  const { households } = projectHouseholds([
    {
      rsvpStatus: "attending",
      people: [{ name: "Alex Smith", rsvpStatus: "not_attending" }],
    },
  ]);
  assert.equal(households[0]?.members[0]?.name, "Alex Smith");
  assert.equal(households[0]?.members[0]?.rsvpLabel, "Declined");
});

test("households use person-level RSVP instead of one household label", () => {
  const { households, summary } = projectHouseholds([
    {
      rsvpStatus: "attending",
      people: [
        { name: "Cynthia Berman", rsvpStatus: "attending" },
        { name: "Cynthia Berman +1", rsvpStatus: "not_attending" },
      ],
    },
  ]);
  assert.equal(households[0]?.title, "Cynthia Berman Household");
  assert.deepEqual(
    households[0]?.members.map((row) => `${row.name}:${row.rsvpLabel}`),
    ["Cynthia Berman:Attending", "Guest of Cynthia Berman:Declined"],
  );
  assert.equal(summary.attending, 1);
  assert.equal(summary.declined, 1);
});

test("print never copies household RSVP onto individual members", () => {
  const inherited = projectHouseholds([
    {
      rsvpStatus: "attending",
      people: [{ name: "Cynthia Berman" }, { name: "Guest of Cynthia", rsvpStatus: "not_attending" }],
    },
  ]);
  assert.deepEqual(
    inherited.households[0]?.members.map((row) => `${row.name}:${row.rsvpLabel}`),
    ["Cynthia Berman:Awaiting RSVP", "Guest of Cynthia:Declined"],
  );

  const legacy = projectHouseholds([
    {
      rsvpStatus: "attending",
      people: [],
      nameLine1: "Cynthia Berman",
      nameLine2: "Guest of Cynthia",
    },
  ]);
  assert.deepEqual(
    legacy.households[0]?.members.map((row) => `${row.name}:${row.rsvpLabel}`),
    ["Household:Attending"],
  );
});

test("run sheet prefers precise timed details over the broad block window", () => {
  const phases = projectRunSheet([
    {
      startAt: "2:45 PM",
      endAt: "3:15 PM",
      notes:
        "First Look + Portraits\n2:00 PM — Haley and David first look\n2:15 PM — couple portraits\n2:30 PM — immediate family portraits\n2:45 PM — bridal party photos",
      schedule: "wedding",
      sortOrder: 10,
    },
    {
      startAt: "1:00 PM",
      endAt: "2:15 PM",
      notes: "Final getting ready\nCaterer arrival time TBD\nMarriage license signing time still TBD (before ceremony vs 4:00 PM)",
      schedule: "wedding",
      sortOrder: 8,
    },
  ]);
  const portraits = phases.find((phase) => phase.title === "First Look + Portraits");
  assert.deepEqual(
    portraits?.events.map((event) => `${event.timeLabel}|${event.title}`),
    [
      "2:00 PM|Haley and David first look",
      "2:15 PM|couple portraits",
      "2:30 PM|immediate family portraits",
      "2:45 PM|bridal party photos",
    ],
  );
  assert.equal(portraits?.events.some((event) => event.timeLabel.includes("3:15")), false);
  const gettingReady = phases.find((phase) => phase.title === "Final getting ready");
  assert.equal(gettingReady?.events.some((event) => event.title === "Caterer arrival" && event.timeLabel === "Time TBD"), true);
  assert.equal(
    gettingReady?.events.some((event) => event.title === "Marriage-license signing" && event.timeLabel === "Time TBD"),
    true,
  );
  assert.equal(gettingReady?.events.some((event) => /before ceremony vs/i.test(event.title)), false);
});

test("duplicate MC cues keep the complete spoken version once", () => {
  const cues = extractMcCues([
    {
      startAt: "4:00 PM",
      endAt: "5:00 PM",
      notes:
        'Cocktail Hour\nMC cue 4:55: "Honored guests, cocktail hour is nearing its end."\nMC cue 4:55 PM: "Honored guests, cocktail hour is nearing its end. Please begin making your way to the dinner tables."',
      schedule: "wedding",
    },
  ]);
  const seating = cues.filter((cue) => /4:55/.test(cue.time ?? ""));
  assert.equal(seating.length, 1);
  assert.match(seating[0]!.spoken, /Please begin making your way/);
});

test("hair print uses a room key and prints each time once", () => {
  const { rooms, rows } = projectHairMakeup(playbookByKind(CANONICAL_PLAYBOOK, "hair_makeup"));
  assert.equal(rooms.some((room) => room.title === "Bedroom 2" && /Haley get-ready/i.test(room.detail)), true);
  assert.equal(rooms.some((room) => /Overflow \/ mirrors/i.test(room.detail)), true);
  const nine = rows.filter((row) => row.timeLabel === "9:00 AM");
  assert.equal(nine[0]?.showTime, true);
  assert.equal(nine.slice(1).every((row) => row.showTime === false), true);
  assert.equal(rows.some((row) => /not DIY/i.test(row.notes.join(" "))), false);
});

test("shot list groups once and marks inferred party pairings", () => {
  const groups = projectShotGroups(playbookByKind(CANONICAL_PLAYBOOK, "shot"));
  assert.deepEqual(
    groups.map((group) => group.section),
    ["Details", "Portraits", "Bridal party", "Family"],
  );
  const party = groups.find((group) => group.section === "Bridal party");
  assert.equal(party?.items.some((item) => item.title === "Bride with wedding party" && !item.inferredPairing), true);
  assert.equal(party?.items.some((item) => item.title === "Bride with Skila" && item.inferredPairing), true);
  assert.match(party?.confirmationNote ?? "", /Confirm with David & Haley/);
});

test("stay empty required slots print Unassigned; optional slots do not look incomplete", () => {
  const stay = projectStaySections(
    [
      { sectionId: "bride", label: "Bottom bunk", occupant: "", optional: false },
      { sectionId: "groom", label: "Person 1", occupant: "", optional: true },
    ],
    [],
  );
  assert.equal(stay.find((section) => /Bride Side/.test(section.title))?.slots[0]?.occupant, "Unassigned");
  assert.equal(stay.find((section) => /Groom Side/.test(section.title))?.slots[0]?.occupant, "Optional / available");
});

test("meal groups print MC Team instead of Mr. & Mrs. of Ceremony", () => {
  const meals = projectMealSections(
    [
      { name: "Wendy", sectionId: "ceremony", choices: {} },
      { name: "Kurt", sectionId: "ceremony", choices: {} },
    ],
    [],
  );
  assert.equal(meals[0]?.title, "MC Team");
});

test("open work groups children under the parent workspace", () => {
  const groups = projectTaskGroups([
    { id: "p", title: "Wedding drinks & serving supplies", status: "todo", parentId: null, dueLabel: null, assignees: [] },
    { id: "c1", title: "Buy wedding booze", status: "todo", parentId: "p", dueLabel: null, assignees: [] },
    { id: "c2", title: "Order remaining s'mores ingredients", status: "done", parentId: "p", dueLabel: null, assignees: [] },
    { id: "s", title: "Standalone leftover", status: "todo", parentId: null, dueLabel: null, assignees: ["Shelly"] },
  ]);
  assert.equal(groups[0]?.title, "Wedding drinks & serving supplies");
  assert.equal(groups[0]?.items.some((item) => item.title === "Wedding drinks & serving supplies"), false);
  assert.equal(groups[0]?.items.some((item) => item.title === "Order remaining s'mores ingredients"), false);
  assert.equal(groups[0]?.items.some((item) => item.title === "Buy wedding booze"), true);
  assert.equal(groups.at(-1)?.title, "Other open work");
});

test("open work leaves out finished steps, finished cards and groups with nothing open", () => {
  const groups = projectTaskGroups([
    { id: "p", title: "Ceremony Flower Sword", status: "todo", parentId: null, dueLabel: null, assignees: [] },
    { id: "c1", title: "Receive the ordered sword", status: "done", parentId: "p", dueLabel: null, assignees: [] },
    { id: "c2", title: "Decorate the sword with faux flowers", status: "done", parentId: "p", dueLabel: null, assignees: [] },
    { id: "s1", title: "Call crossbow", status: "done", parentId: null, dueLabel: null, assignees: [] },
    { id: "s2", title: "Meet with Avalon", status: "todo", parentId: null, dueLabel: null, assignees: [] },
  ]);
  assert.deepEqual(
    groups.map((group) => [group.title, group.items.map((item) => item.title)]),
    [["Other open work", ["Meet with Avalon"]]],
  );
  assert.equal(groups.flatMap((group) => group.items).some((item) => item.done), false);
  assert.deepEqual(
    projectTaskGroups([{ id: "s1", title: "Call crossbow", status: "done", parentId: null, dueLabel: null, assignees: [] }]),
    [],
  );
});

test("key dates keep rehearsal and wedding day, not bachelor weekend", () => {
  const rows = projectKeyDates(
    [
      {
        title: "Bachelor party",
        startDate: new Date("2026-08-21T12:00:00"),
        endDate: new Date("2026-08-23T12:00:00"),
        notes: null,
      },
      {
        title: "Wedding day",
        startDate: new Date("2026-10-16T12:00:00"),
        endDate: new Date("2026-10-16T12:00:00"),
        notes: null,
      },
    ],
    "America/Detroit",
    new Date("2026-10-16T12:00:00"),
    false,
  );
  assert.equal(rows.some((row) => /bachelor/i.test(row.title)), false);
  assert.equal(rows.some((row) => /Rehearsal Dinner/.test(row.title)), true);
  assert.equal(rows.some((row) => row.title === "Wedding Day"), true);
});

test("quick reference prefers canonical venue over timeline regex fallbacks", () => {
  const ref = buildQuickReference({
    coupleNames: "David & Haley",
    weddingDateLabel: "Friday, October 16, 2026",
    weddingBlocks: [
      { startAt: "3:30 PM", endAt: "4:00 PM", notes: "Ceremony\nlocation: Legacy parsed name" },
    ],
    rehearsalBlocks: [],
    contacts: [],
    mistressOfCeremonies: null,
    mcName: null,
    coordinatorPhoneHint: null,
    rsvp: null,
    canonicalPlaces: {
      venueName: "Canonical Venue",
      venueAddress: ["100 Canon St", "City, ST 00000"],
      rehearsalDinnerName: "Canonical Dinner",
      rehearsalDinnerAddress: ["200 Dinner Rd"],
      airbnbName: "Stay Hub",
      airbnbAddress: ["300 Stay Ln"],
    },
  });
  assert.equal(ref.venueName, "Canonical Venue");
  assert.deepEqual(ref.venueAddress, ["100 Canon St", "City, ST 00000"]);
  assert.equal(ref.rehearsalDinnerName, "Canonical Dinner");
  assert.equal(ref.airbnbName, "Stay Hub");
});

test("quick reference uses current ceremony and close times", () => {
  const ref = buildQuickReference({
    coupleNames: "David & Haley",
    weddingDateLabel: "Friday, October 16, 2026",
    weddingBlocks: [
      { startAt: "3:30 PM", endAt: "4:00 PM", notes: "Ceremony\nUnder the shelter" },
      { startAt: "7:00 PM", endAt: "10:00 PM", notes: "Open Dancing\nDance floor opens" },
      { startAt: "10:00 PM", endAt: "11:00 PM", notes: "Tear down / Clean up\n11:00 PM — venue closes" },
    ],
    rehearsalBlocks: [
      { startAt: "3:00 PM", endAt: null, notes: "Airbnb Check-in\nAirbnb: 10268 51st St, Grand Junction, MI 49056" },
    ],
    contacts: [{ name: "Avalon Green · Planner", directoryLabel: "Planner", phone: "386-589-7215" }],
    mistressOfCeremonies: "Wendy Rush",
    mcName: "Kurt Huizenga",
    coordinatorPhoneHint: "386-589-7215",
    rsvp: { attending: 10, declined: 2, awaiting: 3 },
  });
  assert.equal(ref.ceremonyTime, "3:30 PM");
  assert.equal(ref.mcName, "Kurt Huizenga");
  assert.equal(ref.mistressOfCeremonies, "Wendy Rush");
  assert.equal(ref.receptionEnds, "10:00 PM");
  assert.equal(ref.venueCloses, "11:00 PM");
  assert.equal(ref.coordinatorPhone, "386-589-7215");
});

test("quick reference fills Wendy and Kurt when directory roles are missing", () => {
  const ref = buildQuickReference({
    coupleNames: "David & Haley",
    weddingDateLabel: "Friday, October 16, 2026",
    weddingBlocks: [],
    rehearsalBlocks: [],
    contacts: [],
    mistressOfCeremonies: null,
    mcName: null,
    coordinatorPhoneHint: null,
    rsvp: null,
  });
  assert.equal(ref.mistressOfCeremonies, "Wendy Rush");
  assert.equal(ref.mcName, "Kurt Huizenga");
});

test("coordinator print keeps operational scope and drops architecture notes", () => {
  const rows = projectCoordinatorRows(playbookByKind(CANONICAL_PLAYBOOK, "coordinator"));
  const blob = rows.flatMap((row) => [row.title, ...row.notes]).join("\n");
  assert.equal(/money fact/i.test(blob), false);
  assert.equal(/not a new task/i.test(blob), false);
  assert.equal(/personally owning/i.test(blob), false);
  assert.equal(/before ceremony vs/i.test(blob), false);
  assert.equal(rows.some((row) => row.title === "The Sweet Spot — 8 hours"), true);
  assert.match(
    rows.find((row) => /breakdown/i.test(row.title))?.notes.join(" ") ?? "",
    /Avalon handles décor breakdown/,
  );
  assert.match(
    rows.find((row) => /Marriage license/i.test(row.title))?.notes.join(" ") ?? "",
    /Time TBD/,
  );
});

test("Kurt prints as MC even without a directory label", () => {
  assert.equal(printContactRole("Kurt Huizenga", null), "MC");
  assert.equal(printContactRole("Wendy Rush", null), "Mistress of Ceremonies");
});

test("wedding party packet lists the lineup pairs, colors, call times, and open TBDs", () => {
  const view = projectWeddingParty({
    lineup: playbookByKind(CANONICAL_PLAYBOOK, "lineup"),
    decor: playbookByKind(CANONICAL_PLAYBOOK, "decor"),
    weddingBlocks: [
      { startAt: "3:15 PM", endAt: "3:30 PM", notes: "Pre-Ceremony Transition\nGuests begin arriving\nWedding party lines up\nTouch-ups" },
      { startAt: "4:00 PM", endAt: "5:00 PM", notes: "Cocktail Hour\nGuests enjoy drinks + appetizers" },
      { startAt: "6:00 PM", endAt: "6:30 PM", notes: "Toasts + Cake cutting\nToasts (Best man, MOH, FOB)" },
    ],
    contacts: [
      { name: "Skila Goins", phone: "269-419-7847" },
      { name: "Avalon Green · Planner", phone: "386.589.7215" },
    ],
  });

  assert.deepEqual(
    view.members.map((member) => [member.name, member.walksWith, member.role]),
    [
      ["Skila", "Trinity", "Wedding party"],
      ["Trinity", "Skila", "Wedding party"],
      ["Victoria", "Bri", "Wedding party"],
      ["Bri", "Victoria", "Wedding party"],
      ["Kaylie", "Evan", "Wedding party"],
      ["Evan", "Kaylie", "Wedding party"],
      ["Braxton", "Andi", "Wedding party"],
      ["Andi", "Braxton", "Wedding party"],
      ["Melody", null, "Flower girl"],
    ],
  );
  assert.equal(view.members[0]?.phone, "269-419-7847");
  assert.equal(view.members[1]?.phone, null);
  assert.equal(view.processional.length, 9);
  assert.equal(view.processional[0]?.title, "Mother of the Groom & Father of the Groom");
  assert.equal(view.processional[8]?.title, "Haley with Dad");
  assert.equal(view.lineUpTime, "3:20 PM");
  assert.equal(view.theme, "Sunset dreams");
  assert.deepEqual(view.colors, ["dark blue", "powder blue", "purple", "powder pink"]);
  assert.deepEqual(
    view.moments.map((moment) => moment.title),
    ["Pre-Ceremony Transition", "Toasts + Cake cutting"],
  );
  assert.deepEqual(view.moments[0]?.notes, ["Wedding party lines up"]);
  assert.equal(view.openItems.some((item) => /maid of honor|witnesses/i.test(item)), false);
  assert.ok(view.openItems.some((item) => /attire/i.test(item)));
  assert.ok(view.openItems.some((item) => /toast/i.test(item)));
});

test("wedding party phones print only on an unambiguous first-name match", () => {
  const view = projectWeddingParty({
    lineup: [{ title: "Kaylie & Evan", startAt: "3:20 PM", sortOrder: 0 }],
    decor: [],
    weddingBlocks: [],
    contacts: [
      { name: "Evan Eling", phone: "231-343-6924" },
      { name: "Evan Wiewiora", phone: "231-000-0000" },
      { name: "Kaylie Cartwright", phone: "231-329-3264" },
    ],
  });
  assert.equal(view.members.find((m) => m.name === "Evan")?.phone, null);
  assert.equal(view.members.find((m) => m.name === "Kaylie")?.phone, "231-329-3264");
});

test("wedding party phones fall back to guest household records when Contacts lack them", () => {
  const sources = mergePartyPhoneSources(
    [
      { name: "Bri Eling", phone: "231-769-3871" },
      { name: "Avalon Green · Planner", phone: "386.589.7215" },
    ],
    [
      { name: "Bri Eling", phone: "000-000-0000" },
      { name: "Skila Goins", phone: "269-419-7847" },
      { name: "Mykah Mckay", phone: "269-419-7847" },
      { name: "Victoria Owens", phone: null },
    ],
  );
  assert.deepEqual(sources, [
    { name: "Bri Eling", phone: "231-769-3871" },
    { name: "Avalon Green · Planner", phone: "386.589.7215" },
    { name: "Skila Goins", phone: "269-419-7847" },
    { name: "Mykah Mckay", phone: "269-419-7847" },
    { name: "Victoria Owens", phone: null },
  ]);
  const view = projectWeddingParty({
    lineup: [{ title: "Skila & Trinity", startAt: "3:20 PM", sortOrder: 0 }, { title: "Victoria & Bri", startAt: "3:20 PM", sortOrder: 1 }],
    decor: [],
    weddingBlocks: [],
    contacts: sources,
  });
  assert.equal(view.members.find((m) => m.name === "Skila")?.phone, "269-419-7847");
  assert.equal(view.members.find((m) => m.name === "Bri")?.phone, "231-769-3871");
  assert.equal(view.members.find((m) => m.name === "Victoria")?.phone, null);
});

test("a first name shared with someone who has no phone prints TBD, not the other person's number", () => {
  const view = projectWeddingParty({
    lineup: [{ title: "Kaylie & Evan", startAt: "3:20 PM", sortOrder: 0 }],
    decor: [],
    weddingBlocks: [],
    contacts: [
      { name: "Evan Brooks", phone: null },
      { name: "Evan Miller", phone: "616-555-0101" },
      { name: "Kaylie Cartwright", phone: null },
      { name: "Kaylie Cartwright · Bridesmaid", phone: "231-329-3264" },
    ],
  });
  assert.equal(view.members.find((m) => m.name === "Evan")?.phone, null);
  assert.equal(view.members.find((m) => m.name === "Kaylie")?.phone, "231-329-3264");
});

test("run sheet: a time moved to the margin keeps the verb and leaves no stranded period", () => {
  const [phase] = projectRunSheet([
    {
      startAt: "8:50 PM",
      endAt: "9:00 PM",
      notes: "Overnight check moment\nChildren arrive at 1:15 PM.\nReturn to dancing at 9:00 PM.\nOpen items: Confirm whether children leave at 8:00 PM or after the 8:15 PM send-off.",
      schedule: "wedding",
    },
  ]);
  assert.deepEqual(
    phase!.events.map((event) => [event.timeLabel, event.title]),
    [
      ["1:15 PM", "Children arrive"],
      ["9:00 PM", "Return to dancing"],
    ],
  );
  // An open question stays a note, unmangled.
  assert.deepEqual(phase!.notes, ["Open items: Confirm whether children leave at 8:00 PM or after the 8:15 PM send-off."]);
});

test("run sheet keeps a time range on one line and shares its AM/PM across both ends", () => {
  const phases = projectRunSheet([
    {
      startAt: "10:30 AM",
      endAt: "12:30 PM",
      notes:
        "Venue opens\nAvalon (coordinator) arrives 10:30 or 11:00 AM\nParty stations: bathrooms for hair, bedrooms for makeup (see Hair & Makeup page)\nWedding party arrives at 12:15–12:25 PM",
      schedule: "wedding",
      sortOrder: 1,
    },
  ]);
  const venue = phases.find((phase) => phase.title === "Venue opens");
  const lines = venue?.events.map((event) => `${event.timeLabel}|${event.title}`) ?? [];
  assert.equal(lines.includes("10:30 AM – 11:00 AM|Avalon (coordinator) arrives"), true, lines.join("\n"));
  assert.equal(lines.includes("12:15 PM – 12:25 PM|Wedding party arrives"), true, lines.join("\n"));
  assert.equal(lines.some((line) => /–12:25|\(\s*\)/.test(line)), false, lines.join("\n"));
  assert.equal(
    professionalizePrintLine("Party stations: bathrooms for hair, bedrooms for makeup (see Hair & Makeup page)"),
    "Party stations: bathrooms for hair, bedrooms for makeup",
  );
});
