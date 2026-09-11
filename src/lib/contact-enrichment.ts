/**
 * Controlled one-time People contact/profile enrichment from curated source rows.
 * Never creates Person / GuestPerson, never renames, never deletes.
 */
import { normalizePhoneKey } from "@/lib/guest-household-merge";
import { parseContactPhoto } from "@/lib/contact-photo";

export type ContactEnrichmentSource = {
  sourceName: string;
  canonicalName: string;
  phone: string;
  location: string | null;
  photoFile: string | null;
};

/** Curated source rows from contacts(1).md — names are hints only; canonicalName is the match key. */
export const CONTACT_ENRICHMENT_SOURCES: ContactEnrichmentSource[] = [
  {
    sourceName: "Andy Cartwright",
    canonicalName: "Andi Cartwright",
    phone: "231-329-3263",
    location: "Muskegon, MI",
    photoFile: "andi_cartwright.jpg",
  },
  {
    sourceName: "Bri Ely",
    canonicalName: "Bri Eling",
    phone: "231-769-3871",
    location: null,
    photoFile: "bree_eling.jpg",
  },
  {
    sourceName: "Trinity Medler",
    canonicalName: "Trinity Medler",
    phone: "517-896-7221",
    location: null,
    photoFile: "trinity.jpg",
  },
  {
    sourceName: "Evan Ely",
    canonicalName: "Evan Eling",
    phone: "231-343-6924",
    location: "Muskegon, MI",
    photoFile: "evan_eling.jpg",
  },
  {
    sourceName: "Braxton",
    canonicalName: "Braxton Wasilewski",
    phone: "231-672-0067",
    location: null,
    photoFile: null,
  },
  {
    sourceName: "Victoria",
    canonicalName: "Victoria Owens",
    phone: "616-272-0436",
    location: "Grand Rapids, MI",
    photoFile: null,
  },
  {
    sourceName: "Kaylie Cartwright",
    canonicalName: "Kaylie Cartwright",
    phone: "231-329-3264",
    location: null,
    photoFile: "kaylee.jpg",
  },
  {
    sourceName: "Skila Goins",
    canonicalName: "Skila Goins",
    phone: "269-419-7847",
    location: null,
    photoFile: null,
  },
];

export type EnrichmentPersonRow = {
  id: string;
  name: string;
  directoryList: string | null;
  isDayOfContact: boolean;
};

export type EnrichmentGuestPersonRow = {
  id: string;
  name: string;
  personId: string | null;
  rsvpStatus: string;
  photoData: string | null;
  guestId: string;
};

export type EnrichmentGuestRow = {
  id: string;
  phone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  rsvpStatus: string;
};

export type EnrichmentContactRow = {
  id: string;
  name: string;
  personId: string | null;
  phone: string | null;
  email: string | null;
  photoData: string | null;
  directoryList: string | null;
  isDayOfContact: boolean;
};

export type EnrichmentSnapshot = {
  persons: EnrichmentPersonRow[];
  guestPeople: EnrichmentGuestPersonRow[];
  guests: EnrichmentGuestRow[];
  contacts: EnrichmentContactRow[];
};

export type MatchConfidence = "HIGH" | "AMBIGUOUS";

export type PhoneAction =
  | "ADD_PHONE"
  | "ALREADY_MATCHES"
  | "PHONE_CONFLICT"
  | "CANNOT_STORE";

export type LocationAction =
  | "ADD_LOCATION"
  | "PRESERVE_EXISTING_ADDRESS"
  | "SKIP_NO_APPROPRIATE_FIELD";

export type PhotoAction =
  | "ADD_PHOTO"
  | "PHOTO_ALREADY_PRESENT"
  | "PHOTO_FILE_MISSING"
  | "CANNOT_STORE";

export type ContactAction =
  | "USE_EXISTING_CONTACT"
  | "CREATE_LINKED_CONTACT"
  | "NO_CONTACT_NEEDED"
  | "BLOCKED";

export type EnrichmentDryRunRow = {
  sourceName: string;
  canonicalPersonName: string | null;
  personId: string | null;
  guestPersonId: string | null;
  contactId: string | null;
  matchConfidence: MatchConfidence;
  matchReason: string | null;
  sourcePhone: string;
  currentPhone: string | null;
  phoneAction: PhoneAction;
  sourceLocation: string | null;
  currentAddressLocation: string | null;
  locationAction: LocationAction;
  sourcePhoto: string | null;
  photoFileFound: boolean;
  currentPhotoExists: boolean;
  photoAction: PhotoAction;
  contactAction: ContactAction;
  nameAction: "PRESERVE_CANONICAL_NAME";
};

export type EnrichmentApplyPlan = {
  rows: EnrichmentDryRunRow[];
  guestPhoneUpdates: Array<{ guestId: string; phone: string }>;
  guestLocationUpdates: Array<{ guestId: string; city: string; state: string }>;
  contactPhoneUpdates: Array<{ contactId: string; phone: string }>;
  guestPersonPhotoUpdates: Array<{ guestPersonId: string; photoData: string }>;
  contactPhotoUpdates: Array<{ contactId: string; photoData: string }>;
  blocked: boolean;
  blockedReason: string | null;
};

function addressLabel(guest: EnrichmentGuestRow | undefined): string | null {
  if (!guest) return null;
  const parts = [guest.street, guest.city, guest.state, guest.zip]
    .map((part) => part?.trim())
    .filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function parseCityState(location: string | null): { city: string; state: string } | null {
  if (!location?.trim()) return null;
  const match = location.trim().match(/^([^,]+),\s*([A-Za-z]{2})$/);
  if (!match) return null;
  return { city: match[1]!.trim(), state: match[2]!.trim().toUpperCase() };
}

function profilePhone(
  contact: EnrichmentContactRow | undefined,
  guest: EnrichmentGuestRow | undefined,
): string | null {
  const fromContact = contact?.phone?.trim();
  if (fromContact) return fromContact;
  const fromGuest = guest?.phone?.trim();
  return fromGuest || null;
}

function profilePhotoExists(
  contact: EnrichmentContactRow | undefined,
  guestPerson: EnrichmentGuestPersonRow | undefined,
): boolean {
  return Boolean(contact?.photoData?.trim() || guestPerson?.photoData?.trim());
}

function resolveIdentity(
  source: ContactEnrichmentSource,
  snapshot: EnrichmentSnapshot,
): {
  confidence: MatchConfidence;
  reason: string | null;
  person: EnrichmentPersonRow | null;
  guestPerson: EnrichmentGuestPersonRow | null;
  contact: EnrichmentContactRow | null;
  guest: EnrichmentGuestRow | null;
} {
  const matches = snapshot.persons.filter((row) => row.name === source.canonicalName);
  if (matches.length === 0) {
    return {
      confidence: "AMBIGUOUS",
      reason: `No Person named ${JSON.stringify(source.canonicalName)}`,
      person: null,
      guestPerson: null,
      contact: null,
      guest: null,
    };
  }
  if (matches.length > 1) {
    return {
      confidence: "AMBIGUOUS",
      reason: `${matches.length} Person rows named ${JSON.stringify(source.canonicalName)}`,
      person: null,
      guestPerson: null,
      contact: null,
      guest: null,
    };
  }
  const person = matches[0]!;
  const guestPeople = snapshot.guestPeople.filter((row) => row.personId === person.id);
  if (guestPeople.length > 1) {
    return {
      confidence: "AMBIGUOUS",
      reason: `${guestPeople.length} GuestPerson rows linked to personId ${person.id}`,
      person,
      guestPerson: null,
      contact: null,
      guest: null,
    };
  }
  const contacts = snapshot.contacts.filter((row) => row.personId === person.id);
  if (contacts.length > 1) {
    return {
      confidence: "AMBIGUOUS",
      reason: `${contacts.length} Contact rows linked to personId ${person.id}`,
      person,
      guestPerson: guestPeople[0] ?? null,
      contact: null,
      guest: null,
    };
  }
  const guestPerson = guestPeople[0] ?? null;
  const contact = contacts[0] ?? null;
  const guest =
    guestPerson ? (snapshot.guests.find((row) => row.id === guestPerson.guestId) ?? null) : null;
  return {
    confidence: "HIGH",
    reason: null,
    person,
    guestPerson,
    contact,
    guest,
  };
}

function planPhone(
  sourcePhone: string,
  contact: EnrichmentContactRow | undefined,
  guest: EnrichmentGuestRow | undefined,
): { action: PhoneAction; storeOn: "contact" | "guest" | null } {
  const current = profilePhone(contact, guest);
  const sourceDigits = normalizePhoneKey(sourcePhone);
  const currentDigits = normalizePhoneKey(current);
  if (!sourceDigits) return { action: "CANNOT_STORE", storeOn: null };
  if (currentDigits && currentDigits === sourceDigits) {
    return { action: "ALREADY_MATCHES", storeOn: null };
  }
  if (currentDigits && currentDigits !== sourceDigits) {
    return { action: "PHONE_CONFLICT", storeOn: null };
  }
  if (contact) return { action: "ADD_PHONE", storeOn: "contact" };
  if (guest) return { action: "ADD_PHONE", storeOn: "guest" };
  return { action: "CANNOT_STORE", storeOn: null };
}

function planLocation(
  sourceLocation: string | null,
  guest: EnrichmentGuestRow | undefined,
): LocationAction {
  const parsed = parseCityState(sourceLocation);
  if (!parsed) return "SKIP_NO_APPROPRIATE_FIELD";
  if (!guest) return "SKIP_NO_APPROPRIATE_FIELD";
  if (guest.street?.trim()) return "PRESERVE_EXISTING_ADDRESS";
  const hasCity = Boolean(guest.city?.trim());
  const hasState = Boolean(guest.state?.trim());
  if (hasCity || hasState) return "PRESERVE_EXISTING_ADDRESS";
  return "ADD_LOCATION";
}

function planPhoto(
  photoDataUrl: string | null,
  photoFileFound: boolean,
  sourcePhotoFile: string | null,
  contact: EnrichmentContactRow | undefined,
  guestPerson: EnrichmentGuestPersonRow | undefined,
): PhotoAction {
  if (!sourcePhotoFile) return "CANNOT_STORE";
  if (!photoFileFound || !photoDataUrl) return "PHOTO_FILE_MISSING";
  if (profilePhotoExists(contact, guestPerson)) return "PHOTO_ALREADY_PRESENT";
  if (!guestPerson && !contact) return "CANNOT_STORE";
  return "ADD_PHOTO";
}

function planContactAction(
  contact: EnrichmentContactRow | undefined,
  phoneStoreOn: "contact" | "guest" | null,
  phoneAction: PhoneAction,
): ContactAction {
  if (contact) return "USE_EXISTING_CONTACT";
  if (phoneAction === "ADD_PHONE" && phoneStoreOn === "guest") return "NO_CONTACT_NEEDED";
  if (phoneAction === "ALREADY_MATCHES") return contact ? "USE_EXISTING_CONTACT" : "NO_CONTACT_NEEDED";
  if (phoneAction === "CANNOT_STORE" && !contact) return "NO_CONTACT_NEEDED";
  return "NO_CONTACT_NEEDED";
}

export function planContactEnrichment(
  snapshot: EnrichmentSnapshot,
  photoDataByFile: Map<string, string | null>,
): EnrichmentApplyPlan {
  const rows: EnrichmentDryRunRow[] = [];
  const guestPhoneUpdates: EnrichmentApplyPlan["guestPhoneUpdates"] = [];
  const guestLocationUpdates: EnrichmentApplyPlan["guestLocationUpdates"] = [];
  const contactPhoneUpdates: EnrichmentApplyPlan["contactPhoneUpdates"] = [];
  const guestPersonPhotoUpdates: EnrichmentApplyPlan["guestPersonPhotoUpdates"] = [];
  const contactPhotoUpdates: EnrichmentApplyPlan["contactPhotoUpdates"] = [];

  for (const source of CONTACT_ENRICHMENT_SOURCES) {
    const identity = resolveIdentity(source, snapshot);
    const photoFileFound = source.photoFile ? photoDataByFile.has(source.photoFile) : false;
    const photoDataUrl = source.photoFile ? (photoDataByFile.get(source.photoFile) ?? null) : null;

    const phonePlan =
      identity.confidence === "HIGH"
        ? planPhone(source.phone, identity.contact ?? undefined, identity.guest ?? undefined)
        : { action: "CANNOT_STORE" as PhoneAction, storeOn: null as "contact" | "guest" | null };

    const locationAction =
      identity.confidence === "HIGH"
        ? planLocation(source.location, identity.guest ?? undefined)
        : ("SKIP_NO_APPROPRIATE_FIELD" as LocationAction);

    const photoAction =
      identity.confidence === "HIGH"
        ? planPhoto(
            photoDataUrl,
            photoFileFound,
            source.photoFile,
            identity.contact ?? undefined,
            identity.guestPerson ?? undefined,
          )
        : ("CANNOT_STORE" as PhotoAction);

    const contactAction =
      identity.confidence === "HIGH"
        ? planContactAction(identity.contact ?? undefined, phonePlan.storeOn, phonePlan.action)
        : ("BLOCKED" as ContactAction);

    rows.push({
      sourceName: source.sourceName,
      canonicalPersonName: identity.person?.name ?? null,
      personId: identity.person?.id ?? null,
      guestPersonId: identity.guestPerson?.id ?? null,
      contactId: identity.contact?.id ?? null,
      matchConfidence: identity.confidence,
      matchReason: identity.reason,
      sourcePhone: source.phone,
      currentPhone:
        identity.confidence === "HIGH"
          ? profilePhone(identity.contact ?? undefined, identity.guest ?? undefined)
          : null,
      phoneAction: phonePlan.action,
      sourceLocation: source.location,
      currentAddressLocation:
        identity.confidence === "HIGH" ? addressLabel(identity.guest ?? undefined) : null,
      locationAction,
      sourcePhoto: source.photoFile,
      photoFileFound,
      currentPhotoExists:
        identity.confidence === "HIGH"
          ? profilePhotoExists(identity.contact ?? undefined, identity.guestPerson ?? undefined)
          : false,
      photoAction,
      contactAction,
      nameAction: "PRESERVE_CANONICAL_NAME",
    });

    if (identity.confidence !== "HIGH") continue;

    if (phonePlan.action === "ADD_PHONE" && phonePlan.storeOn === "contact" && identity.contact) {
      contactPhoneUpdates.push({ contactId: identity.contact.id, phone: source.phone });
    }
    if (phonePlan.action === "ADD_PHONE" && phonePlan.storeOn === "guest" && identity.guest) {
      guestPhoneUpdates.push({ guestId: identity.guest.id, phone: source.phone });
    }

    if (locationAction === "ADD_LOCATION" && identity.guest && source.location) {
      const parsed = parseCityState(source.location);
      if (parsed) {
        guestLocationUpdates.push({
          guestId: identity.guest.id,
          city: parsed.city,
          state: parsed.state,
        });
      }
    }

    if (photoAction === "ADD_PHOTO" && photoDataUrl) {
      try {
        parseContactPhoto(photoDataUrl);
      } catch {
        continue;
      }
      if (identity.guestPerson) {
        guestPersonPhotoUpdates.push({ guestPersonId: identity.guestPerson.id, photoData: photoDataUrl });
      }
      if (identity.contact && !identity.contact.photoData?.trim()) {
        contactPhotoUpdates.push({ contactId: identity.contact.id, photoData: photoDataUrl });
      }
    }
  }

  const hasRename = rows.some((row) => row.nameAction !== "PRESERVE_CANONICAL_NAME");
  const blockedReason = hasRename ? "Invalid plan proposes name change" : null;

  return {
    rows,
    guestPhoneUpdates,
    guestLocationUpdates,
    contactPhoneUpdates,
    guestPersonPhotoUpdates,
    contactPhotoUpdates,
    blocked: Boolean(blockedReason),
    blockedReason,
  };
}

export function formatEnrichmentDryRunRow(row: EnrichmentDryRunRow): string {
  const lines = [
    `SOURCE NAME: ${row.sourceName}`,
    `CANONICAL PERSON NAME: ${row.canonicalPersonName ?? "(none)"}`,
    `PERSON ID: ${row.personId ?? "(none)"}`,
    `GUESTPERSON ID: ${row.guestPersonId ?? "(none)"}`,
    `CONTACT ID: ${row.contactId ?? "(none)"}`,
    `MATCH CONFIDENCE: ${row.matchConfidence}${row.matchReason ? ` (${row.matchReason})` : ""}`,
    `SOURCE PHONE: ${row.sourcePhone}`,
    `CURRENT PHONE: ${row.currentPhone ?? "(empty)"}`,
    `PHONE ACTION: ${row.phoneAction}`,
    `SOURCE LOCATION: ${row.sourceLocation ?? "(none)"}`,
    `CURRENT ADDRESS/LOCATION: ${row.currentAddressLocation ?? "(empty)"}`,
    `LOCATION ACTION: ${row.locationAction}`,
    `SOURCE PHOTO: ${row.sourcePhoto ?? "(none)"}`,
    `PHOTO FILE FOUND? ${row.sourcePhoto ? (row.photoFileFound ? "yes" : "no") : "n/a"}`,
    `CURRENT PHOTO EXISTS? ${row.currentPhotoExists ? "yes" : "no"}`,
    `PHOTO ACTION: ${row.photoAction}`,
    `CONTACT ACTION: ${row.contactAction}`,
    `NAME ACTION: ${row.nameAction}`,
  ];
  return lines.join("\n");
}

export function enrichmentWriteCounts(plan: EnrichmentApplyPlan) {
  return {
    guestPhone: plan.guestPhoneUpdates.length,
    guestLocation: plan.guestLocationUpdates.length,
    contactPhone: plan.contactPhoneUpdates.length,
    guestPhoto: plan.guestPersonPhotoUpdates.length,
    contactPhoto: plan.contactPhotoUpdates.length,
    creates: 0,
    deletes: 0,
  };
}

export function photoDataUrlFromFileBytes(bytes: Buffer, mime = "image/jpeg"): string {
  return `data:${mime};base64,${bytes.toString("base64")}`;
}
