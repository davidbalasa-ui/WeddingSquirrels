import { PrismaClient } from "@prisma/client";
import { CANDIDATE_WEDDING_TIMELINE, planCandidateWeddingImport } from "../../src/lib/day-of-bootstrap";
import { parsedTimeFields } from "../../src/lib/day-of-time";
import { planReconciledTimeline } from "../../src/lib/reconciled-timeline";
import { REHEARSAL_SCHEDULE_SEED } from "../../src/lib/rehearsal";
import { planWeddingOpsUpdate } from "../../src/lib/wedding-ops-update";

/**
 * Test copy of the data for the overnight end-to-end checks. Local Postgres only,
 * never the live database. Names, phones and moments below are David's real rows
 * as the repo already records them (wedding-ops channels, lineup, bootstrap and
 * reconciled timeline); nothing is invented.
 */
export const OVERNIGHT_DATABASE_URL =
  process.env.OVERNIGHT_DATABASE_URL ||
  "postgresql://wedding:wedding@127.0.0.1:5432/wedding_overnight?sslmode=disable";

function assertLocal(url: string) {
  const host = new URL(url.replace(/^postgres(ql)?:\/\//, "http://")).hostname;
  if (!["localhost", "127.0.0.1", "db"].includes(host)) {
    throw new Error(`Overnight checks only run against a local database, not ${host}`);
  }
}

export function overnightPrisma(): PrismaClient {
  assertLocal(OVERNIGHT_DATABASE_URL);
  return new PrismaClient({ datasourceUrl: OVERNIGHT_DATABASE_URL });
}

/** Day-of contacts as the repo's approved channels and the certification fixture name them. */
const CONTACTS: Array<{
  name: string;
  phone?: string;
  email?: string;
  directoryLabel?: string;
  directoryList?: string;
  isDayOfContact: boolean;
}> = [
  { name: "Avalon Green", phone: "386.589.7215", email: "greengardeneventsmi@gmail.com", directoryLabel: "Planner", directoryList: "vendors", isDayOfContact: true },
  { name: "Black Sheep Shelter", phone: "(616) 335-0797", directoryLabel: "Venue", directoryList: "vendors", isDayOfContact: true },
  { name: "Barry Tilson", phone: "(248) 704-3731", directoryLabel: "Photographer", directoryList: "vendors", isDayOfContact: true },
  { name: "Belle Genton · Videographer", phone: "(513) 833-0929", directoryLabel: "Videographer", directoryList: "vendors", isDayOfContact: true },
  { name: "Precious Peony", email: "preciouspeonyllc@gmail.com", directoryLabel: "Caterer", directoryList: "vendors", isDayOfContact: true },
  { name: "Shelly Wiewiora", directoryLabel: "Mother of the Bride", directoryList: "guests", isDayOfContact: true },
  { name: "Wendy Rush", phone: "(616) 318-9393", directoryLabel: "Mistress of Ceremonies", directoryList: "vendors", isDayOfContact: true },
];

const ASSIGNMENTS = ["Get 100 lbs of Ice", "Prep Smores Station foods", "Cater in Lunch"];

export type ResetOptions = {
  /** Apply the reconciled document the way the Wedding Day card does (default true). */
  reconciled?: boolean;
};

/**
 * Puts the test copy back to a known state: the 19 bootstrap wedding moments,
 * the 7 rehearsal moments, day-of contacts and jobs, Kurt as MC, then (by
 * default) the reconciled document applied on top, exactly like tapping Apply.
 */
export async function resetOvernightData(prisma: PrismaClient, options: ResetOptions = {}) {
  const reconciled = options.reconciled ?? true;

  await prisma.task.updateMany({ where: { timelineBlockId: { not: null } }, data: { timelineBlockId: null } }).catch(() => undefined);
  await prisma.timelineBlock.deleteMany({});
  await prisma.dayAssignment.deleteMany({});
  await prisma.contact.deleteMany({});

  // 19 canonical wedding blocks, as production started.
  const plan = planCandidateWeddingImport([], CANDIDATE_WEDDING_TIMELINE.map((row) => row.seedKey));
  for (const row of plan.inserts) await prisma.timelineBlock.create({ data: row });

  // The wedding-ops enrichment production received (MC cues, playlists, arrival lines).
  const seeded = await prisma.timelineBlock.findMany();
  const ops = planWeddingOpsUpdate({
    coupleNames: "David & Haley",
    weddingDateIso: "2026-10-16",
    timezone: "America/Detroit",
    timeline: seeded.map((row) => ({ id: row.id, seedKey: row.seedKey, startAt: row.startAt, endAt: row.endAt, notes: row.notes, sortOrder: row.sortOrder, schedule: row.schedule })),
    contacts: [],
    people: [],
    playbook: [],
    tasks: [],
    assignments: [],
  });
  if (ops.identityError) throw new Error(ops.identityError);
  for (const update of ops.timelineUpdates) {
    await prisma.timelineBlock.update({ where: { id: update.id }, data: { notes: update.to.notes! } });
  }

  // 7 rehearsal rows as the app seeded them (ids, no seedKey).
  await prisma.timelineBlock.createMany({
    data: REHEARSAL_SCHEDULE_SEED.map((block, index) => ({
      id: block.id,
      startAt: block.startAt,
      endAt: block.endAt,
      notes: block.notes,
      sortOrder: index,
      schedule: "rehearsal",
      ...parsedTimeFields(block.startAt, block.endAt),
    })),
  });

  for (const [index, contact] of CONTACTS.entries()) {
    await prisma.contact.create({
      data: {
        name: contact.name,
        phone: contact.phone ?? null,
        email: contact.email ?? null,
        directoryLabel: contact.directoryLabel ?? null,
        directoryList: contact.directoryList ?? null,
        isDayOfContact: contact.isDayOfContact,
        sortOrder: index,
      },
    });
  }

  for (const [index, title] of ASSIGNMENTS.entries()) {
    await prisma.dayAssignment.create({ data: { title, sortOrder: index } });
  }

  const kurt = await prisma.person.findFirst({ where: { name: { startsWith: "Kurt", mode: "insensitive" } } });
  if (kurt) {
    await prisma.person.update({ where: { id: kurt.id }, data: { name: "Kurt Huizenga", directoryLabel: "MC", isDayOfContact: true } });
  } else {
    await prisma.person.create({ data: { id: "kurt_huizenga", name: "Kurt Huizenga", directoryLabel: "MC", isDayOfContact: true, sortOrder: 99 } });
  }

  if (reconciled) await applyReconciled(prisma);
}

/** Same writes as applyReconciledTimelineAction, without a session. */
export async function applyReconciled(prisma: PrismaClient) {
  const existing = await prisma.timelineBlock.findMany({
    select: { id: true, seedKey: true, schedule: true, startAt: true, endAt: true, notes: true, sortOrder: true },
  });
  const plan = planReconciledTimeline(existing);
  await prisma.$transaction([
    ...plan.removals.map((row) => prisma.timelineBlock.delete({ where: { id: row.id } })),
    ...plan.inserts.map((data) => prisma.timelineBlock.create({ data })),
  ]);
  return plan;
}

if (process.argv[1] && /db\.ts$/.test(process.argv[1])) {
  const prisma = overnightPrisma();
  const fresh = process.argv.includes("--fresh");
  resetOvernightData(prisma, { reconciled: !fresh })
    .then(async () => {
      const counts = await prisma.timelineBlock.groupBy({ by: ["schedule"], _count: true });
      console.log("overnight data reset", counts.map((row) => `${row.schedule}=${row._count}`).join(" "));
    })
    .finally(() => prisma.$disconnect());
}
