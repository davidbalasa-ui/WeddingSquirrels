import type { EnrichmentSnapshot } from "@/lib/contact-enrichment";
import type { prisma } from "@/lib/db";

/**
 * David, 2026-10-13 20:29: "kurthuizenga@yahoo.com - Kurt / Wrush2021@gmail.com - Wendy /
 * lpelf@comcast.net - Lisa Pelfresne".
 *
 * Each email fills only an empty email on the person's saved contact; one David typed stays.
 * `earlierName` is the name the app first saved the contact under, renamed only while it still reads exactly that.
 * Kurt is saved as a person with no contact row, so his contact is made, linked to him.
 */
export type ContactEmail = { name: string; email: string; role: string; earlierName?: string };

export const CONTACT_EMAILS: ContactEmail[] = [
  { name: "Kurt Huizenga", email: "kurthuizenga@yahoo.com", role: "MC" },
  { name: "Wendy Rush", email: "Wrush2021@gmail.com", role: "Mistress of Ceremonies" },
  { name: "Lisa Pelfresne", email: "lpelf@comcast.net", role: "Helper", earlierName: "Lisa" },
];

const key = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

function names(row: ContactEmail): string[] {
  return [row.name, ...(row.earlierName ? [row.earlierName] : [])].map(key);
}

/** The emails still to fill: the person is saved (or added in the same Apply) and no contact of theirs has an email. */
export function planContactEmails(
  snapshot: Pick<EnrichmentSnapshot, "contacts" | "persons">,
  addingContacts: string[] = [],
): ContactEmail[] {
  const adding = new Set(addingContacts.map(key));
  return CONTACT_EMAILS.filter((row) => {
    const saved = snapshot.contacts.filter((contact) => names(row).includes(key(contact.name)));
    if (saved.some((contact) => contact.email?.trim())) return false;
    if (saved.length) return true;
    if (names(row).some((name) => adding.has(name))) return true;
    return snapshot.persons.some((person) => key(person.name) === key(row.name));
  });
}

/** One email written inside the caller's transaction, after that Apply's new contacts exist. */
export async function writeContactEmail(tx: Pick<typeof prisma, "contact" | "person">, row: ContactEmail): Promise<void> {
  for (const name of names(row)) {
    const saved = await tx.contact.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, orderBy: { sortOrder: "asc" } });
    if (!saved) continue;
    await tx.contact.updateMany({ where: { id: saved.id, OR: [{ email: null }, { email: "" }] }, data: { email: row.email } });
    if (row.earlierName && saved.name === row.earlierName) {
      await tx.contact.updateMany({ where: { id: saved.id, name: row.earlierName }, data: { name: row.name } });
    }
    return;
  }
  const person = await tx.person.findFirst({ where: { name: { equals: row.name, mode: "insensitive" } } });
  if (!person) return;
  const last = await tx.contact.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  await tx.contact.create({
    data: {
      name: person.name,
      personId: person.id,
      email: row.email,
      directoryLabel: person.directoryLabel ?? row.role,
      directoryList: person.directoryList ?? "vendors",
      isDayOfContact: person.isDayOfContact,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
}
