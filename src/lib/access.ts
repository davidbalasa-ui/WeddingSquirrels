import type { SessionAccount } from "@/lib/types";

export type Permission = keyof Pick<
  SessionAccount,
  | "canSeeTasks"
  | "canSeeBudget"
  | "canSeeGuests"
  | "canSeeTimeline"
  | "canSeeShop"
  | "canSeeCalendar"
  | "canSeePeople"
  | "canSeeRequests"
  | "canEditBudget"
  | "canEditTimeline"
  | "canManageAccounts"
>;

export function can(session: SessionAccount, perm: Permission): boolean {
  return Boolean(session[perm]);
}

export function assertCan(session: SessionAccount, perm: Permission): void {
  if (!can(session, perm)) throw new Error("FORBIDDEN");
}

/** Money edits: masters always; others need canEditBudget. */
export function moneyEditable(session: SessionAccount): boolean {
  return session.isMaster || session.canEditBudget;
}

/** Day-of timeline edits: masters always; others need canEditTimeline. */
export function timelineEditable(session: SessionAccount): boolean {
  return session.isMaster || session.canEditTimeline;
}
