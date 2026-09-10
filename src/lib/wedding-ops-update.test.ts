import assert from "node:assert/strict";
import { test } from "node:test";
import { extractMcCues } from "./print-center";
import { CANONICAL_PLAYBOOK } from "./playbook";
import {
  EXPECTED_COUPLE_NAMES,
  EXPECTED_TIMEZONE,
  EXPECTED_WEDDING_DATE,
  OPEN_WORK_TASKS,
  emptyWeddingOpsPlan,
  mergeTimelineNotes,
  notesHasLine,
  planWeddingOpsUpdate,
  planWriteCounts,
  productionWeddingIdentityError,
  type ContactSnapshot,
  type PersonSnapshot,
  type PlaybookSnapshot,
  type TimelineSnapshot,
  type WeddingOpsSnapshot,
} from "./wedding-ops-update";

function settings(overrides: Partial<WeddingOpsSnapshot> = {}): WeddingOpsSnapshot {
  return {
    coupleNames: EXPECTED_COUPLE_NAMES,
    weddingDateIso: `${EXPECTED_WEDDING_DATE}T16:00:00.000Z`,
    timezone: EXPECTED_TIMEZONE,
    timeline: [],
    contacts: [],
    people: [],
    playbook: [],
    tasks: [],
    assignments: [],
    ...overrides,
  };
}

function block(seedKey: string, notes: string, schedule = "wedding"): TimelineSnapshot {
  return {
    id: `id-${seedKey}`,
    seedKey,
    startAt: "10:00 AM",
    endAt: null,
    notes,
    sortOrder: 0,
    schedule,
  };
}

test("identity mismatch blocks every write", () => {
  const plan = planWeddingOpsUpdate(settings({ coupleNames: "Someone Else" }));
  assert.match(plan.identityError ?? "", /coupleNames/);
  assert.equal(planWriteCounts(plan).inserts, 0);
  assert.equal(planWriteCounts(plan).updates, 0);
  assert.deepEqual(plan.deletes, []);
});

test("empty production-shaped snapshot never deletes and never invents timeline blocks", () => {
  const plan = planWeddingOpsUpdate(settings());
  assert.equal(plan.identityError, null);
  assert.deepEqual(plan.deletes, []);
  assert.equal(plan.timelineInserts.length, 0);
  assert.equal(plan.timelineUpdates.length, 0);
  assert.ok(plan.skips.some((row) => row.identity === "wedding_diy_hair"));
  assert.equal(plan.playbookInserts.length, CANONICAL_PLAYBOOK.length);
  assert.equal(plan.taskInserts.length, 2);
  assert.deepEqual(
    plan.taskInserts.map((row) => row.row.orgKey).sort(),
    OPEN_WORK_TASKS.map((row) => row.orgKey).sort(),
  );
  assert.ok(plan.skips.some((row) => /Kurt Contact row/i.test(row.reason)));
  assert.ok(plan.skips.some((row) => row.identity === "legacy MC wording"));
});

test("second pass is idempotent: no duplicate playbook, tasks, or MC cue lines", () => {
  const first = planWeddingOpsUpdate(settings({
    timeline: [
      block(
        "wedding_pre_ceremony",
        "Pre-Ceremony Transition\n- guests arrive",
      ),
    ],
    people: [
      { id: "kurt", name: "Kurt Huizenga", directoryLabel: null, isDayOfContact: false },
      { id: "wendy", name: "Wendy Rush", directoryLabel: "Setup / teardown / cleanup contact", isDayOfContact: true },
    ],
    contacts: [
      {
        id: "cmt0oqlfj000qfhb8ze02e4o6",
        name: "Avalon Green · Planner",
        directoryLabel: "Planner",
        directoryList: "vendors",
        isDayOfContact: true,
        phone: null,
        email: null,
        personId: null,
      },
    ],
  }));

  const playbook: PlaybookSnapshot[] = first.playbookInserts.map((row, index) => ({
    id: `pb-${index}`,
    sourceKey: row.row.sourceKey,
    kind: row.row.kind,
    section: row.row.section,
    startAt: row.row.startAt,
    title: row.row.title,
    detail: row.row.detail,
    location: row.row.location,
    notes: row.row.notes,
    sortOrder: row.row.sortOrder,
    completed: row.row.completed,
  }));
  const timeline = [
    block("wedding_pre_ceremony", first.timelineUpdates[0]!.to.notes as string),
  ];
  const people: PersonSnapshot[] = [
    { id: "kurt", name: "Kurt Huizenga", directoryLabel: "MC", isDayOfContact: true },
    { id: "wendy", name: "Wendy Rush", directoryLabel: "Mistress of Ceremonies", isDayOfContact: true },
  ];
  const contacts: ContactSnapshot[] = [
    {
      id: "cmt0oqlfj000qfhb8ze02e4o6",
      name: "Avalon Green · Planner",
      directoryLabel: "Planner",
      directoryList: "vendors",
      isDayOfContact: true,
      phone: "386.589.7215",
      email: "greengardeneventsmi@gmail.com",
      personId: null,
    },
  ];
  const second = planWeddingOpsUpdate(settings({
    timeline,
    playbook,
    people,
    contacts,
    tasks: OPEN_WORK_TASKS.map((task, index) => ({
      id: `task-${index}`,
      title: task.title,
      orgKey: task.orgKey,
      status: "todo",
      parentId: null,
    })),
  }));

  assert.equal(second.playbookInserts.length, 0);
  assert.equal(second.taskInserts.length, 0);
  assert.equal(second.timelineUpdates.length, 0);
  assert.equal(second.personUpdates.length, 0);
  assert.equal(second.contactUpdates.length, 0);
  assert.deepEqual(second.deletes, []);
  const cues = extractMcCues(timeline);
  assert.equal(cues.filter((cue) => /welcome/i.test(cue.spoken)).length, 1);
});

test("Wendy and Kurt labels update without fabricating Kurt channels", () => {
  const plan = planWeddingOpsUpdate(settings({
    people: [
      { id: "kurt", name: "Kurt Huizenga", directoryLabel: null, isDayOfContact: false },
      { id: "wendy", name: "Wendy Rush", directoryLabel: "Family", isDayOfContact: false },
    ],
  }));
  const kurt = plan.personUpdates.find((row) => row.id === "kurt");
  const wendy = plan.personUpdates.find((row) => row.id === "wendy");
  assert.equal(kurt?.to.directoryLabel, "MC");
  assert.equal(wendy?.to.directoryLabel, "Mistress of Ceremonies");
  assert.equal(plan.contactUpdates.length, 0);
  assert.ok(plan.skips.some((row) => /will not fabricate phone\/email/i.test(row.reason)));
});

test("family Belle Genton is not merged into the videographer contact", () => {
  const plan = planWeddingOpsUpdate(settings({
    contacts: [
      {
        id: "family-belle",
        name: "Belle Genton",
        directoryLabel: "Family",
        directoryList: "guests",
        isDayOfContact: false,
        phone: null,
        email: null,
        personId: null,
      },
      {
        id: "cmt0oqlpf000tfhb8wvd5iwhr",
        name: "Belle Genton · Videographer",
        directoryLabel: "Videographer",
        directoryList: "vendors",
        isDayOfContact: true,
        phone: null,
        email: null,
        personId: null,
      },
    ],
  }));
  assert.ok(plan.skips.some((row) => row.identity === "family-belle"));
  const video = plan.contactUpdates.find((row) => row.id === "cmt0oqlpf000tfhb8wvd5iwhr");
  assert.equal(video?.to.phone, "(513) 833-0929");
});

test("conflicting phone is skipped rather than overwritten", () => {
  const plan = planWeddingOpsUpdate(settings({
    contacts: [
      {
        id: "cmt0oqlmh000sfhb8hk7z02pr",
        name: "Barry Tilson",
        directoryLabel: "Photographer",
        directoryList: "vendors",
        isDayOfContact: true,
        phone: "(555) 000-0000",
        email: null,
        personId: null,
      },
    ],
  }));
  assert.equal(plan.contactUpdates.some((row) => row.id === "cmt0oqlmh000sfhb8hk7z02pr"), false);
  assert.ok(plan.conflicts.some((row) => /phone already/.test(row.reason)));
});

test("existing playbook completion is preserved and never forced done", () => {
  const shot = CANONICAL_PLAYBOOK.find((row) => row.kind === "shot")!;
  const plan = planWeddingOpsUpdate(settings({
    playbook: [
      {
        id: "existing-shot",
        sourceKey: shot.sourceKey,
        kind: shot.kind,
        section: shot.section,
        startAt: shot.startAt,
        title: "Old title",
        detail: shot.detail,
        location: shot.location,
        notes: shot.notes,
        sortOrder: shot.sortOrder,
        completed: true,
      },
    ],
  }));
  assert.ok(plan.skips.some((row) => row.identity === shot.sourceKey && /completion/.test(row.reason)));
  const update = plan.playbookUpdates.find((row) => row.sourceKey === shot.sourceKey);
  assert.equal(update?.to.title, shot.title);
  assert.equal("completed" in (update?.to ?? {}), false);
});

test("DIY hair title becomes Hair & makeup at Airbnb and florals wording is corrected", () => {
  const plan = planWeddingOpsUpdate(settings({
    timeline: [
      block("wedding_diy_hair", "Wedding party DIY hair & makeup\nEveryone works in pairs"),
      block(
        "wedding_vendor_arrival",
        "Vendor + Wedding Party Arrival\nFlorals, rentals, tables, and ceremony space arranged",
      ),
    ],
  }));
  const hair = plan.timelineUpdates.find((row) => row.seedKey === "wedding_diy_hair");
  const vendor = plan.timelineUpdates.find((row) => row.seedKey === "wedding_vendor_arrival");
  assert.match(String(hair?.to.notes), /^Hair & makeup at Airbnb/);
  assert.match(String(vendor?.to.notes), /No florist/);
  assert.equal(/Florals, rentals/i.test(String(vendor?.to.notes)), false);
});

test("mergeTimelineNotes is additive and quote-insensitive", () => {
  const first = mergeTimelineNotes("Ceremony\nUnder the shelter", [
    'MC cue at 4:00: "The ceremony has concluded - let the celebration begin!"',
  ]);
  const second = mergeTimelineNotes(first.notes, [
    "MC cue at 4:00: “The ceremony has concluded - let the celebration begin!”",
  ]);
  assert.equal(second.changed, false);
  assert.equal(notesHasLine(first.notes, "Under the shelter"), true);
});

test("empty plan reports zero deletes", () => {
  const plan = emptyWeddingOpsPlan();
  assert.deepEqual(plan.deletes, []);
  assert.equal(planWriteCounts(plan).deletes, 0);
});

test("production identity helper matches the known wedding", () => {
  assert.equal(
    productionWeddingIdentityError({
      coupleNames: EXPECTED_COUPLE_NAMES,
      weddingDateIso: EXPECTED_WEDDING_DATE,
      timezone: EXPECTED_TIMEZONE,
    }),
    null,
  );
});
