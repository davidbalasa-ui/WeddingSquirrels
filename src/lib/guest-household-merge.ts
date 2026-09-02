import { householdRsvpFromPeople } from "@/lib/guest-rsvp-import";
import { parseRsvpStatus, syncLegacyGuestNames } from "@/lib/guest-gifts";
import { normalizePersonName } from "@/lib/people-directory";

export type MergeGuestPerson = {
  id: string;
  name: string;
  directoryLabel: string | null;
  isDayOfContact: boolean;
  rsvpStatus: string;
  photoData: string | null;
  tableNumber: number | null;
  tableSpot: string | null;
  sortOrder: number;
};

export type MergeGuestGift = {
  id: string;
  description: string;
  thanked: boolean;
  thankYouWritten: boolean;
  thankYouSent: boolean;
  sortOrder: number;
};

export type MergeGuestHousehold = {
  id: string;
  phone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  rsvpStatus: string;
  invitedCount: number;
  acceptedCount: number;
  sortOrder: number;
  people: MergeGuestPerson[];
  gifts: MergeGuestGift[];
};

export type MergeConflict = {
  winnerId: string;
  loserId: string;
  reasons: string[];
  label: string;
};

export type MergePlan = {
  winnerId: string;
  loserId: string;
  label: string;
};

export type HouseholdMergeAnalysis = {
  merges: MergePlan[];
  conflicts: MergeConflict[];
};

function addressLine(guest: MergeGuestHousehold) {
  return [guest.street, guest.city, guest.state, guest.zip]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ");
}

function normalizeAddressKey(guest: MergeGuestHousehold) {
  return addressLine(guest)
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhoneKey(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function householdLabel(guest: MergeGuestHousehold) {
  const names = guest.people.map((person) => person.name).filter(Boolean);
  return names.slice(0, 3).join(" · ") || guest.id;
}

function exactSharedPersonCount(a: MergeGuestHousehold, b: MergeGuestHousehold) {
  let count = 0;
  for (const left of a.people) {
    const leftKey = normalizePersonName(left.name);
    if (!leftKey) continue;
    if (b.people.some((right) => normalizePersonName(right.name) === leftKey)) count += 1;
  }
  return count;
}

/** Strong overlap: require exact full-name matches (not first-name fuzzy). */
export function householdsShouldCluster(a: MergeGuestHousehold, b: MergeGuestHousehold) {
  return exactSharedPersonCount(a, b) >= 1;
}

function nonempty(value: string | null | undefined) {
  return Boolean(value?.trim());
}

export function detectHouseholdConflicts(
  winner: MergeGuestHousehold,
  loser: MergeGuestHousehold,
): string[] {
  const reasons: string[] = [];
  const winnerAddress = normalizeAddressKey(winner);
  const loserAddress = normalizeAddressKey(loser);
  if (winnerAddress && loserAddress && winnerAddress !== loserAddress) {
    reasons.push("different mailing addresses");
  }
  const winnerPhone = normalizePhoneKey(winner.phone);
  const loserPhone = normalizePhoneKey(loser.phone);
  if (winnerPhone && loserPhone && winnerPhone !== loserPhone) {
    reasons.push("different phone numbers");
  }
  return reasons;
}

export function pickMergeWinner(a: MergeGuestHousehold, b: MergeGuestHousehold): {
  winner: MergeGuestHousehold;
  loser: MergeGuestHousehold;
} {
  const score = (guest: MergeGuestHousehold) => {
    let points = 0;
    if (addressLine(guest)) points += 100;
    if (nonempty(guest.phone)) points += 20;
    points += guest.gifts.length * 10;
    points += guest.people.length;
    points -= guest.sortOrder * 0.001;
    return points;
  };
  return score(a) >= score(b) ? { winner: a, loser: b } : { winner: b, loser: a };
}

export function analyzeHouseholdMerges(guests: MergeGuestHousehold[]): HouseholdMergeAnalysis {
  const merges: MergePlan[] = [];
  const conflicts: MergeConflict[] = [];
  const used = new Set<string>();

  for (let i = 0; i < guests.length; i += 1) {
    const left = guests[i];
    if (used.has(left.id)) continue;
    for (let j = i + 1; j < guests.length; j += 1) {
      const right = guests[j];
      if (used.has(right.id)) continue;
      if (!householdsShouldCluster(left, right)) continue;

      const { winner, loser } = pickMergeWinner(left, right);
      const reasons = detectHouseholdConflicts(winner, loser);
      const label = `${householdLabel(winner)} ← ${householdLabel(loser)}`;
      if (reasons.length > 0) {
        conflicts.push({
          winnerId: winner.id,
          loserId: loser.id,
          reasons,
          label,
        });
        continue;
      }
      merges.push({ winnerId: winner.id, loserId: loser.id, label });
      used.add(loser.id);
    }
  }

  return { merges, conflicts };
}

export function mergePersonFields(
  winner: MergeGuestPerson,
  incoming: MergeGuestPerson,
): Omit<MergeGuestPerson, "id" | "sortOrder"> {
  const winnerRsvp = parseRsvpStatus(winner.rsvpStatus);
  const incomingRsvp = parseRsvpStatus(incoming.rsvpStatus);
  let rsvpStatus = winner.rsvpStatus;
  if (winnerRsvp === "pending" && incomingRsvp !== "pending") rsvpStatus = incoming.rsvpStatus;
  else if (winnerRsvp !== "pending" && incomingRsvp !== "pending" && winnerRsvp !== incomingRsvp) {
    // Prefer attending over not_attending when conflicted? Keep winner's explicit status.
    rsvpStatus = winner.rsvpStatus;
  }

  return {
    name: winner.name,
    directoryLabel: winner.directoryLabel?.trim() || incoming.directoryLabel,
    isDayOfContact: winner.isDayOfContact || incoming.isDayOfContact,
    rsvpStatus,
    photoData: winner.photoData?.trim() || incoming.photoData,
    tableNumber: winner.tableNumber ?? incoming.tableNumber,
    tableSpot: winner.tableSpot?.trim() || incoming.tableSpot,
  };
}

export function preferNonempty(a: string | null | undefined, b: string | null | undefined) {
  return a?.trim() || b?.trim() || null;
}

export function buildMergedHouseholdFields(winner: MergeGuestHousehold, loser: MergeGuestHousehold) {
  const peopleByKey = new Map<string, MergeGuestPerson>();
  for (const person of winner.people) {
    peopleByKey.set(normalizePersonName(person.name), person);
  }

  const loserPersonIdsToDelete: string[] = [];
  const loserPersonIdsToMove: string[] = [];

  for (const person of loser.people) {
    const key = normalizePersonName(person.name);
    const existingKey = [...peopleByKey.keys()].find((candidate) => candidate === key);
    if (existingKey) {
      const winnerPerson = peopleByKey.get(existingKey)!;
      peopleByKey.set(existingKey, {
        ...winnerPerson,
        ...mergePersonFields(winnerPerson, person),
        id: winnerPerson.id,
        sortOrder: winnerPerson.sortOrder,
      });
      loserPersonIdsToDelete.push(person.id);
    } else {
      peopleByKey.set(key, person);
      loserPersonIdsToMove.push(person.id);
    }
  }

  const people = [...peopleByKey.values()].map((person, index) => ({
    ...person,
    sortOrder: index,
  }));

  const gifts = [
    ...winner.gifts,
    ...loser.gifts.map((gift, index) => ({
      ...gift,
      sortOrder: winner.gifts.length + index,
    })),
  ];

  const summary = householdRsvpFromPeople(
    people.map((person) => ({ rsvp: parseRsvpStatus(person.rsvpStatus) })),
  );

  return {
    people,
    gifts,
    loserPersonIdsToDelete,
    loserPersonIdsToMove,
    household: {
      phone: preferNonempty(winner.phone, loser.phone),
      street: preferNonempty(winner.street, loser.street),
      city: preferNonempty(winner.city, loser.city),
      state: preferNonempty(winner.state, loser.state),
      zip: preferNonempty(winner.zip, loser.zip),
      rsvpStatus: summary.rsvpStatus,
      invitedCount: Math.max(summary.invitedCount, winner.invitedCount, loser.invitedCount),
      acceptedCount: summary.acceptedCount,
      ...syncLegacyGuestNames(people),
    },
  };
}

export type GuestMergeApplyResult = {
  merged: number;
  skippedConflicts: number;
  photosCopied: number;
  report: string[];
};
