import { namesMatch, normalizePersonName, profileIdForContact, profileIdForPerson } from "@/lib/people-directory";
import { contractRemaining, formatMoney } from "@/lib/money";

export type ProfileRelatedLink = {
  label: string;
  href: string;
  detail: string;
};

export type ProfileBudgetContract = {
  id: string;
  name: string;
  remaining: number;
  href: string;
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

/** Vendor CRM names often include a role after a middle dot. */
export function vendorPrimaryName(name: string): string {
  const primary = name.split("·")[0]?.trim();
  return primary || name.trim();
}

export function budgetMatchesName(budgetName: string, candidateName: string): boolean {
  const budget = normalizePersonName(vendorPrimaryName(budgetName));
  const candidate = normalizePersonName(vendorPrimaryName(candidateName));
  if (!budget || !candidate) return false;
  if (budget === candidate) return true;
  return namesMatch(budget, candidate);
}

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

export function moneyContractHref(contractId: string) {
  return `/money?contract=${encodeURIComponent(contractId)}`;
}

export function profileHref(profileId: string) {
  return `/people/${encodeURIComponent(profileId)}`;
}

export function budgetContractsForPerson(
  person: ConnectionPerson,
  items: ConnectionBudgetItem[],
): ProfileBudgetContract[] {
  return items
    .filter(
      (item) =>
        item.ownerId === person.id ||
        item.paidById === person.id ||
        budgetMatchesName(item.name, person.name),
    )
    .map((item) => ({
      id: item.id,
      name: item.name,
      remaining: contractRemaining(item),
      href: moneyContractHref(item.id),
    }));
}

export function budgetContractsForContact(
  contact: ConnectionContact,
  items: ConnectionBudgetItem[],
): ProfileBudgetContract[] {
  return items
    .filter((item) => budgetMatchesName(item.name, contact.name))
    .map((item) => ({
      id: item.id,
      name: item.name,
      remaining: contractRemaining(item),
      href: moneyContractHref(item.id),
    }));
}

export function buildProfileRelatedLinks(input: {
  guestInfo?: boolean;
  stayLabel?: string | null;
  mealStatus?: string | null;
  assignments?: number;
  budgetContracts?: ProfileBudgetContract[];
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
  if ((input.assignments ?? 0) > 0) {
    links.push({
      label: "Responsibilities",
      href: "/people/responsibilities",
      detail: `${input.assignments} day-of assignment${input.assignments === 1 ? "" : "s"}`,
    });
  }
  if (input.budgetContracts?.length) {
    const totalRemaining = input.budgetContracts.reduce((sum, row) => sum + row.remaining, 0);
    links.push({
      label: "Money",
      href: input.budgetContracts[0]!.href,
      detail:
        input.budgetContracts.length === 1
          ? `${input.budgetContracts[0]!.name} · ${formatMoney(totalRemaining)} left`
          : `${input.budgetContracts.length} contracts · ${formatMoney(totalRemaining)} left`,
    });
  }

  return links;
}
