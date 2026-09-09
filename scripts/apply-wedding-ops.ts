/**
 * Surgical, idempotent wedding-ops update.
 *
 * Default is dry-run against known production Neon (read + plan only).
 *
 *   npx tsx scripts/apply-wedding-ops.ts
 *   npx tsx scripts/apply-wedding-ops.ts --apply
 *   npx tsx scripts/apply-wedding-ops.ts --local
 *   npx tsx scripts/apply-wedding-ops.ts --local --apply
 *
 * Production connection: NEON_DATABASE_URL, or PGHOST+PGUSER+PGPASSWORD+PGDATABASE.
 * --local uses DATABASE_URL and requires localhost. Production never inserts
 * missing TimelineBlock rows. --local may insert the 19 canonical wedding
 * blocks only when the local wedding schedule is empty.
 *
 * Never seeds, resets, truncates, or deletes.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import {
  CANDIDATE_WEDDING_TIMELINE,
  planCandidateWeddingImport,
} from "../src/lib/day-of-bootstrap";
import { parsedTimeFields } from "../src/lib/day-of-time";
import {
  isProtectedProductionTarget,
  parseDatabaseTarget,
  PROTECTED_PRODUCTION_ENDPOINT_ID,
} from "../src/lib/seed-safety";
import {
  planWeddingOpsUpdate,
  planWriteCounts,
  productionWeddingIdentityError,
  emptyWeddingOpsPlan,
  type AssignmentSnapshot,
  type ContactSnapshot,
  type PersonSnapshot,
  type PlaybookSnapshot,
  type TaskSnapshot,
  type TimelineSnapshot,
  type WeddingOpsPlan,
  type WeddingOpsSnapshot,
} from "../src/lib/wedding-ops-update";

function isNeonHost(host: string): boolean {
  const hostname = host.toLowerCase();
  return hostname === "neon.tech" || hostname.endsWith(".neon.tech");
}

function isLocalHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "db";
}

function parseHost(databaseUrl: string): string {
  try {
    return new URL(databaseUrl.replace(/^postgres(ql)?:\/\//, "http://")).hostname;
  } catch {
    return "";
  }
}

function neonConnectionUrl(): { url: string; host: string } {
  const explicit = process.env.NEON_DATABASE_URL?.trim();
  if (explicit) {
    const host = parseHost(explicit);
    if (!isNeonHost(host)) throw new Error(`NEON_DATABASE_URL host is not Neon: ${host}`);
    return { url: explicit, host };
  }

  const pgHost = process.env.PGHOST?.trim();
  const pgUser = process.env.PGUSER?.trim();
  const pgPassword = process.env.PGPASSWORD ?? "";
  const pgDatabase = process.env.PGDATABASE?.trim();
  if (pgHost || pgUser || pgDatabase || process.env.PGPASSWORD !== undefined) {
    const missing = [
      !pgHost && "PGHOST",
      !pgUser && "PGUSER",
      !pgPassword && "PGPASSWORD",
      !pgDatabase && "PGDATABASE",
    ].filter(Boolean);
    if (missing.length) throw new Error(`Missing ${missing.join(", ")}`);
    if (!isNeonHost(pgHost!)) throw new Error(`PGHOST is not Neon: ${pgHost}`);
    const sslmode = process.env.PGSSLMODE?.trim() || "require";
    return {
      url: `postgresql://${encodeURIComponent(pgUser!)}:${encodeURIComponent(pgPassword)}@${pgHost}/${pgDatabase}?sslmode=${sslmode}`,
      host: pgHost!,
    };
  }

  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  const host = parseHost(databaseUrl);
  if (databaseUrl && isNeonHost(host)) return { url: databaseUrl, host };
  throw new Error(
    "No production Neon credentials. Set NEON_DATABASE_URL or PGHOST/PGUSER/PGPASSWORD/PGDATABASE. Local DATABASE_URL is refused unless you pass --local.",
  );
}

function localConnectionUrl(): { url: string; host: string } {
  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  const host = parseHost(databaseUrl);
  if (!databaseUrl || !isLocalHost(host)) {
    throw new Error(`--local requires a localhost DATABASE_URL; got host ${host || "(empty)"}`);
  }
  return { url: databaseUrl, host };
}

function clientFor(url: string) {
  if (isNeonHost(parseHost(url))) {
    return new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
  }
  return new PrismaClient({ datasourceUrl: url });
}

function assertKnownProductionHost(host: string, database: string) {
  const target = parseDatabaseTarget(`postgresql://x@${host}/${database}`);
  if (!isProtectedProductionTarget(target) && !host.toLowerCase().includes(PROTECTED_PRODUCTION_ENDPOINT_ID)) {
    throw new Error(`Refusing write: host ${host} is not the known production endpoint ${PROTECTED_PRODUCTION_ENDPOINT_ID}`);
  }
  if (database !== "neondb") {
    throw new Error(`Refusing write: database is ${database}, expected neondb`);
  }
}

function sqlStatements(sql: string): string[] {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

async function ensurePlaybookTable(prisma: PrismaClient) {
  const sql = readFileSync(path.join(process.cwd(), "scripts/neon-playbook.sql"), "utf8");
  for (const statement of sqlStatements(sql)) {
    await prisma.$executeRawUnsafe(`${statement};`);
  }
}

async function tableCounts(prisma: PrismaClient): Promise<Record<string, number>> {
  const [
    Person,
    TimelineBlock,
    Contact,
    Task,
    DayAssignment,
    PlaybookItem,
  ] = await Promise.all([
    prisma.person.count(),
    prisma.timelineBlock.count(),
    prisma.contact.count(),
    prisma.task.count(),
    prisma.dayAssignment.count(),
    prisma.playbookItem.count().catch(() => 0),
  ]);
  return { Person, TimelineBlock, Contact, Task, DayAssignment, PlaybookItem };
}

async function loadSnapshot(prisma: PrismaClient): Promise<WeddingOpsSnapshot> {
  const [settings, timeline, contacts, people, playbook, tasks, assignments] = await Promise.all([
    prisma.appSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.timelineBlock.findMany({
      select: {
        id: true,
        seedKey: true,
        startAt: true,
        endAt: true,
        notes: true,
        sortOrder: true,
        schedule: true,
      },
    }),
    prisma.contact.findMany({
      select: {
        id: true,
        name: true,
        directoryLabel: true,
        directoryList: true,
        isDayOfContact: true,
        phone: true,
        email: true,
        personId: true,
      },
    }),
    prisma.person.findMany({
      select: { id: true, name: true, directoryLabel: true, isDayOfContact: true },
    }),
    prisma.playbookItem
      .findMany({
        select: {
          id: true,
          sourceKey: true,
          kind: true,
          section: true,
          startAt: true,
          title: true,
          detail: true,
          location: true,
          notes: true,
          sortOrder: true,
          completed: true,
        },
      })
      .catch(() => [] as PlaybookSnapshot[]),
    prisma.task.findMany({
      select: { id: true, title: true, orgKey: true, status: true, parentId: true },
    }),
    prisma.dayAssignment.findMany({
      select: { id: true, title: true, notes: true },
    }),
  ]);
  return {
    coupleNames: settings.coupleNames,
    weddingDateIso: settings.weddingDate.toISOString(),
    timezone: settings.timezone,
    timeline: timeline as TimelineSnapshot[],
    contacts: contacts as ContactSnapshot[],
    people: people as PersonSnapshot[],
    playbook: playbook as PlaybookSnapshot[],
    tasks: tasks as TaskSnapshot[],
    assignments: assignments as AssignmentSnapshot[],
  };
}

function pgDumpBin(): string {
  const candidates = [
    "/usr/lib/postgresql/17/bin/pg_dump",
    "/usr/lib/postgresql/18/bin/pg_dump",
    "pg_dump",
  ];
  for (const bin of candidates) {
    try {
      const out = execFileSync(bin, ["--version"], { encoding: "utf8" });
      const major = Number.parseInt((out.match(/(\d+)\./) ?? [])[1] ?? "0", 10);
      if (major >= 17) return bin;
    } catch {
      /* try next */
    }
  }
  throw new Error("Need pg_dump 17+ to backup Neon 17. Install postgresql-client-17.");
}

function dumpDatabase(label: string): { path: string; sha256: string } {
  const dir = "/tmp/weddingsquirrels-backups";
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(dir, `weddingsquirrels-${label}-${stamp}.dump`);
  const bin = pgDumpBin();
  execFileSync(bin, ["-Fc", "--no-owner", "--no-acl", "-f", file], {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  const sha256 = createHash("sha256").update(readFileSync(file)).digest("hex");
  writeFileSync(`${file}.sha256`, `${sha256}  ${path.basename(file)}\n`);
  try {
    mkdirSync("/opt/cursor/artifacts", { recursive: true });
    writeFileSync(
      "/opt/cursor/artifacts/production-backup-sha256.txt",
      `${sha256}  ${file}\n`,
    );
  } catch {
    /* artifacts mount is optional */
  }
  return { path: file, sha256 };
}

function printPlan(label: string, plan: WeddingOpsPlan, extraInserts = 0) {
  const counts = planWriteCounts(plan);
  console.log(`\n${label}`);
  console.log(
    `  inserts=${counts.inserts + extraInserts} updates=${counts.updates} skips=${counts.skips} conflicts=${counts.conflicts} deletes=${counts.deletes}`,
  );
  for (const row of plan.timelineInserts) {
    console.log(`  TIMELINE INSERT ${row.row.seedKey}`);
  }
  for (const row of plan.timelineUpdates) {
    console.log(`  TIMELINE UPDATE ${row.seedKey} id=${row.id}`);
  }
  for (const row of plan.contactUpdates) {
    console.log(`  CONTACT UPDATE ${row.id} fields=${Object.keys(row.to).join(",")}`);
  }
  for (const row of plan.personUpdates) {
    console.log(`  PERSON UPDATE ${row.id} fields=${Object.keys(row.to).join(",")}`);
  }
  for (const row of plan.playbookInserts) {
    console.log(`  PLAYBOOK INSERT ${row.row.sourceKey}`);
  }
  for (const row of plan.playbookUpdates) {
    console.log(`  PLAYBOOK UPDATE ${row.sourceKey} id=${row.id}`);
  }
  for (const row of plan.taskInserts) {
    console.log(`  TASK INSERT ${row.row.orgKey} ${row.row.title}`);
  }
  for (const row of plan.assignmentUpdates) {
    console.log(`  ASSIGNMENT UPDATE ${row.id}`);
  }
  for (const row of plan.skips) {
    console.log(`  SKIP ${row.identity}: ${row.reason}`);
  }
  for (const row of plan.conflicts) {
    console.log(`  CONFLICT ${row.identity}: ${row.reason}`);
  }
  console.log("  DELETES: none");
}

async function applyPlan(
  prisma: PrismaClient,
  plan: WeddingOpsPlan,
  localTimelineInserts: Array<{
    seedKey: string;
    schedule: string;
    startAt: string;
    endAt: string | null;
    notes: string;
    sortOrder: number;
    startMinutes: number | null;
    endMinutes: number | null;
    dayOffset: number;
  }>,
) {
  if (plan.deletes.length) throw new Error("Refusing to apply a plan that contains deletes");
  await prisma.$transaction(async (tx) => {
    for (const row of localTimelineInserts) {
      await tx.timelineBlock.create({ data: row });
    }
    for (const row of plan.timelineUpdates) {
      await tx.timelineBlock.update({
        where: { id: row.id },
        data: { notes: row.to.notes as string },
      });
    }
    for (const row of plan.contactUpdates) {
      await tx.contact.update({
        where: { id: row.id },
        data: row.to,
      });
    }
    for (const row of plan.personUpdates) {
      await tx.person.update({
        where: { id: row.id },
        data: row.to,
      });
    }
    for (const row of plan.playbookInserts) {
      await tx.playbookItem.create({
        data: {
          sourceKey: row.row.sourceKey,
          kind: row.row.kind,
          section: row.row.section,
          startAt: row.row.startAt,
          title: row.row.title,
          detail: row.row.detail,
          location: row.row.location,
          notes: row.row.notes,
          sortOrder: row.row.sortOrder,
          completed: false,
        },
      });
    }
    for (const row of plan.playbookUpdates) {
      await tx.playbookItem.update({
        where: { id: row.id },
        data: {
          kind: row.to.kind as string,
          section: row.to.section as string,
          startAt: (row.to.startAt as string | null | undefined) ?? undefined,
          title: row.to.title as string,
          detail: (row.to.detail as string | null | undefined) ?? undefined,
          location: (row.to.location as string | null | undefined) ?? undefined,
          notes: (row.to.notes as string | null | undefined) ?? undefined,
          sortOrder: row.to.sortOrder as number,
        },
      });
    }
    const lastSort = (
      await tx.task.aggregate({ _max: { sortOrder: true }, where: { parentId: null } })
    )._max.sortOrder ?? -1;
    let sort = lastSort;
    for (const row of plan.taskInserts) {
      sort += 1;
      await tx.task.create({
        data: {
          title: row.row.title,
          summary: row.row.summary,
          planNotes: row.row.planNotes,
          status: "todo",
          orgKey: row.row.orgKey,
          sortOrder: sort,
          amountSpent: 0,
        },
      });
    }
    for (const row of plan.assignmentUpdates) {
      await tx.dayAssignment.update({
        where: { id: row.id },
        data: { notes: row.to.notes as string },
      });
    }
  });
}

function localMissingWeddingInserts(snapshot: WeddingOpsSnapshot) {
  const existing = snapshot.timeline.filter((row) => row.schedule === "wedding");
  if (existing.length > 0) return [];
  const selected = CANDIDATE_WEDDING_TIMELINE.map((row) => row.seedKey);
  const plan = planCandidateWeddingImport(
    snapshot.timeline.map((row) => ({
      id: row.id,
      seedKey: row.seedKey,
      startAt: row.startAt,
      endAt: row.endAt,
      notes: row.notes,
      sortOrder: row.sortOrder,
      schedule: row.schedule,
    })),
    selected,
  );
  return plan.inserts.map((row) => ({
    ...row,
    ...parsedTimeFields(row.startAt, row.endAt),
  }));
}

function previewSnapshotWithLocalInserts(
  snapshot: WeddingOpsSnapshot,
  inserts: ReturnType<typeof localMissingWeddingInserts>,
): WeddingOpsSnapshot {
  if (!inserts.length) return snapshot;
  return {
    ...snapshot,
    timeline: [
      ...snapshot.timeline,
      ...inserts.map((row) => ({
        id: `pending-${row.seedKey}`,
        seedKey: row.seedKey,
        startAt: row.startAt,
        endAt: row.endAt,
        notes: row.notes,
        sortOrder: row.sortOrder,
        schedule: "wedding",
      })),
    ],
  };
}

function writeDryRunArtifact(payload: unknown) {
  try {
    mkdirSync("/opt/cursor/artifacts", { recursive: true });
    writeFileSync(
      "/opt/cursor/artifacts/wedding-ops-dry-run.json",
      `${JSON.stringify(payload, null, 2)}\n`,
    );
  } catch {
    /* artifacts mount is optional */
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const local = process.argv.includes("--local");
  const { url, host } = local ? localConnectionUrl() : neonConnectionUrl();
  process.env.DATABASE_URL = url;
  const database = process.env.PGDATABASE?.trim() || parseDatabaseTarget(url)?.database || "";
  if (!local) assertKnownProductionHost(host, database || "neondb");

  const prisma = clientFor(url);
  try {
    await ensurePlaybookTable(prisma);
    const before = await loadSnapshot(prisma);
    const identityError = productionWeddingIdentityError(before);
    if (identityError) {
      console.error(`STOP: ${identityError}`);
      process.exit(1);
    }

    const localInserts = local ? localMissingWeddingInserts(before) : [];
    if (!local && localInserts.length) {
      throw new Error("Production path attempted a timeline insert");
    }

    const planned = planWeddingOpsUpdate(previewSnapshotWithLocalInserts(before, localInserts));
    const beforeCounts = await tableCounts(prisma);
    const beforeIds = {
      timeline: before.timeline.map((row) => row.id).sort(),
      people: before.people.map((row) => row.id).sort(),
      contacts: before.contacts.map((row) => row.id).sort(),
      tasks: before.tasks.map((row) => row.id).sort(),
      playbook: before.playbook.map((row) => row.id).sort(),
      assignments: before.assignments.map((row) => row.id).sort(),
    };

    console.log("A. Target identity");
    console.log(`  host=${host}`);
    console.log(`  database=${database || (local ? "local" : "neondb")}`);
    console.log(`  couple=${before.coupleNames}`);
    console.log(`  weddingDate=${before.weddingDateIso}`);
    console.log(`  timezone=${before.timezone}`);
    console.log("  table counts", beforeCounts);
    if (localInserts.length) {
      console.log(`  LOCAL-ONLY timeline inserts=${localInserts.length} (empty wedding schedule)`);
    }

    printPlan("DRY-RUN PLAN", planned, localInserts.length);
    writeDryRunArtifact({
      host,
      database,
      identity: {
        coupleNames: before.coupleNames,
        weddingDateIso: before.weddingDateIso,
        timezone: before.timezone,
      },
      localTimelineInserts: localInserts.map((row) => row.seedKey),
      counts: planWriteCounts(planned),
      timelineUpdates: planned.timelineUpdates.map((row) => ({ id: row.id, seedKey: row.seedKey })),
      contactUpdates: planned.contactUpdates.map((row) => ({ id: row.id, fields: Object.keys(row.to) })),
      personUpdates: planned.personUpdates.map((row) => ({ id: row.id, fields: Object.keys(row.to) })),
      playbookInserts: planned.playbookInserts.map((row) => row.row.sourceKey),
      playbookUpdates: planned.playbookUpdates.map((row) => row.sourceKey),
      taskInserts: planned.taskInserts.map((row) => row.row.orgKey),
      assignmentUpdates: planned.assignmentUpdates.map((row) => row.id),
      skips: planned.skips,
      conflicts: planned.conflicts,
      deletes: [],
    });

    if (!apply) {
      console.log("\nDry-run only. Pass --apply to backup and write one transaction.");
      console.log("Zero deletes. No seed/reset/migrate for wedding content.");
      return;
    }

    console.log("\nB. Taking backup…");
    const backup = dumpDatabase(local ? "local-pre-wedding-ops" : "production-pre-wedding-ops");
    console.log(`  path=${backup.path}`);
    console.log(`  sha256=${backup.sha256}`);

    if (localInserts.length) {
      await applyPlan(prisma, emptyWeddingOpsPlan(), localInserts);
      const afterInserts = await loadSnapshot(prisma);
      const livePlan = planWeddingOpsUpdate(afterInserts);
      await applyPlan(prisma, livePlan, []);
    } else {
      await applyPlan(prisma, planned, []);
    }

    const after = await loadSnapshot(prisma);
    const afterPlan = planWeddingOpsUpdate(after);
    const afterCounts = await tableCounts(prisma);

    const missing = (beforeList: string[], afterList: string[]) =>
      beforeList.filter((id) => !afterList.includes(id));
    const deleted = {
      timeline: missing(beforeIds.timeline, after.timeline.map((row) => row.id)),
      people: missing(beforeIds.people, after.people.map((row) => row.id)),
      contacts: missing(beforeIds.contacts, after.contacts.map((row) => row.id)),
      tasks: missing(beforeIds.tasks, after.tasks.map((row) => row.id)),
      playbook: missing(beforeIds.playbook, after.playbook.map((row) => row.id)),
      assignments: missing(beforeIds.assignments, after.assignments.map((row) => row.id)),
    };
    const deletedAny = Object.values(deleted).some((rows) => rows.length > 0);
    if (deletedAny) {
      console.error("STOP after write: IDs deleted", deleted);
      process.exit(1);
    }

    console.log("\nPOST-WRITE");
    console.log("  table counts", afterCounts);
    printPlan("AFTER PLAN (idempotent reuse expected)", afterPlan);
    console.log("K. Zero deletes: existing IDs preserved.");
    console.log("L. No seed/reset/migration of wedding content ran.");
    if (afterPlan.playbookInserts.length || afterPlan.timelineUpdates.length) {
      console.error("STOP: second-pass planner still wants writes; not idempotent");
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
