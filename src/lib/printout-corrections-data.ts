import { prisma } from "@/lib/db";
import type { EnrichmentSnapshot } from "@/lib/contact-enrichment";
import { planPhoneCorrections, type PhoneCorrectionRow, type PhoneWrite } from "@/lib/phone-corrections";
import { planTaskCorrections, type TaskCorrectionsPlan } from "@/lib/task-corrections";

export type PrintoutCorrectionsPlan = { tasks: TaskCorrectionsPlan; phones: PhoneCorrectionRow[] };

async function loadPeopleSnapshot(): Promise<EnrichmentSnapshot> {
  const [persons, guestPeople, guests, contacts] = await Promise.all([
    prisma.person.findMany({ select: { id: true, name: true, directoryList: true, isDayOfContact: true } }),
    prisma.guestPerson.findMany({
      select: { id: true, name: true, personId: true, rsvpStatus: true, photoData: true, guestId: true },
    }),
    prisma.guest.findMany({
      select: { id: true, phone: true, street: true, city: true, state: true, zip: true, rsvpStatus: true },
    }),
    prisma.contact.findMany({
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

export async function loadPrintoutCorrectionsPlan(): Promise<PrintoutCorrectionsPlan> {
  const [tasks, snapshot] = await Promise.all([
    prisma.task.findMany({ select: { id: true, title: true, status: true, parentId: true } }),
    loadPeopleSnapshot(),
  ]);
  return { tasks: planTaskCorrections(tasks), phones: planPhoneCorrections(snapshot) };
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
