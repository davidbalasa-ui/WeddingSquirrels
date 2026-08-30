import type { AccountModuleFlags } from "@/lib/types";

/** Toggle a flag and keep see↔edit flags consistent (pure, unit-testable). */
export function toggleAccountFlag(
  flags: AccountModuleFlags,
  key: keyof AccountModuleFlags,
  value: boolean,
): AccountModuleFlags {
  const next = { ...flags, [key]: value };

  // Edit flags auto-clear when the matching See is turned off.
  if (key === "canSeeBudget" && !value) next.canEditBudget = false;
  if (key === "canSeeTimeline" && !value) next.canEditTimeline = false;
  if (key === "canSeeDinner" && !value) {
    next.canEditDinner = false;
    next.canEditRehearsal = false;
  }

  // Edit without See → force See.
  if (key === "canEditBudget" && value) next.canSeeBudget = true;
  if (key === "canEditTimeline" && value) next.canSeeTimeline = true;
  if (key === "canEditDinner" && value) next.canSeeDinner = true;
  if (key === "canEditRehearsal" && value) next.canSeeDinner = true;

  // Account managers always run the dinner menu, so they keep the tab and dinner edit.
  if (key === "canManageAccounts" && value) {
    next.canSeeDinner = true;
    next.canEditDinner = true;
  }
  if (key === "canSeeDinner" && !value && next.canManageAccounts) next.canSeeDinner = true;

  return next;
}

/** Subset an account-shaped object to just the module flags. */
export function pickAccountFlags<T extends AccountModuleFlags>(flags: T): AccountModuleFlags {
  return {
    canSeeTasks: flags.canSeeTasks,
    canSeePeople: flags.canSeePeople,
    canSeeCalendar: flags.canSeeCalendar,
    canSeeShop: flags.canSeeShop,
    canSeeBudget: flags.canSeeBudget,
    canEditBudget: flags.canEditBudget,
    canSeeTimeline: flags.canSeeTimeline,
    canEditTimeline: flags.canEditTimeline,
    canSeeGuests: flags.canSeeGuests,
    canSeeRequests: flags.canSeeRequests,
    canSeeStay: flags.canSeeStay,
    canSeeDinner: flags.canSeeDinner,
    canEditDinner: flags.canEditDinner,
    canEditRehearsal: flags.canEditRehearsal,
    canManageAccounts: flags.canManageAccounts,
  };
}

/** How many flags differ between two states (e.g. current vs saved). */
export function flagDiffCount(
  baseline: AccountModuleFlags,
  current: AccountModuleFlags,
): number {
  let count = 0;
  for (const key of Object.keys(baseline) as (keyof AccountModuleFlags)[]) {
    if (baseline[key] !== current[key]) count += 1;
  }
  return count;
}

/** How many see/edit flags are turned on. */
export function flagEnabledCount(flags: AccountModuleFlags): number {
  let count = 0;
  for (const key of Object.keys(flags) as (keyof AccountModuleFlags)[]) {
    if (flags[key]) count += 1;
  }
  return count;
}

/** One-line effective-access summary for an account. */
export function accountSummaryLabel(
  account: AccountModuleFlags & { isMaster: boolean },
): string {
  if (account.isMaster) return "Master · full access";
  const parts = [
    account.canSeeTasks && "Tasks",
    account.canSeePeople && "People",
    account.canSeeShop && "Shop",
    account.canSeeBudget && (account.canEditBudget ? "Money (edit)" : "Money"),
    account.canSeeTimeline && (account.canEditTimeline ? "Day-of (edit)" : "Day-of"),
    account.canSeeGuests && "Guests",
    account.canSeeStay && "Stay",
    account.canSeeDinner &&
      (account.canEditRehearsal || account.canEditDinner
        ? `Rehearsal${account.canEditRehearsal ? " schedule" : ""}${account.canEditDinner ? " dinner" : ""}`
        : "Rehearsal"),
    account.canSeeRequests && "Requests",
    account.canManageAccounts && "Accounts",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "No modules";
}
