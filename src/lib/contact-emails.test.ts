import assert from "node:assert/strict";
import { test } from "node:test";
import { CONTACT_EMAILS, planContactEmails } from "./contact-emails";
import { FAMILY_CONTACTS } from "./family-contacts";
import { correctionKey, pendingTaskCorrections } from "./applied-corrections";

const contact = (name: string, email: string | null = null) => ({
  id: name, name, personId: null, phone: null, email, photoData: null, directoryList: null, isDayOfContact: true,
});
const person = (name: string) => ({ id: name, name, directoryList: null, isDayOfContact: true });

// David, 2026-10-13 20:29: Kurt, Wendy and Lisa Pelfresne's emails, as he sent them.
test("David's emails for Kurt, Wendy and Lisa", () => {
  const email = (name: string) => CONTACT_EMAILS.find((row) => row.name === name)?.email;
  assert.equal(email("Kurt Huizenga"), "kurthuizenga@yahoo.com");
  assert.equal(email("Wendy Rush"), "Wrush2021@gmail.com");
  assert.equal(email("Lisa Pelfresne"), "lpelf@comcast.net");
});

test("an email fills only where the person is saved and has none", () => {
  const names = (rows: { name: string }[]) => rows.map((row) => row.name);
  // Wendy's contact, Kurt as a person only, Lisa saved under the name the app first wrote.
  assert.deepEqual(
    names(planContactEmails({ contacts: [contact("Wendy Rush"), contact("Lisa")], persons: [person("Kurt Huizenga")] })),
    ["Kurt Huizenga", "Wendy Rush", "Lisa Pelfresne"],
  );
  // One David typed stays; someone not saved anywhere is not made up.
  assert.deepEqual(names(planContactEmails({ contacts: [contact("Wendy Rush", "wendy@example.com")], persons: [] })), []);
  // Lisa added in the same Apply gets hers.
  assert.deepEqual(names(planContactEmails({ contacts: [], persons: [] }, ["Lisa Pelfresne"])), ["Lisa Pelfresne"]);
});

test("Lisa's full name never adds her twice: her first saved contact keeps its ledger key", () => {
  const lisa = FAMILY_CONTACTS.find((row) => row.name === "Lisa Pelfresne")!;
  assert.equal(lisa.earlierName, "Lisa");
  const plan = {
    tasks: { inserts: [], marks: [], dueFills: [], noteFills: [] },
    phones: [],
    contacts: [{ name: lisa.name, phone: lisa.phone!, directoryLabel: lisa.role, dayOf: true, ledgerName: lisa.ledgerName }],
    emails: [],
    dayJobs: [],
    dayJobRewords: [],
    playbookRewords: [],
  };
  assert.equal(pendingTaskCorrections(plan as never, new Set([correctionKey.contact("Lisa")])).contacts.length, 0);
});
