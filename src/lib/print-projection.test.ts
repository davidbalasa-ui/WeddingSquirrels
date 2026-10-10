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
  projectShotGroups,
  projectStaySections,
  projectTaskGroups,
  projectWeddingParty,
  projectTimelineOpenItems,
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
  const done = projectTaskGroups(
    [
      { id: "p", title: "Ceremony Flower Sword", status: "todo", parentId: null, dueLabel: null, assignees: [] },
      { id: "c1", title: "Receive the ordered sword", status: "done", parentId: "p", dueLabel: null, assignees: [] },
      { id: "c2", title: "Decorate the sword with faux flowers", status: "todo", parentId: "p", dueLabel: null, assignees: [] },
      { id: "s1", title: "Call crossbow", status: "done", parentId: null, dueLabel: null, assignees: [] },
      { id: "s2", title: "Meet with Avalon", status: "todo", parentId: null, dueLabel: null, assignees: [] },
    ],
    "done",
  );
  assert.deepEqual(
    done.map((group) => [group.title, group.items.map((item) => item.title)]),
    [
      ["Ceremony Flower Sword", ["Receive the ordered sword"]],
      ["Other completed work", ["Call crossbow"]],
    ],
  );
});

test("open tasks with a due date print under their day, in date order", () => {
  const groups = projectTaskGroups([
    { id: "a", title: "Later task", status: "todo", parentId: null, dueLabel: "Oct 13, 2026", dueDay: "Tuesday, October 13", dueAt: 2, assignees: [] },
    { id: "b", title: "Undated task", status: "todo", parentId: null, dueLabel: null, assignees: [] },
    { id: "c", title: "Earlier task", status: "todo", parentId: null, dueLabel: "Oct 12, 2026", dueDay: "Monday, October 12", dueAt: 1, assignees: [] },
    { id: "d", title: "Same day task", status: "todo", parentId: null, dueLabel: "Oct 13, 2026", dueDay: "Tuesday, October 13", dueAt: 3, assignees: [] },
  ]);
  assert.deepEqual(
    groups.map((group) => [group.title, group.items.map((item) => item.title)]),
    [
      ["Monday, October 12", ["Earlier task"]],
      ["Tuesday, October 13", ["Later task", "Same day task"]],
      ["Other open work", ["Undated task"]],
    ],
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

test("quick reference prints the places from the plan", () => {
  const ref = buildQuickReference({
    coupleNames: "David & Haley",
    weddingDateLabel: "Friday, October 16, 2026",
    weddingBlocks: [{ startAt: "3:30 PM", endAt: "4:00 PM", notes: "Ceremony\nlocation: Black Sheep Shelter" }],
    rehearsalBlocks: [
      { startAt: "3:00 PM", endAt: null, notes: "Airbnb Check-in\nAirbnb: 10268 51st St, Grand Junction, MI 49056" },
    ],
    contacts: [],
    mistressOfCeremonies: null,
    mcName: null,
    coordinatorPhoneHint: null,
    rsvp: null,
  });
  assert.equal(ref.venueName, "Black Sheep Shelter");
  assert.deepEqual(ref.venueAddress, ["342 62nd St", "South Haven, MI 49090"]);
  assert.equal(ref.rehearsalDinnerName, "Hawkshead");
  assert.equal(ref.airbnbName, "Airbnb");
  assert.deepEqual(ref.airbnbAddress, ["10268 51st St", "Grand Junction, MI 49056"]);
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
    /Signing is at 4:00 PM, immediately after the recessional/,
  );
  assert.equal(/Time TBD/.test(blob), false);
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
  // The schedule says the party lines up in the 3:15 PM moment, so the processional says 3:15 too
  // (David, 2026-10-10: "We need this all to be consistent").
  assert.equal(view.lineUpTime, "3:15 PM");
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

test("print cleanup still drops the page pointer from a hair-and-makeup line elsewhere in the binder", () => {
  assert.equal(
    professionalizePrintLine("Party stations: bathrooms for hair, bedrooms for makeup (see Hair & Makeup page)"),
    "Party stations: bathrooms for hair, bedrooms for makeup",
  );
});

test("open lines on Wedding Day moments print as open work under their day", () => {
  const groups = projectTimelineOpenItems({
    rehearsal: [{ startAt: "1:00 PM", endAt: "2:30 PM", notes: "Airbnb check in\nOpen items: Confirm the Airbnb address and who has check-in access." }],
    wedding: [
      { startAt: "4:50 PM", endAt: "5:00 PM", notes: "Wedding party lines up\nOpen items: Give Wendy the entrance order and make sure she knows how to say every name." },
      { startAt: "5:00 PM", endAt: null, notes: "Grand entrance and dinner begins\nGrand entrance starts at 5:00 PM.\nOpen items: Choose who calls tables and confirm how Precious Peony will serve dinner." },
      { startAt: "6:15 PM", endAt: null, notes: "Cake cutting\nCut the cake immediately after toasts." },
    ],
    rehearsalDay: "Thursday, October 15",
    weddingDay: "Friday, October 16",
  });
  assert.deepEqual(
    groups.map((group) => [group.title, group.items.map((item) => [item.title, item.dueLabel])]),
    [
      ["Open on the rehearsal day · Thursday, October 15", [["Confirm the Airbnb address and who has check-in access.", "1:00 PM – 2:30 PM · Airbnb check in"]]],
      [
        "Open on the wedding day · Friday, October 16",
        [
          ["Give Wendy the entrance order and make sure she knows how to say every name.", "4:50 PM – 5:00 PM · Wedding party lines up"],
          ["Choose who calls tables and confirm how Precious Peony will serve dinner.", "5:00 PM · Grand entrance and dinner begins"],
        ],
      ],
    ],
  );
});
