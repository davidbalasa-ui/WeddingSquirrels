/** Shared validation for contact/guest profile photos stored as data URLs. */
export const CONTACT_PHOTO_RE = /^data:image\/(?:jpeg|jpg|png|webp);base64,[a-z0-9+/=]+$/i;
export const MAX_CONTACT_PHOTO_CHARS = 500_000;

export function parseContactPhoto(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (!CONTACT_PHOTO_RE.test(value) || value.length > MAX_CONTACT_PHOTO_CHARS) {
    throw new Error("INVALID_PHOTO");
  }
  return value;
}
