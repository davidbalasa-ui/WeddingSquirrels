import type { GuestRecord } from "@/lib/guests";
import { parseRsvpStatus } from "@/lib/guest-gifts";
import { resolveGuestPersonRole } from "@/lib/guest-person-role";
import { normalizePersonName } from "@/lib/people-directory";
import type {
  DirectoryEntry,
  PeopleAttendanceFilter,
  PeopleRoleFilter,
  PeopleSort,
} from "@/lib/people-directory";
import { tableSeatingLabel } from "@/lib/guest-seating-chart";

export type GuestPersonListItem = {
  person: GuestRecord["people"][number];
  guest: GuestRecord;
};

export type UploadedPhotoOption = {
  src: string;
  label: string;
};

const RSVP_RANK: Record<string, number> = {
  pending: 0,
  attending: 1,
  not_attending: 2,
};

function rsvpRankFromLabel(label: string | null): number {
  const normalized = label?.toLowerCase() ?? "";
  if (normalized.includes("not")) return 2;
  if (normalized.includes("attend")) return 1;
  return 0;
}

function guestSortKey(guest: GuestRecord, sort: PeopleSort): string | number {
  const lead = guest.people[0];
  if (!lead) return "";

  switch (sort) {
    case "name":
      return lead.name.toLowerCase();
    case "role":
      return resolveGuestPersonRole({ directoryLabel: lead.directoryLabel });
    case "rsvp":
      return RSVP_RANK[parseRsvpStatus(lead.rsvpStatus)] ?? 0;
    case "table":
      return lead.tableNumber ?? Number.POSITIVE_INFINITY;
    default:
      return lead.name.toLowerCase();
  }
}

export function sortGuestRecords(guests: GuestRecord[], sort: PeopleSort): GuestRecord[] {
  return [...guests].sort((a, b) => {
    const left = guestSortKey(a, sort);
    const right = guestSortKey(b, sort);
    if (typeof left === "number" && typeof right === "number") {
      return left - right || a.people[0]?.name.localeCompare(b.people[0]?.name ?? "");
    }
    return String(left).localeCompare(String(right));
  });
}

export function flattenGuestPeople(guests: GuestRecord[]): GuestPersonListItem[] {
  return guests.flatMap((guest) => guest.people.map((person) => ({ person, guest })));
}

function personMatchesQuery(item: GuestPersonListItem, query: string): boolean {
  const needle = normalizePersonName(query);
  if (!needle) return true;
  const haystack = normalizePersonName(
    [
      item.person.name,
      item.person.directoryLabel,
      item.person.rsvpStatus,
      item.guest.phone,
      item.guest.street,
      item.guest.city,
      item.guest.state,
      item.guest.zip,
      item.person.tableNumber != null ? `table ${item.person.tableNumber}` : "",
      item.person.tableSpot,
    ]
      .filter(Boolean)
      .join(" "),
  );
  return haystack.includes(needle);
}

export function filterGuestPeople(
  items: GuestPersonListItem[],
  opts: {
    role?: PeopleRoleFilter;
    attendance?: PeopleAttendanceFilter;
    query?: string;
  } = {},
): GuestPersonListItem[] {
  const role = opts.role ?? "all";
  const attendance = opts.attendance ?? "all";
  const query = opts.query ?? "";
  return items.filter((item) => {
    if (role !== "all") {
      const personRole = resolveGuestPersonRole({ directoryLabel: item.person.directoryLabel });
      if (personRole !== role) return false;
    }
    if (attendance !== "all") {
      if (parseRsvpStatus(item.person.rsvpStatus) !== attendance) return false;
    }
    return personMatchesQuery(item, query);
  });
}

function personSortKey(item: GuestPersonListItem, sort: PeopleSort): string | number {
  switch (sort) {
    case "role":
      return resolveGuestPersonRole({ directoryLabel: item.person.directoryLabel });
    case "rsvp":
      return RSVP_RANK[parseRsvpStatus(item.person.rsvpStatus)] ?? 0;
    case "table":
      return item.person.tableNumber ?? Number.POSITIVE_INFINITY;
    case "name":
    default:
      return item.person.name.toLowerCase();
  }
}

export function sortGuestPeople(items: GuestPersonListItem[], sort: PeopleSort = "name"): GuestPersonListItem[] {
  return [...items].sort((a, b) => {
    const left = personSortKey(a, sort);
    const right = personSortKey(b, sort);
    if (typeof left === "number" && typeof right === "number") {
      return left - right || a.person.name.localeCompare(b.person.name);
    }
    return String(left).localeCompare(String(right)) || a.person.name.localeCompare(b.person.name);
  });
}

export function collectUploadedPhotos(input: {
  guests: GuestRecord[];
  extraPhotos?: Array<{ src: string | null | undefined; label: string }>;
}): UploadedPhotoOption[] {
  const seen = new Set<string>();
  const photos: UploadedPhotoOption[] = [];
  function add(src: string | null | undefined, label: string) {
    const value = src?.trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    photos.push({ src: value, label });
  }
  for (const guest of input.guests) {
    for (const person of guest.people) add(person.photoData, person.name);
  }
  for (const extra of input.extraPhotos ?? []) add(extra.src, extra.label);
  return photos;
}

function entryRoleRank(entry: DirectoryEntry): string {
  const label = entry.roles[0]?.toLowerCase() ?? "";
  if (label.includes("vendor")) return "vendor";
  if (label.includes("wedding") || label.includes("party")) return "wedding_party";
  if (label.includes("family")) return "family";
  return "guest";
}

export function sortDirectoryEntries(entries: DirectoryEntry[], sort: PeopleSort): DirectoryEntry[] {
  return [...entries].sort((a, b) => {
    switch (sort) {
      case "role":
        return entryRoleRank(a).localeCompare(entryRoleRank(b)) || a.name.localeCompare(b.name);
      case "rsvp":
        return rsvpRankFromLabel(a.rsvpLabel) - rsvpRankFromLabel(b.rsvpLabel) || a.name.localeCompare(b.name);
      case "table":
        const leftTable = a.tableLabel ?? "";
        const rightTable = b.tableLabel ?? "";
        return leftTable.localeCompare(rightTable) || a.name.localeCompare(b.name);
      case "name":
      default:
        return a.name.localeCompare(b.name);
    }
  });
}

export function guestTableSummary(guest: GuestRecord): string | null {
  const labels = guest.people
    .map((person) => {
      if (person.tableNumber == null) return null;
      const base = tableSeatingLabel(person.tableNumber);
      const spot = person.tableSpot?.trim();
      return spot ? `${base} #${spot}` : base;
    })
    .filter(Boolean);
  if (labels.length === 0) return null;
  return [...new Set(labels)].join(" · ");
}
