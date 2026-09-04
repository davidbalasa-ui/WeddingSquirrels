import {
  filterDirectoryEntries,
  filterEntriesByTab,
  sourceListsLabel,
  vendorSubtitle,
  type DirectoryEntry,
  type PeopleAttendanceFilter,
  type PeopleTab,
} from "@/lib/people-directory";
import type { PeopleProfile } from "@/lib/people-profile";

export type DirectoryRowPresentation = {
  profileId: string;
  name: string;
  photoSrc: string | null;
  roleContext: string | null;
  secondary: string | null;
};

export type ProfileRoleChip = "Guest" | "Vendor" | "Day-of contact";

export type ProfileContactAction = {
  href: string;
  label: string;
  value: string;
};

export type ProfileSectionId =
  | "contact"
  | "guest"
  | "vendor"
  | "tasks"
  | "meals"
  | "stay"
  | "day-of"
  | "requests"
  | "related"
  | "budget";

const INFERRED_ROLE_LABELS = new Set([
  "wedding party",
  "family & helpers",
  "day-of helper",
  "couple",
  "guest",
  "vendor",
]);

export function firstName(name: string): string {
  const first = name.trim().split(/\s+/)[0];
  return first || name.trim() || "them";
}

export function peopleHubEmptyLabel(tab: PeopleTab): string {
  if (tab === "vendors") return "No vendor contacts yet.";
  if (tab === "day-of") return "No day-of contacts yet.";
  if (tab === "guests") return "No guests yet.";
  return "People will appear here as the wedding comes together.";
}

export function peopleSearchEmptyLabel(tab: PeopleTab): string {
  if (tab === "vendors") return "No vendor contacts match that search.";
  if (tab === "day-of") return "No day-of contacts match that search.";
  if (tab === "guests") return "No guests match that search.";
  return "No one matches that search.";
}

export function directoryRoleContext(entry: DirectoryEntry): string | null {
  const parts: string[] = [];
  if (entry.lists.includes("guests")) parts.push("Guest");
  if (entry.lists.includes("vendors")) parts.push(parts.length ? "Vendor" : "Vendor contact");
  if (entry.isDayOfContact && parts.length === 0) parts.push("Day-of contact");
  if (parts.length === 2) return "Guest · Vendor";
  return parts[0] ?? sourceListsLabel(entry.lists);
}

function rsvpSecondary(label: string | null): string | null {
  if (!label) return null;
  const normalized = label.trim().toLowerCase();
  if (normalized === "attending" || normalized === "yes") return "RSVP accepted";
  if (normalized === "not attending" || normalized === "no") return "Not attending";
  if (normalized === "no reply" || normalized === "pending") return "No reply yet";
  return `RSVP · ${label}`;
}

export function directorySecondaryDetail(entry: DirectoryEntry): string | null {
  const rsvp = rsvpSecondary(entry.rsvpLabel);
  if (rsvp) return rsvp;

  const vendorContext =
    entry.lists.includes("vendors")
      ? entry.subtitle?.trim() || vendorSubtitle(entry.name)
      : null;
  if (vendorContext && vendorContext !== entry.name) return vendorContext;

  if (entry.tableLabel) return entry.tableLabel;

  if (entry.isDayOfContact && entry.phone) return "Phone available";
  if (entry.isDayOfContact && entry.email) return "Email available";

  return null;
}

export function presentDirectoryRow(entry: DirectoryEntry): DirectoryRowPresentation {
  return {
    profileId: entry.profileId,
    name: entry.name,
    photoSrc: entry.photoSrc?.trim() || null,
    roleContext: directoryRoleContext(entry),
    secondary: directorySecondaryDetail(entry),
  };
}

export function presentDirectoryRows(entries: DirectoryEntry[]): DirectoryRowPresentation[] {
  return entries.map(presentDirectoryRow);
}

/** Presentation-only search. Never creates, links, or merges identities. */
export function searchDirectoryEntries(entries: DirectoryEntry[], query: string): DirectoryEntry[] {
  return filterDirectoryEntries(entries, query);
}

export function filterDirectoryByAttendance(
  entries: DirectoryEntry[],
  attendance: PeopleAttendanceFilter,
): DirectoryEntry[] {
  if (attendance === "all") return entries;
  return entries.filter((entry) => {
    const label = entry.rsvpLabel?.trim().toLowerCase() ?? "";
    if (attendance === "pending") {
      return !label || label === "no reply" || label === "pending";
    }
    if (attendance === "attending") {
      return label === "attending" || label === "yes" || label.includes("accepted");
    }
    return label === "not attending" || label === "no";
  });
}

export function peopleHubTabCounts(entries: DirectoryEntry[]): Record<PeopleTab, number> {
  return {
    all: entries.length,
    guests: filterEntriesByTab(entries, "guests").length,
    vendors: filterEntriesByTab(entries, "vendors").length,
    "day-of": filterEntriesByTab(entries, "day-of").length,
  };
}

export function profileRoleChips(profile: Pick<
  PeopleProfile,
  "guestInfo" | "primaryList" | "isDayOfContact" | "phone" | "email" | "vendorContext"
>): ProfileRoleChip[] {
  const chips: ProfileRoleChip[] = [];
  if (profile.guestInfo) chips.push("Guest");
  const hasVendorEvidence =
    Boolean(profile.vendorContext?.trim()) ||
    (profile.primaryList === "vendors" && Boolean(profile.phone?.trim() || profile.email?.trim()));
  if (hasVendorEvidence) chips.push("Vendor");
  if (profile.isDayOfContact) chips.push("Day-of contact");
  return chips;
}

export function profileDisplayLabel(
  profile: Pick<PeopleProfile, "directoryLabel" | "subtitle">,
): string | null {
  const stored = profile.directoryLabel?.trim();
  if (stored && !INFERRED_ROLE_LABELS.has(stored.toLowerCase())) return stored;
  const subtitle = profile.subtitle?.trim();
  if (subtitle && !INFERRED_ROLE_LABELS.has(subtitle.toLowerCase())) return subtitle;
  return null;
}

export function profileContactActions(
  profile: Pick<PeopleProfile, "phone" | "email">,
): ProfileContactAction[] {
  const actions: ProfileContactAction[] = [];
  const phone = profile.phone?.trim();
  const email = profile.email?.trim();
  if (phone) {
    const tel = phone.replace(/[^\d+]/g, "");
    actions.push({ href: `tel:${tel}`, label: "Call", value: phone });
    actions.push({ href: `sms:${tel}`, label: "Text", value: phone });
  }
  if (email) {
    actions.push({ href: `mailto:${email}`, label: "Email", value: email });
  }
  return actions;
}

export function visibleProfileSections(
  profile: Pick<
    PeopleProfile,
    | "phone"
    | "email"
    | "guestInfo"
    | "openTasks"
    | "completedTaskCount"
    | "canSeeTasks"
    | "assignments"
    | "stayLabel"
    | "mealStatus"
    | "relatedLinks"
    | "budgetContracts"
    | "primaryList"
    | "isDayOfContact"
    | "vendorContext"
    | "gifts"
  >,
): ProfileSectionId[] {
  const sections: ProfileSectionId[] = [];
  if (profile.phone?.trim() || profile.email?.trim()) sections.push("contact");
  if (profile.guestInfo) sections.push("guest");
  if (profile.vendorContext) sections.push("vendor");
  if (profile.canSeeTasks) sections.push("tasks");
  if (profile.mealStatus) sections.push("meals");
  if (profile.stayLabel) sections.push("stay");
  if (profile.assignments.length > 0) sections.push("day-of");
  if (profile.budgetContracts.length > 0) sections.push("budget");
  if (profile.relatedLinks.length > 0) sections.push("related");
  return sections;
}

export function tasksEmptyLabel(name: string): string {
  return `Nothing open for ${firstName(name)}.`;
}

export function profilePhotoSrc(photoSrc: string | null | undefined): string | null {
  const trimmed = photoSrc?.trim();
  return trimmed ? trimmed : null;
}

export function omitFabricatedValue(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lowered = trimmed.toLowerCase();
  if (lowered === "n/a" || lowered === "null" || lowered === "undefined") return null;
  return trimmed;
}
