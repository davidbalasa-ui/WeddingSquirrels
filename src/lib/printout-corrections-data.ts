import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { EnrichmentSnapshot } from "@/lib/contact-enrichment";
import { planPhoneCorrections, type PhoneCorrectionRow, type PhoneWrite } from "@/lib/phone-corrections";
import { planDayJobRewords, planDayJobs, type DayJobDef, type DayJobReword } from "@/lib/day-job-corrections";
import { MINI_MOON_CONTACT } from "@/lib/mini-moon";
import { planPlaybookRewords, type PlaybookReword } from "@/lib/playbook-corrections";
import { planTaskCorrections, type TaskCorrectionsPlan } from "@/lib/task-corrections";

export type NewContactRow = { name: string; phone: string; directoryLabel: string };

export type PrintoutCorrectionsPlan = {
  tasks: TaskCorrectionsPlan;
  phones: PhoneCorrectionRow[];
  /** Contacts to add; one already saved under the same name is left as it is. */
  contacts: NewContactRow[];
  /** Day-of jobs written into the schedule that are not on Day-of → Assignments yet. */
  dayJobs: DayJobDef[];
  /** Day-of jobs this card added that still read as it first wrote them, with corrected words. */
  dayJobRewords: DayJobReword[];
  /** Coordinator scope rows the app wrote that still read as it wrote them, with corrected words. */
  playbookRewords: PlaybookReword[];
};

type Db = Prisma.TransactionClient | typeof prisma;

async function loadPeopleSnapshot(db: Db): Promise<EnrichmentSnapshot> {
  const [persons, guestPeople, guests, contacts] = await Promise.all([
    db.person.findMany({ select: { id: true, name: true, directoryList: true, isDayOfContact: true } }),
    db.guestPerson.findMany({
      select: { id: true, name: true, personId: true, rsvpStatus: true, photoData: true, guestId: true },
    }),
    db.guest.findMany({
      select: { id: true, phone: true, street: true, city: true, state: true, zip: true, rsvpStatus: true },
    }),
    db.contact.findMany({
      select: {
        id: true,
        name: true,
        personId: true,
        phone: true,
        email: true,
        photoData: true,
        directoryList: true,
        isDayOfContact: true,
      },
    }),
  ]);
  return { persons, guestPeople, guests, contacts };
}

export async function loadPrintoutCorrectionsPlan(db: Db = prisma): Promise<PrintoutCorrectionsPlan> {
  const [tasks, snapshot, assignments, playbook] = await Promise.all([
    db.task.findMany({ select: { id: true, title: true, status: true, parentId: true, dueDate: true, summary: true } }),
    loadPeopleSnapshot(db),
    db.dayAssignment.findMany({ select: { id: true, title: true, notes: true } }),
    db.playbookItem.findMany({ select: { id: true, sourceKey: true, title: true, notes: true } }),
  ]);
  const contacts = snapshot.contacts.some((row) => /victoria resort/i.test(row.name)) ? [] : [{ ...MINI_MOON_CONTACT }];
  return { tasks: planTaskCorrections(tasks), phones: planPhoneCorrections(snapshot), contacts, dayJobs: planDayJobs(assignments), dayJobRewords: planDayJobRewords(assignments), playbookRewords: planPlaybookRewords(playbook) };
}

/** One phone write, inside the caller's transaction. Only ever fills or (on David's pick) replaces one number. */
export async function writePhone(
  tx: Pick<typeof prisma, "contact" | "guest">,
  write: PhoneWrite,
): Promise<void> {
  if (write.kind === "contact") {
    await tx.contact.update({ where: { id: write.contactId }, data: { phone: write.phone } });
  } else if (write.kind === "guest") {
    await tx.guest.updateMany({ where: { id: write.guestId, OR: [{ phone: null }, { phone: "" }] }, data: { phone: write.phone } });
  } else {
    const last = await tx.contact.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    await tx.contact.create({
      data: {
        name: write.name,
        personId: write.personId,
        phone: write.phone,
        email: null,
        directoryList: "guests",
        isDayOfContact: false,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
  }
}

/** Adds one contact at the end of the vendors list, inside the caller's transaction. */
export async function addContact(tx: Pick<typeof prisma, "contact">, row: NewContactRow): Promise<void> {
  if (await tx.contact.findFirst({ where: { name: { equals: row.name, mode: "insensitive" } } })) return;
  const last = await tx.contact.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  await tx.contact.create({
    data: {
      name: row.name,
      phone: row.phone,
      directoryLabel: row.directoryLabel,
      directoryList: "vendors",
      isDayOfContact: false,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
}
