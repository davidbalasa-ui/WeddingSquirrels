/**
 * Surgical, idempotent curated open-work update for known production Neon.
 *
 * Default is dry-run (read + plan only).
 *
 *   npx tsx scripts/apply-curated-open-work.ts
 *   npx tsx scripts/apply-curated-open-work.ts --apply
 *
 * Connection: NEON_DATABASE_URL, or PGHOST+PGUSER+PGPASSWORD+PGDATABASE.
 * Local DATABASE_URL is refused. Never seeds, resets, truncates, or deletes.
 *
 * Do not persist production credentials in .env, git, or artifacts.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import {
  actionableOpenCount,
  DAY_BEFORE_STEPS,
  planCuratedOpenWork,
  planOpenCount,
  plannedInsertCounts,
  productionWeddingIdentityError,
  todayPulseOpenCount,
  titlesMatch,
  WEEK_BEFORE_STEPS,
  type ContactSnapshot,
  type PersonSnapshot,
  type TaskSnapshot,
  type WeddingSnapshot,
} from "../src/lib/curated-open-work";
import {
  isProtectedProductionTarget,
  parseDatabaseTarget,
  PROTECTED_PRODUCTION_ENDPOINT_ID,
} from "../src/lib/seed-safety";

const WEEK_BEFORE_ID_HINT = "week_before";
const DAY_BEFORE_ID_HINT = "day_before";

function isNeonHost(host: string): boolean {
  const hostname = host.toLowerCase();
  return hostname === "neon.tech" || hostname.endsWith(".neon.tech");
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
    "No production Neon credentials. Set NEON_DATABASE_URL or PGHOST/PGUSER/PGPASSWORD/PGDATABASE. Local DATABASE_URL is refused.",
  );
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

async function tableCounts(prisma: PrismaClient): Promise<Record<string, number>> {
  const [
    Person,
    Guest,
    GuestPerson,
    BudgetItem,
    BudgetPayment,
    TimelineBlock,
    Contact,
    PinAccount,
    ShoppingItem,
    Task,
    TaskAssignee,
    StaySlot,
    MealGuest,
    CalendarEvent,
    DayAssignment,
    BudgetFundingSource,
    Request,
  ] = await Promise.all([
    prisma.person.count(),
    prisma.guest.count(),
    prisma.guestPerson.count(),
    prisma.budgetItem.count(),
    prisma.budgetPayment.count(),
    prisma.timelineBlock.count(),
    prisma.contact.count(),
    prisma.pinAccount.count(),
    prisma.shoppingItem.count(),
    prisma.task.count(),
    prisma.taskAssignee.count(),
    prisma.staySlot.count(),
    prisma.mealGuest.count(),
    prisma.calendarEvent.count(),
    prisma.dayAssignment.count(),
    prisma.budgetFundingSource.count(),
    prisma.request.count(),
  ]);
  return {
    Person,
    Guest,
    GuestPerson,
    BudgetItem,
    BudgetPayment,
    TimelineBlock,
    Contact,
    PinAccount,
    ShoppingItem,
    Task,
    TaskAssignee,
    StaySlot,
    MealGuest,
    CalendarEvent,
    DayAssignment,
    BudgetFundingSource,
    Request,
  };
}

async function loadSnapshot(prisma: PrismaClient): Promise<WeddingSnapshot & { settingsId: number }> {
  const [settings, tasks, people, contacts, stay, budgetItems] = await Promise.all([
    prisma.appSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.task.findMany({
      select: {
        id: true,
        title: true,
        summary: true,
        planNotes: true,
        status: true,
        dueDate: true,
        sourceRow: true,
        parentId: true,
        orgKey: true,
        budgetItemId: true,
        sortOrder: true,
      },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    }),
    prisma.person.findMany({
      select: { id: true, name: true, isDayOfContact: true },
    }),
    prisma.contact.findMany({
      select: {
        id: true,
        name: true,
        personId: true,
        isDayOfContact: true,
        phone: true,
        email: true,
      },
    }),
    prisma.staySlot.findMany({
      select: { id: true, label: true, occupant: true, optional: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.budgetItem.findMany({ select: { id: true, name: true } }),
  ]);
  return {
    settingsId: settings.id,
    coupleNames: settings.coupleNames,
    weddingDate: settings.weddingDate,
    timezone: settings.timezone,
    tasks: tasks as TaskSnapshot[],
    people: people as PersonSnapshot[],
    contacts: contacts as ContactSnapshot[],
    stay,
    budgetItems,
  };
}

function orgTreeOk(tasks: TaskSnapshot[]): string[] {
  const errors: string[] = [];
  const week = tasks.find((task) => task.orgKey === WEEK_BEFORE_ID_HINT);
  const day = tasks.find((task) => task.orgKey === DAY_BEFORE_ID_HINT);
  if (!week) errors.push("Missing Week before org-card");
  if (!day) errors.push("Missing Day before org-card");
  if (week) {
    const kids = tasks.filter((task) => task.parentId === week.id);
    for (const title of WEEK_BEFORE_STEPS) {
      if (!kids.some((kid) => kid.title === title || titlesMatch(kid.title, title))) {
        errors.push(`Missing Week-before step: ${title}`);
      }
    }
  }
  if (day) {
    const kids = tasks.filter((task) => task.parentId === day.id);
    for (const title of DAY_BEFORE_STEPS) {
      if (!kids.some((kid) => kid.title === title || titlesMatch(kid.title, title))) {
        errors.push(`Missing Day-before step: ${title}`);
      }
    }
  }
  return errors;
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

function dumpProduction(): { path: string; sha256: string } {
  // Custom-format pg_dump seeks the archive file. The Cursor artifacts
  // mount does not support that, so the backup lives on local disk.
  const dir = "/tmp/weddingsquirrels-backups";
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(dir, `weddingsquirrels-production-pre-curated-open-work-${stamp}.dump`);
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

function printPlan(label: string, snapshot: WeddingSnapshot) {
  const plan = planCuratedOpenWork(snapshot);
  const inserts = plannedInsertCounts(plan);
  console.log(`\n${label}`);
  console.log(`  packages insert=${inserts.packages} reuse=${plan.packages.filter((p) => p.action === "reuse").length}`);
  console.log(`  steps insert=${inserts.steps} reuse=${plan.packages.reduce((n, p) => n + p.steps.filter((s) => s.action === "reuse").length, 0)}`);
  for (const pkg of plan.packages) {
    console.log(`  PACKAGE ${pkg.action.toUpperCase()} ${pkg.title}${pkg.existingId ? ` (${pkg.existingId})` : ""}`);
    for (const step of pkg.steps) {
      const link = step.budgetItemId ? ` link=${step.budgetItemId}` : step.skipLinkReason ? ` skip-link=${step.skipLinkReason}` : "";
      console.log(`    STEP ${step.action.toUpperCase()} ${step.title}${step.existingId ? ` (${step.existingId})` : ""}${link}`);
    }
  }
  console.log("  skipped:");
  for (const row of plan.skipped) console.log(`    - ${row.item}: ${row.reason}`);
  console.log(
    `  stay required ${plan.stay.assignedRequired}/${plan.stay.totalRequired} remaining=${plan.stay.remainingRequired} optionalEmpty=${plan.stay.optionalEmpty}`,
  );
  console.log(
    `  stay names trinity=${plan.stay.preservedNames.trinity} bri=${plan.stay.preservedNames.bri} skila=${plan.stay.preservedNames.skila}`,
  );
  console.log(`  kurt person=${plan.kurt.personId ?? "none"} contact=${plan.kurt.contactId ?? "none"} channel=${plan.kurt.hasChannel}`);
  for (const row of plan.personFlags) console.log(`  PERSON FLAG ${row.name} ${row.id} dayOf ${row.from}→true`);
  for (const row of plan.contactFlags) console.log(`  CONTACT FLAG ${row.name} ${row.id} dayOf ${row.from}→true`);
  return plan;
}

async function applyPlan(prisma: PrismaClient, snapshot: WeddingSnapshot) {
  const plan = planCuratedOpenWork(snapshot);
  const lastParent = snapshot.tasks
    .filter((task) => task.parentId === null)
    .reduce((max, task) => Math.max(max, task.sortOrder), -1);

  await prisma.$transaction(async (tx) => {
    let parentSort = Math.max(lastParent, -1);
    for (const pkg of plan.packages) {
      let parentId = pkg.existingId;
      if (pkg.action === "insert") {
        parentSort += 1;
        const created = await tx.task.create({
          data: {
            title: pkg.title,
            summary: pkg.summary,
            planNotes: pkg.planNotes ?? "",
            status: "todo",
            dueDate: null,
            sourceRow: null,
            orgKey: null,
            sortOrder: parentSort,
            amountSpent: 0,
          },
        });
        parentId = created.id;
      } else if (pkg.existingId && (pkg.summary || pkg.planNotes)) {
        const current = snapshot.tasks.find((task) => task.id === pkg.existingId);
        const data: { summary?: string; planNotes?: string } = {};
        if (pkg.summary && !current?.summary?.trim()) data.summary = pkg.summary;
        if (pkg.planNotes && !current?.planNotes?.trim()) data.planNotes = pkg.planNotes;
        if (Object.keys(data).length) {
          await tx.task.update({ where: { id: pkg.existingId }, data });
        }
      }
      if (!parentId) throw new Error(`Missing parent id for ${pkg.title}`);

      let stepSort = snapshot.tasks.filter((task) => task.parentId === parentId).reduce((max, task) => Math.max(max, task.sortOrder), -1);
      for (const step of pkg.steps) {
        if (step.action === "reuse") {
          if (!step.existingId) continue;
          const current = snapshot.tasks.find((task) => task.id === step.existingId);
          const data: { planNotes?: string; budgetItemId?: string } = {};
          if (step.planNotes && !current?.planNotes?.trim()) data.planNotes = step.planNotes;
          if (step.budgetItemId && !current?.budgetItemId) data.budgetItemId = step.budgetItemId;
          if (Object.keys(data).length) {
            await tx.task.update({ where: { id: step.existingId }, data });
          }
          continue;
        }
        stepSort += 1;
        await tx.task.create({
          data: {
            title: step.title,
            summary: step.summary ?? "",
            planNotes: step.planNotes ?? "",
            status: "todo",
            dueDate: null,
            sourceRow: null,
            parentId,
            sortOrder: stepSort,
            amountSpent: 0,
            budgetItemId: step.budgetItemId ?? null,
          },
        });
      }
    }

    for (const row of plan.personFlags) {
      await tx.person.update({ where: { id: row.id }, data: { isDayOfContact: true } });
    }
    for (const row of plan.contactFlags) {
      await tx.contact.update({ where: { id: row.id }, data: { isDayOfContact: true } });
    }
  });

  return plan;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const { url, host } = neonConnectionUrl();
  process.env.DATABASE_URL = url;
  const database = process.env.PGDATABASE?.trim() || parseDatabaseTarget(url)?.database || "";
  assertKnownProductionHost(host, database || "neondb");

  const prisma = clientFor(url);
  try {
    const before = await loadSnapshot(prisma);
    const identityError = productionWeddingIdentityError(before);
    if (identityError) {
      console.error(`STOP: ${identityError}`);
      process.exit(1);
    }
    const orgErrors = orgTreeOk(before.tasks);
    if (orgErrors.length) {
      console.error("STOP: Week-before / Day-before tree is not the expected org-card structure");
      for (const line of orgErrors) console.error(`  ${line}`);
      process.exit(1);
    }

    const beforeCounts = await tableCounts(prisma);
    const beforeIds = before.tasks.map((task) => task.id).sort();
    const beforeStay = before.stay.map((row) => ({ id: row.id, occupant: row.occupant, optional: row.optional }));
    const beforePeople = before.people.length;
    const beforeContacts = before.contacts.length;

    console.log("A. Production identity");
    console.log(`  host=${host}`);
    console.log(`  database=${database || "neondb"}`);
    console.log(`  couple=${before.coupleNames}`);
    console.log(`  weddingDate=${before.weddingDate.toISOString?.() ?? before.weddingDate}`);
    console.log(`  timezone=${before.timezone}`);
    console.log("  table counts", beforeCounts);
    console.log(`C. Pre-write Task count=${before.tasks.length}`);
    console.log(`D. Org-card tree intact. Extra top-level: ${before.tasks.filter((t) => !t.parentId && !t.orgKey).map((t) => t.title).join(" | ") || "(none)"}`);
    console.log(`  planOpen=${planOpenCount(before.tasks)} todayPulse=${todayPulseOpenCount(before.tasks)} actionable=${actionableOpenCount(before.tasks)}`);

    const planned = printPlan("DRY-RUN PLAN", before);

    if (!apply) {
      console.log("\nDry-run only. Pass --apply to backup and write one transaction.");
      return;
    }

    console.log("\nB. Taking production backup…");
    const backup = dumpProduction();
    console.log(`  path=${backup.path}`);
    console.log(`  sha256=${backup.sha256}`);

    await applyPlan(prisma, before);

    const after = await loadSnapshot(prisma);
    const afterCounts = await tableCounts(prisma);
    const afterIds = after.tasks.map((task) => task.id);
    const missingIds = beforeIds.filter((id) => !afterIds.includes(id));
    if (missingIds.length) {
      console.error("STOP after write: Task IDs deleted", missingIds);
      process.exit(1);
    }
    const orgAfter = orgTreeOk(after.tasks);
    if (orgAfter.length) {
      console.error("STOP after write: org-card tree changed", orgAfter);
      process.exit(1);
    }
    for (const row of beforeStay) {
      const now = after.stay.find((slot) => slot.id === row.id);
      if (!now || now.occupant !== row.occupant || now.optional !== row.optional) {
        console.error("STOP after write: StaySlot changed", row.id);
        process.exit(1);
      }
    }
    if (after.people.length < beforePeople || after.contacts.length < beforeContacts) {
      console.error("STOP after write: Person/Contact rows decreased");
      process.exit(1);
    }
    if (afterCounts.Task < beforeCounts.Task) {
      console.error("STOP after write: Task count decreased");
      process.exit(1);
    }

    const inserted = after.tasks.filter((task) => !beforeIds.includes(task.id));
    console.log("\nPOST-WRITE");
    console.log(`I. Task count ${before.tasks.length} → ${after.tasks.length} (inserted ${inserted.length})`);
    console.log(`J. planOpen=${planOpenCount(after.tasks)} todayPulse=${todayPulseOpenCount(after.tasks)} actionable=${actionableOpenCount(after.tasks)}`);
    console.log("K. Zero deletes: existing Task IDs preserved, Stay occupants unchanged, no truncates.");
    console.log("L. No seed/reset/migration ran.");
    console.log("M. Count rules: /plan and /plan/tasks count top-level packages + org-card parents; /today pulse counts top-level non-org packages only. Children are not double-counted.");
    printPlan("AFTER PLAN (idempotent reuse expected)", after);

    for (const pkg of planned.packages.filter((row) => row.action === "insert")) {
      const found = after.tasks.find((task) => !task.parentId && task.title === pkg.title);
      console.log(`  workspace ${pkg.title} → /work/${found?.id ?? "MISSING"}`);
    }
    console.log("  source-return on /work/{id} remains Back to Today (current app behavior).");
    console.log("O. Unresolved manual data:");
    if (!planned.kurt.hasChannel) console.log("  - Kurt's phone/email still missing; Person day-of flag set if Person existed; no Contact invented.");
    const dish = planned.packages.flatMap((p) => p.steps).find((s) => s.key === "drinks-dishware");
    if (dish?.skipLinkReason) console.log(`  - Dishware BudgetItem link skipped: ${dish.skipLinkReason}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
