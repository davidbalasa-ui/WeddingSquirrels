/**
 * David, 2026-10-11 15:50: "for the contact list, add back in the mother of the bride (shelly) with her
 * phone number info, and Denise (2317403616) and Lisa (2317404390) are helpers, Role for john Wiewiora
 * should be father of bride, and Pam Balasa is mother of groom, Bryan balasa (2694753495) needs added
 * as father of groom."
 *
 * Each prints with the day-of contacts under the role David gave, whatever label an older saved
 * row carries. A number is only ever filled where none is saved.
 */
/** phone null: the number is saved through the phone corrections (which wait for David's pick on a clash). */
export type FamilyContact = { name: string; role: string; phone: string | null };

export const FAMILY_CONTACTS: FamilyContact[] = [
  { name: "John Wiewiora", role: "Father of the Bride", phone: null },
  { name: "Pam Balasa", role: "Mother of the Groom", phone: null },
  // David, 2026-10-11 18:51: "You didn't add Shelly's phone number to the contacts. 2319038127".
  { name: "Shelly Wiewiora", role: "Mother of the Bride", phone: "(231) 903-8127" },
  { name: "Bryan Balasa", role: "Father of the Groom", phone: "(269) 475-3495" },
  { name: "Denise", role: "Helper", phone: "(231) 740-3616" },
  { name: "Lisa", role: "Helper", phone: "(231) 740-4390" },
];

const ROLE_BY_NAME = new Map<string, string>([
  ...FAMILY_CONTACTS.map((row) => [row.name.toLowerCase(), row.role] as const),
  ["pamela balasa", "Mother of the Groom"],
]);

/** The role David gave this person, if he gave one. */
export function familyRole(name: string): string | null {
  return ROLE_BY_NAME.get(name.trim().replace(/\s+/g, " ").toLowerCase()) ?? null;
}
