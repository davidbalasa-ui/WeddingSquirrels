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

/** Account admin: masters always; others need canManageAccounts. */
export function canManageAccounts(session: SessionAccount): boolean {
  return session.isMaster || session.canManageAccounts;
}

/**
 * Normalize module flags before write.
 * - Edit implies See for Money / Day-of
 * - Edit flags clear when corresponding See is off (UI should also enforce)
 */
export function normalizeAccountFlags<T extends {
  canSeeBudget: boolean;
  canEditBudget: boolean;
  canSeeTimeline: boolean;
  canEditTimeline: boolean;
}>(flags: T): T {
  const canEditBudget = flags.canSeeBudget ? flags.canEditBudget : false;
  const canEditTimeline = flags.canSeeTimeline ? flags.canEditTimeline : false;
  return {
    ...flags,
    canSeeBudget: canEditBudget ? true : flags.canSeeBudget,
    canEditBudget,
    canSeeTimeline: canEditTimeline ? true : flags.canSeeTimeline,
    canEditTimeline,
  };
}

