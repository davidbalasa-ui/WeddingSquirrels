/**
 * Confirmed production Day-of identity/contact writes.
 * Target exact row ids only. Never match PinAccount or Contact by name.
 */

export type PinLinkApproval = {
  pinAccountId: string;
  personId: string;
  expectedAccountName: string;
};

export type ContactFlagApproval = {
  contactId: string;
  expectedName: string;
  isDayOfContact: boolean;
  expectedSortOrder: number;
};

/** Snapshot-verified production PinAccount ids. */
export const APPROVED_PIN_LINKS: PinLinkApproval[] = [
  {
    pinAccountId: "cmtnslqbt0000js87zguxlq64",
    personId: "david",
    expectedAccountName: "David",
  },
  {
    pinAccountId: "cmtnslqgw0001js87n7pfdwr4",
    personId: "haley",
    expectedAccountName: "Haley",
  },
  {
    pinAccountId: "cmtnslqmj0002js871zyszgyc",
    personId: "shelly",
    expectedAccountName: "Mother in law",
  },
];

/** Snapshot-verified callable vendor Contacts. */
export const APPROVED_VENDOR_DAY_OF_FLAGS: ContactFlagApproval[] = [
  {
    contactId: "cmt0oqlfj000qfhb8ze02e4o6",
    expectedName: "Avalon Green · Planner",
    isDayOfContact: true,
    expectedSortOrder: 0,
  },
  {
    contactId: "cmt0oqljk000rfhb8f9b1ua60",
    expectedName: "Black Sheep Shelter · Venue",
    isDayOfContact: true,
    expectedSortOrder: 1,
  },
  {
    contactId: "cmt0oqlmh000sfhb8hk7z02pr",
    expectedName: "Barry Tilson · Photographer",
    isDayOfContact: true,
    expectedSortOrder: 2,
  },
  {
    contactId: "cmt0oqlpf000tfhb8wvd5iwhr",
    expectedName: "Belle Genton · Videographer",
    isDayOfContact: true,
    expectedSortOrder: 3,
  },
  {
    contactId: "cmt0oqlsd000ufhb8sx77c7bh",
    expectedName: "Precious Peony · Caterer",
    isDayOfContact: true,
    expectedSortOrder: 4,
  },
];

/** Snapshot-verified Belle Family rows with no communication channel. */
export const APPROVED_UNFLAG_FAMILY_CONTACTS: ContactFlagApproval[] = [
  {
    contactId: "cmtksa1gc0000ih04vwuu5age",
    expectedName: "Belle Genton",
    isDayOfContact: false,
    expectedSortOrder: 5,
  },
  {
    contactId: "cmtksbfxr0000l504jmwom5pu",
    expectedName: "Belle Genton +1",
    isDayOfContact: false,
    expectedSortOrder: 6,
  },
];

export const UNDECIDED_ASSIGNMENT_TITLES = [
  "Get 100 lbs of Ice",
  "Prep Smores Station foods",
  "Cater in Lunch",
] as const;

export type PinAccountSnapshot = {
  id: string;
  name: string;
  linkedPersonId: string | null;
};

export type ContactSnapshot = {
  id: string;
  name: string;
  directoryLabel: string | null;
  isDayOfContact: boolean;
  sortOrder: number;
  hasPhone: boolean;
  hasEmail: boolean;
};

export type PlannedPinLink = {
  pinAccountId: string;
  personId: string;
  from: string | null;
  to: string;
};

export function planApprovedPinLinks(
  accounts: PinAccountSnapshot[],
  approvals: PinLinkApproval[] = APPROVED_PIN_LINKS,
): { updates: PlannedPinLink[]; mismatches: string[] } {
  const byId = new Map(accounts.map((row) => [row.id, row]));
  const updates: PlannedPinLink[] = [];
  const mismatches: string[] = [];

  for (const approval of approvals) {
    const row = byId.get(approval.pinAccountId);
    if (!row) {
      mismatches.push(`missing PinAccount ${approval.pinAccountId}`);
      continue;
    }
    if (row.name !== approval.expectedAccountName) {
      mismatches.push(
        `PinAccount ${approval.pinAccountId} name is ${JSON.stringify(row.name)}, expected ${JSON.stringify(approval.expectedAccountName)}`,
      );
      continue;
    }
    if (row.linkedPersonId !== approval.personId) {
      updates.push({
        pinAccountId: approval.pinAccountId,
        personId: approval.personId,
        from: row.linkedPersonId,
        to: approval.personId,
      });
    }
  }

  return { updates, mismatches };
}

export function planApprovedContactFlags(
  contacts: ContactSnapshot[],
  approvals: ContactFlagApproval[] = [
    ...APPROVED_VENDOR_DAY_OF_FLAGS,
    ...APPROVED_UNFLAG_FAMILY_CONTACTS,
  ],
): {
  updates: Array<{ contactId: string; isDayOfContact: boolean; from: boolean }>;
  mismatches: string[];
} {
  const byId = new Map(contacts.map((row) => [row.id, row]));
  const updates: Array<{ contactId: string; isDayOfContact: boolean; from: boolean }> = [];
  const mismatches: string[] = [];

  for (const approval of approvals) {
    const row = byId.get(approval.contactId);
    if (!row) {
      mismatches.push(`missing Contact ${approval.contactId}`);
      continue;
    }
    if (row.name !== approval.expectedName) {
      mismatches.push(
        `Contact ${approval.contactId} name is ${JSON.stringify(row.name)}, expected ${JSON.stringify(approval.expectedName)}`,
      );
      continue;
    }
    if (row.sortOrder !== approval.expectedSortOrder) {
      mismatches.push(
        `Contact ${approval.contactId} sortOrder is ${row.sortOrder}, expected ${approval.expectedSortOrder}`,
      );
      continue;
    }
    if (row.isDayOfContact !== approval.isDayOfContact) {
      updates.push({
        contactId: approval.contactId,
        isDayOfContact: approval.isDayOfContact,
        from: row.isDayOfContact,
      });
    }
  }

  return { updates, mismatches };
}

export function pinLinkByNameWouldBeRejected(
  accounts: PinAccountSnapshot[],
  name: string,
  personId: string,
): boolean {
  const match = accounts.find((row) => row.name === name);
  if (!match) return true;
  return !APPROVED_PIN_LINKS.some((row) => row.pinAccountId === match.id && row.personId === personId);
}

export function plannedAssignmentAssignees(): never[] {
  return [];
}

export function wendyIsLabeledMc(contacts: Array<{ name: string; directoryLabel: string | null }>): boolean {
  return contacts.some((row) => {
    const haystack = `${row.name} ${row.directoryLabel ?? ""}`.toLowerCase();
    return haystack.includes("wendy") && /(mistress of ceremon|master of ceremon|\bmc\b)/.test(haystack);
  });
}

export type KurtPresence = {
  contact: ContactSnapshot | null;
  personId: string | null;
  hasAuthoritativeChannel: boolean;
};

export function inspectKurtPresence(input: {
  contacts: ContactSnapshot[];
  personIds: string[];
}): KurtPresence {
  const contact =
    input.contacts.find((row) => /\bkurt\b/i.test(row.name)) ??
    null;
  return {
    contact,
    personId: input.personIds.includes("kurt") ? "kurt" : null,
    hasAuthoritativeChannel: Boolean(contact?.hasPhone || contact?.hasEmail),
  };
}

export function planKurtMcWrite(presence: KurtPresence): {
  createContact: false;
  update: { contactId: string; directoryLabel: "MC"; isDayOfContact: true } | null;
  reason: string;
} {
  if (!presence.contact) {
    return {
      createContact: false,
      update: null,
      reason: "No authoritative Kurt Contact row. Do not fabricate phone/email or a name-only MC contact.",
    };
  }
  return {
    createContact: false,
    update: {
      contactId: presence.contact.id,
      directoryLabel: "MC",
      isDayOfContact: true,
    },
    reason: "Existing Kurt Contact may receive stored MC label; channels stay unchanged.",
  };
}
