import type { SessionAccount } from "@/lib/types";

export type AccessPerm =
  | "canSeeTasks"
  | "canSeeBudget"
  | "canSeeGuests"
  | "canSeeTimeline"
  | "canManageAccounts"
  | "canSeeShop"
  | "canSeeCalendar"
  | "canSeePeople"
  | "canSeeRequests";

export function can(session: SessionAccount, perm: AccessPerm): boolean {
  if (session.isMaster) return true;
  return Boolean(session[perm]);
}

export function assertCan(session: SessionAccount, perm: AccessPerm): void {
  if (!can(session, perm)) throw new Error("FORBIDDEN");
}

export function moneyEditable(session: SessionAccount): boolean {
  return session.isMaster || session.canEditBudget;
}

export function timelineEditable(session: SessionAccount): boolean {
  return session.isMaster || session.canEditTimeline;
}

export function canManageAccounts(session: SessionAccount): boolean {
  return session.isMaster || session.canManageAccounts;
}

export function mealsEditable(session: SessionAccount): boolean {
  return session.isMaster || session.canManageAccounts;
}

/** Couple-only owner/payer ids used by Money. */
export function parseCouplePersonId(raw: string): string | null {
  return raw === "david" || raw === "haley" ? raw : null;
}

/** If edit is on, force the matching see flag on. */
export function normalizeAccountFlags<T extends {
  canSeeBudget: boolean;
  canEditBudget: boolean;
  canSeeTimeline: boolean;
  canEditTimeline: boolean;
}>(flags: T): T {
  return {
    ...flags,
    canSeeBudget: flags.canSeeBudget || flags.canEditBudget,
    canSeeTimeline: flags.canSeeTimeline || flags.canEditTimeline,
  };
}
