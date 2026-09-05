/**
 * Confirmed Day-of identity/contact writes. Exact ids only.
 *
 * Default is dry-run.
 *
 *   npx tsx scripts/apply-day-of-confirmed.ts
 *   npx tsx scripts/apply-day-of-confirmed.ts --apply
 *
 * Does not touch TimelineBlock, DayAssignmentAssignee, Person, Budget, or AppSettings.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import {
  APPROVED_PIN_LINKS,
  inspectKurtPresence,
  planApprovedContactFlags,
  planApprovedPinLinks,
  planKurtMcWrite,
  plannedAssignmentAssignees,
  wendyIsLabeledMc,
  type ContactSnapshot,
  type PinAccountSnapshot,
} from "../src/lib/day-of-confirmed";
import { isNeonDatabaseUrl } from "../src/lib/db";

function clientFor(url: string) {
  if (isNeonDatabaseUrl(url)) {
    return new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
  }
  return new PrismaClient();
}

function neonUrl(): string {
  const explicit = process.env.NEON_DATABASE_URL?.trim();
  if (explicit && isNeonDatabaseUrl(explicit)) return explicit;
  const fallback = process.env.DATABASE_URL?.trim() ?? "";
  if (isNeonDatabaseUrl(fallback)) return fallback;
  throw new Error("This script requires production Neon (NEON_DATABASE_URL or Neon DATABASE_URL).");
}

async function snapshot(prisma: PrismaClient) {
  const [accounts, contacts, people, assignments] = await Promise.all([
    prisma.pinAccount.findMany({
      select: { id: true, name: true, linkedPersonId: true },
    }),
    prisma.contact.findMany({
      select: {
        id: true,
        name: true,
        directoryLabel: true,
        isDayOfContact: true,
        sortOrder: true,
        phone: true,
        email: true,
      },
    }),
    prisma.person.findMany({ select: { id: true } }),
    prisma.dayAssignmentAssignee.findMany({ select: { assignmentId: true, personId: true } }),
  ]);
  return {
    accounts: accounts as PinAccountSnapshot[],
    contacts: contacts.map((row): ContactSnapshot => ({
      id: row.id,
      name: row.name,
      directoryLabel: row.directoryLabel,
      isDayOfContact: row.isDayOfContact,
      sortOrder: row.sortOrder,
      hasPhone: Boolean(row.phone?.trim()),
      hasEmail: Boolean(row.email?.trim()),
    })),
    personIds: people.map((row) => row.id),
    assignees: assignments,
  };
}

function printPinSnapshot(label: string, accounts: PinAccountSnapshot[]) {
  console.log(`${label} PinAccount linkedPersonId`);
  for (const approval of APPROVED_PIN_LINKS) {
    const row = accounts.find((account) => account.id === approval.pinAccountId);
    console.log(`  ${approval.pinAccountId} ${row?.name ?? "MISSING"} → ${row?.linkedPersonId ?? "(null)"}`);
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const url = neonUrl();
  const prisma = clientFor(url);
  try {
    const before = await snapshot(prisma);
    printPinSnapshot("BEFORE", before.accounts);
    console.log("BEFORE Contact flags");
    for (const row of before.contacts) {
      console.log(
        `  ${row.id} ${row.name} dayOf=${row.isDayOfContact} sort=${row.sortOrder} channel=${row.hasPhone || row.hasEmail}`,
      );
    }

    const pinPlan = planApprovedPinLinks(before.accounts);
    const contactPlan = planApprovedContactFlags(before.contacts);
    if (pinPlan.mismatches.length || contactPlan.mismatches.length) {
      console.error("SNAPSHOT MISMATCH — no writes");
      for (const line of [...pinPlan.mismatches, ...contactPlan.mismatches]) console.error(`  ${line}`);
      process.exit(1);
    }

    const kurt = inspectKurtPresence({
      contacts: before.contacts,
      personIds: before.personIds,
    });
    const kurtPlan = planKurtMcWrite(kurt);
    console.log(`KURT contact=${kurt.contact?.id ?? "none"} person=${kurt.personId ?? "none"}`);
    console.log(`KURT write: ${kurtPlan.reason}`);
    console.log(`WENDY labeled MC: ${wendyIsLabeledMc(before.contacts)}`);
    console.log(`ASSIGNEE writes planned: ${plannedAssignmentAssignees().length}`);
    console.log(`Existing DayAssignmentAssignee rows: ${before.assignees.length}`);

    if (!apply) {
      console.log("Dry-run. Pass --apply to write approved PIN links and Contact flags.");
      console.log(`Would update ${pinPlan.updates.length} PinAccount(s) and ${contactPlan.updates.length} Contact(s).`);
      return;
    }

    for (const update of pinPlan.updates) {
      await prisma.pinAccount.update({
        where: { id: update.pinAccountId },
        data: { linkedPersonId: update.personId },
      });
    }
    for (const update of contactPlan.updates) {
      await prisma.contact.update({
        where: { id: update.contactId },
        data: { isDayOfContact: update.isDayOfContact },
      });
    }

    const after = await snapshot(prisma);
    printPinSnapshot("AFTER", after.accounts);
    console.log("AFTER Contact flags");
    for (const row of after.contacts) {
      console.log(`  ${row.id} ${row.name} dayOf=${row.isDayOfContact} sort=${row.sortOrder}`);
    }
    const verify = planApprovedPinLinks(after.accounts);
    const verifyContacts = planApprovedContactFlags(after.contacts);
    if (verify.updates.length || verify.mismatches.length || verifyContacts.updates.length || verifyContacts.mismatches.length) {
      console.error("AFTER verification failed");
      process.exit(1);
    }
    if (after.assignees.length !== before.assignees.length) {
      console.error("Assignment assignees changed — unexpected");
      process.exit(1);
    }
    console.log("CONFIRMED DAY-OF WRITES APPLIED");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
