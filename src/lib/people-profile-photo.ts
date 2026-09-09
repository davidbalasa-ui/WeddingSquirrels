import { parseProfileId } from "@/lib/people-directory";
import { profilePhotoSrc } from "@/lib/people-experience";
import type { IdentityStore } from "@/lib/people-identity-write";
import { setProfilePhotoInStore, type ProfilePhotoWriteTarget } from "@/lib/people-identity-write";

export type ProfilePhotoAuthInput = {
  canSeeGuests: boolean;
  canEditContacts: boolean;
  hasGuestPhotoTarget: boolean;
  hasContactPhotoTarget: boolean;
};

/** People/Guest edit gates already used by guest cards and contact forms. */
export function canEditProfilePhoto(input: ProfilePhotoAuthInput): boolean {
  if (input.hasGuestPhotoTarget && input.canSeeGuests) return true;
  if (input.hasContactPhotoTarget && input.canEditContacts) return true;
  return false;
}

export function profilePhotoWriteTargetFromId(profileId: string): ProfilePhotoWriteTarget | null {
  const parsed = parseProfileId(profileId);
  if (!parsed) return null;
  return { kind: parsed.kind, id: parsed.id };
}

export function applyProfilePhotoAndRead(
  store: IdentityStore,
  profileId: string,
  photoData: string | null,
): { ok: true; photoSrc: string | null } | { ok: false; reason: "not_found" | "no_photo_target" | "invalid" } {
  const target = profilePhotoWriteTargetFromId(profileId);
  if (!target) return { ok: false, reason: "invalid" };
  const result = setProfilePhotoInStore(store, target, photoData);
  if (!result.ok) return result;
  const contact = result.contactId
    ? store.contacts.find((row) => row.id === result.contactId)
    : undefined;
  const guest = result.guestPersonId
    ? store.guestPeople.find((row) => row.id === result.guestPersonId)
    : undefined;
  return {
    ok: true,
    photoSrc: profilePhotoSrc(contact?.photoData?.trim() || guest?.photoData || null),
  };
}
