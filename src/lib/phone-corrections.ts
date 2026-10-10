/**
 * Phone numbers David sent in chat (2026-10-10), saved only when he taps Apply on
 * Plan → Tasks. Reuses the contact-enrichment planner: a number is added where none
 * is saved, never written over a different one; a different saved number is shown
 * beside the new one for David to pick.
 */
import { planContactEnrichment, type EnrichmentSnapshot } from "./contact-enrichment";

export type PhoneCorrectionDef = {
  /** Name as David wrote it, and the spellings his People list may use for the same person. */
  label: string;
  names: string[];
  phone: string;
};

/** "Pam Balasa phone +12694753751", written the way the app's other numbers are. */
export const PHONE_CORRECTIONS: PhoneCorrectionDef[] = [
  { label: "Pam Balasa", names: ["Pam Balasa", "Pamela Balasa"], phone: "269-475-3751" },
];

export type PhoneWrite =
  | { kind: "contact"; contactId: string; phone: string }
  | { kind: "createContact"; personId: string; name: string; phone: string }
  | { kind: "guest"; guestId: string; phone: string };

export type PhoneCorrectionRow = {
  label: string;
  personName: string | null;
  phone: string;
  current: string | null;
  status: "add" | "matches" | "differs" | "not_found";
  write: PhoneWrite | null;
};

export function planPhoneCorrections(snapshot: EnrichmentSnapshot): PhoneCorrectionRow[] {
  return PHONE_CORRECTIONS.map((def) => {
    const found = snapshot.persons.filter((person) => def.names.includes(person.name));
    const person = found.length === 1 ? found[0]! : null;
    if (!person) return { label: def.label, personName: null, phone: def.phone, current: null, status: "not_found", write: null };

    const plan = planContactEnrichment(snapshot, new Map(), [
      { sourceName: def.label, canonicalName: person.name, phone: def.phone, location: null, photoFile: null },
    ]);
    const row = plan.rows[0]!;
    const base = { label: def.label, personName: person.name, phone: def.phone, current: row.currentPhone };
    if (row.matchConfidence !== "HIGH") return { ...base, status: "not_found", write: null };
    if (row.phoneAction === "ALREADY_MATCHES") return { ...base, status: "matches", write: null };
    if (row.phoneAction === "PHONE_CONFLICT") {
      // Only on David's pick: her own contact row, never a household number another guest shares.
      const write: PhoneWrite = row.contactId
        ? { kind: "contact", contactId: row.contactId, phone: def.phone }
        : { kind: "createContact", personId: person.id, name: person.name, phone: def.phone };
      return { ...base, status: "differs", write };
    }
    const update = plan.contactPhoneUpdates[0];
    const create = plan.contactCreates[0];
    const guest = plan.guestPhoneUpdates[0];
    const write: PhoneWrite | null = update
      ? { kind: "contact", contactId: update.contactId, phone: update.phone }
      : create
        ? { kind: "createContact", personId: create.personId, name: create.name, phone: create.phone }
        : guest
          ? { kind: "guest", guestId: guest.guestId, phone: guest.phone }
          : // A person with no household and no contact yet gets her own contact row.
            row.guestPersonId
            ? null
            : { kind: "createContact", personId: person.id, name: person.name, phone: def.phone };
    return { ...base, status: write ? "add" : "not_found", write };
  });
}
