import { normalizePersonName } from "@/lib/people-directory";

export type PhotoContact = {
  id: string;
  name: string;
  photoData: string | null;
};

export type PhotoGuestPerson = {
  id: string;
  name: string;
  photoData: string | null;
};

function exactNameMatch(a: string, b: string) {
  return normalizePersonName(a) === normalizePersonName(b);
}

/** Copy nonempty photos into empty slots only. Never clears either side. */
export function planPhotoCopies(
  guestPeople: PhotoGuestPerson[],
  contacts: PhotoContact[],
): {
  guestUpdates: Array<{ id: string; photoData: string }>;
  contactUpdates: Array<{ id: string; photoData: string }>;
} {
  const guestUpdates: Array<{ id: string; photoData: string }> = [];
  const contactUpdates: Array<{ id: string; photoData: string }> = [];

  for (const person of guestPeople) {
    if (person.photoData?.trim()) continue;
    const contact = contacts.find(
      (row) => row.photoData?.trim() && exactNameMatch(row.name, person.name),
    );
    if (!contact?.photoData) continue;
    guestUpdates.push({ id: person.id, photoData: contact.photoData });
  }

  for (const contact of contacts) {
    if (contact.photoData?.trim()) continue;
    const person = guestPeople.find(
      (row) => row.photoData?.trim() && exactNameMatch(row.name, contact.name),
    );
    if (!person?.photoData) continue;
    contactUpdates.push({ id: contact.id, photoData: person.photoData });
  }

  return { guestUpdates, contactUpdates };
}

export function displayPhotoForPerson(
  personName: string,
  personPhoto: string | null | undefined,
  contacts: Array<{ name: string; photoData: string | null }>,
): string | null {
  if (personPhoto?.trim()) return personPhoto;
  const contact = contacts.find(
    (row) => row.photoData?.trim() && exactNameMatch(row.name, personName),
  );
  return contact?.photoData ?? null;
}
