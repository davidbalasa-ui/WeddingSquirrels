import { namesMatch, normalizePersonName, profileIdForContact, profileIdForPerson } from "@/lib/people-directory";
import { contractRemaining, formatMoney } from "@/lib/money";
import { moneyHref } from "@/lib/entity-links";

export type ProfileRelatedLink = {
  label: string;
  href: string;
  detail: string;
};

export type PersonBudgetRole = "owner" | "paying" | "owner_and_paying";

export type ProfileBudgetContract = {
  id: string;
  name: string;
  remaining: number;
  href: string;
  role: PersonBudgetRole;
};

export type ConnectionContact = {
  id: string;
  name: string;
};

export type ConnectionPerson = {
  id: string;
  name: string;
};

export type ConnectionBudgetItem = {
  id: string;
  name: string;
  price: number;
  amountPaid: number;
  ownerId: string | null;
  paidById: string | null;
};

export {
  calendarHref,
  dayAssignmentHref,
  moneyHref as moneyContractHref,
  peopleProfileHref as profileHref,
  personProfileHref,
  requestHref,
  taskHref,
  timelineHref,
} from "@/lib/entity-links";

/** Vendor CRM names often include a role after a middle dot. Display helper only. */
export function vendorPrimaryName(name: string): string {
  const primary = name.split("·")[0]?.trim();
  return primary || name.trim();
}

/** Name similarity helper. Never use this to present a relationship as linked. */
export function budgetMatchesName(budgetName: string, candidateName: string): boolean {
  const budget = normalizePersonName(vendorPrimaryName(budgetName));
  const candidate = normalizePersonName(vendorPrimaryName(candidateName));
  if (!budget || !candidate) return false;
  if (budget === candidate) return true;
  return namesMatch(budget, candidate);
}

/** Name lookup helper. Do not use for Money ↔ People navigation. */
export function findProfileIdForBudgetName(
  budgetName: string,
  contacts: ConnectionContact[],
  persons: ConnectionPerson[],
): string | null {
  const contact = contacts.find((row) => budgetMatchesName(budgetName, row.name));
  if (contact) return profileIdForContact(contact.id);

  const person = persons.find((row) => budgetMatchesName(budgetName, row.name));
  if (person) return profileIdForPerson(person.id);

  return null;
}

export function personBudgetRole(
  personId: string,
  item: Pick<ConnectionBudgetItem, "ownerId" | "paidById">,
): PersonBudgetRole | null {
  const owner = item.ownerId === personId;
  const paying = item.paidById === personId;
  if (owner && paying) return "owner_and_paying";
  if (paying) return "paying";
  if (owner) return "owner";
  return null;
}

export function budgetRoleLabel(role: PersonBudgetRole): string {
  if (role === "paying") return "Paying";
  if (role === "owner_and_paying") return "Owner · Paying";
  return "Owner";
}

export function budgetContractsForPerson(
  person: ConnectionPerson,
  items: ConnectionBudgetItem[],
): ProfileBudgetContract[] {
  const rows: ProfileBudgetContract[] = [];
  for (const item of items) {
    const role = personBudgetRole(person.id, item);
    if (!role) continue;
    rows.push({
      id: item.id,
      name: item.name,
      remaining: contractRemaining(item),
      href: moneyHref(item.id),
      role,
    });
  }
  return rows;
}

/** Contact has no BudgetItem FK. Name matches are not relationships. */
export function budgetContractsForContact(
  _contact: ConnectionContact,
  _items: ConnectionBudgetItem[],
): ProfileBudgetContract[] {
  return [];
}

export function buildProfileRelatedLinks(input: {
  guestInfo?: boolean;
  stayLabel?: string | null;
  mealStatus?: string | null;
}): ProfileRelatedLink[] {
  const links: ProfileRelatedLink[] = [];

  if (input.guestInfo) {
    links.push({ label: "Guest list", href: "/people", detail: "RSVP and household details" });
  }
  if (input.stayLabel) {
    links.push({ label: "Stay", href: "/stay", detail: input.stayLabel });
  }
  if (input.mealStatus) {
    links.push({
      label: "Rehearsal dinner",
      href: "/rehearsal",
      detail: input.mealStatus,
    });
  }

  return links;
}

export function formatBudgetContractDetail(contract: ProfileBudgetContract): string {
  const remaining =
    contract.remaining > 0 ? `${formatMoney(contract.remaining)} remaining` : "Paid in full";
  return `${budgetRoleLabel(contract.role)} · ${remaining}`;
}

