import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { EnrichmentSnapshot } from "@/lib/contact-enrichment";
import { planPhoneCorrections, type PhoneCorrectionRow, type PhoneWrite } from "@/lib/phone-corrections";
import { planDayJobRewords, planDayJobs, type DayJobDef, type DayJobReword } from "@/lib/day-job-corrections";
import { planContactEmails, type ContactEmail } from "@/lib/contact-emails";
import { FAMILY_CONTACTS } from "@/lib/family-contacts";
import { BAND_CONTACT, GETAWAY_DRIVER_CONTACT, MINI_MOON_CONTACT } from "@/lib/mini-moon";
import { planPlaybookRewords, type PlaybookReword } from "@/lib/playbook-corrections";
import { checkinCarriesBunksNote, reconciledKeyForRow } from "@/lib/reconciled-timeline";
import { planTaskCorrections, type TaskCorrectionsPlan } from "@/lib/task-corrections";

/** dayOf: a family member or helper David listed, printed with the day-of contacts rather than the vendors. */
/** ledgerName: how the applied-corrections ledger knows this row, when a later number must apply again. */
export type NewContactRow = { name: string; phone: string; directoryLabel: string; dayOf?: boolean; ledgerName?: string };

export type PrintoutCorrectionsPlan = {
  tasks: TaskCorrectionsPlan;
  phones: PhoneCorrectionRow[];
  /** Contacts to add; one already saved under the same name is left as it is. */
  contacts: NewContactRow[];
  /** Emails David gave, filled only where the contact has none. */
  emails: ContactEmail[];
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
  const [tasks, snapshot, assignments, playbook, rehearsal] = await Promise.all([
    db.task.findMany({ select: { id: true, title: true, status: true, parentId: true, dueDate: true, summary: true } }),
    loadPeopleSnapshot(db),
    db.dayAssignment.findMany({ select: { id: true, title: true, notes: true } }),
    db.playbookItem.findMany({ select: { id: true, sourceKey: true, title: true, notes: true } }),
    db.timelineBlock.findMany({ where: { schedule: "rehearsal" }, select: { id: true, seedKey: true, schedule: true, notes: true } }),
  ]);
  // The bunks note goes on Thursday's check-in moment; only a moment David reworded himself sends it to the job.
  // Picked the way the Wedding Day card picks it: a row carrying the key wins over one seeded under it as its id.
  const checkins = rehearsal.filter((row) => reconciledKeyForRow(row) === "reh.checkin");
  const checkin = checkins.find((row) => row.seedKey) ?? checkins[0];
  const bunksOnJob = checkin != null && !checkinCarriesBunksNote(checkin.notes);
  const phones = planPhoneCorrections(snapshot);
  // A contact the phone corrections create in the same Apply (John's, Pam's) is then marked day-of.
  const phoneCreates = new Set(
    phones.flatMap((row) => (row.status === "add" && row.write?.kind === "createContact" ? [row.write.name.trim().toLowerCase()] : [])),
  );
  const contacts = [
    ...(snapshot.contacts.some((row) => /victoria resort/i.test(row.name)) ? [] : [{ ...MINI_MOON_CONTACT }]),
    ...(snapshot.contacts.some((row) => row.name.trim().toLowerCase() === BAND_CONTACT.name.toLowerCase()) ? [] : [{ ...BAND_CONTACT }]),
    // Dan may already be saved with no number; addContact then fills only the empty number.
    ...(snapshot.contacts.some((row) => row.name.trim().toLowerCase() === GETAWAY_DRIVER_CONTACT.name.toLowerCase() && row.phone?.trim())
      ? []
      : [{ ...GETAWAY_DRIVER_CONTACT }]),
    // David, 2026-10-11 15:50: family and helpers on the day-of contact list, with his numbers.
    ...FAMILY_CONTACTS.flatMap((family) => {
      const known = [family.name, ...(family.earlierName ? [family.earlierName] : [])].map((name) => name.toLowerCase());
      const saved = snapshot.contacts.filter((row) => known.includes(row.name.trim().toLowerCase()));
      if (saved.some((row) => row.isDayOfContact && (row.phone?.trim() || !family.phone))) return [];
      // John's and Pam's numbers come through the phone corrections; with none from David, the one on the person's own guest record.
      const phone = family.phone ?? savedGuestPhone(snapshot, family.name) ?? "";
      if (!phone && !saved.length && !phoneCreates.has(family.name.toLowerCase())) return [];
      return [{ name: family.name, phone, directoryLabel: family.role, dayOf: true, ...(family.ledgerName ? { ledgerName: family.ledgerName } : {}) }];
    }),
  ];
  const emails = planContactEmails(snapshot, contacts.map((row) => row.name));
  return { tasks: planTaskCorrections(tasks, { bunksOnJob }), phones, contacts, emails, dayJobs: planDayJobs(assignments), dayJobRewords: planDayJobRewords(assignments), playbookRewords: planPlaybookRewords(playbook) };
}

/**
 * The number on this person's own guest record: one person by that name, alone on the record,
 * so a household number someone else shares (John's) is never printed as hers.
 */
export function savedGuestPhone(snapshot: Pick<EnrichmentSnapshot, "guestPeople" | "guests">, name: string): string | null {
  const people = snapshot.guestPeople.filter((row) => row.name.trim().toLowerCase() === name.toLowerCase());
  if (people.length !== 1) return null;
  const guestId = people[0]!.guestId;
  if (snapshot.guestPeople.filter((row) => row.guestId === guestId).length !== 1) return null;
  return snapshot.guests.find((guest) => guest.id === guestId)?.phone?.trim() || null;
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
  const saved = await tx.contact.findFirst({ where: { name: { equals: row.name, mode: "insensitive" } } });
  if (saved) {
    // A number only where none is saved; one David typed himself stays.
    if (!saved.phone?.trim() && row.phone) await tx.contact.updateMany({ where: { id: saved.id, OR: [{ phone: null }, { phone: "" }] }, data: { phone: row.phone } });
    if (row.dayOf && !saved.isDayOfContact) await tx.contact.update({ where: { id: saved.id }, data: { isDayOfContact: true } });
    return;
  }
  if (!row.phone) return;
  const last = await tx.contact.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  await tx.contact.create({
    data: {
      name: row.name,
      phone: row.phone,
      directoryLabel: row.directoryLabel,
      directoryList: row.dayOf ? "guests" : "vendors",
      isDayOfContact: row.dayOf ?? false,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
}
