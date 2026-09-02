import type { GuestRecord } from "@/lib/guests";
import { parseRsvpStatus } from "@/lib/guest-gifts";
import { resolveGuestPersonRole } from "@/lib/guest-person-role";
import type { DirectoryEntry, PeopleSort } from "@/lib/people-directory";
import { tableSeatingLabel } from "@/lib/guest-seating-chart";

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
