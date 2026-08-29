import { canManageAccounts, canSeeDinnerTab } from "@/lib/access";
import { canSeeHome } from "@/lib/inbox";
import type { AccountModuleFlags, SessionAccount } from "@/lib/types";

/** Icon name for a module — keep in sync with ModuleIcon.tsx. */
export type ModuleIconName =
  | "tasks"
  | "day"
  | "ask"
  | "guests"
  | "people"
  | "calendar"
  | "shop"
  | "money"
  | "stay"
  | "rehearsal"
  | "dinner"
  | "accounts"
  | "more";

export type ModuleGroup = "plan" | "money" | "wedding" | "comm" | "admin";

export type ModuleDef = {
  key: string;
  label: string;
  href?: string;
  group: ModuleGroup;
  see?: keyof AccountModuleFlags;
  edit?: keyof AccountModuleFlags;
  /** Pinned to the bottom bar instead of the More sheet. */
  primary?: boolean;
  /** Keep the route; hide the More-sheet link (redirects still work). */
  hideFromMore?: boolean;
  badge?: "unread";
  icon: ModuleIconName;
};

/** Every app module — single source of truth for nav, routes, and permissions. */
export const MODULES: ModuleDef[] = [
  { key: "home", label: "Home", href: "/home", group: "plan", primary: true, badge: "unread", icon: "tasks" },
  { key: "dayof", label: "Day-of", href: "/day", group: "wedding", see: "canSeeTimeline", primary: true, icon: "day" },
  { key: "guests", label: "Guests", href: "/guests", group: "wedding", see: "canSeeGuests", primary: true, icon: "guests" },
  { key: "tasks", label: "Today", href: "/today", group: "plan", see: "canSeeTasks", hideFromMore: true, icon: "tasks" },
  { key: "requests", label: "Ask", href: "/requests", group: "comm", see: "canSeeRequests", hideFromMore: true, icon: "ask" },
  { key: "people", label: "People", href: "/people", group: "plan", see: "canSeePeople", hideFromMore: true, icon: "people" },
  { key: "calendar", label: "Calendar", href: "/calendar", group: "plan", see: "canSeeCalendar", icon: "calendar" },
  { key: "shop", label: "Shop", href: "/shop", group: "plan", see: "canSeeShop", hideFromMore: true, icon: "shop" },
  { key: "money", label: "Money", href: "/money", group: "money", see: "canSeeBudget", edit: "canEditBudget", icon: "money" },
  { key: "stay", label: "Stay", href: "/stay", group: "wedding", see: "canSeeStay", icon: "stay" },
  { key: "rehearsal", label: "Rehearsal", href: "/rehearsal", group: "wedding", see: "canSeeDinner", icon: "rehearsal" },
  { key: "dinner", label: "Dinner", group: "wedding", edit: "canEditDinner", icon: "dinner" },
  { key: "accounts", label: "Accounts", href: "/accounts", group: "admin", see: "canManageAccounts", icon: "accounts" },
];

/** Order groups render in, in both the permission grid and the More sheet. */
export const GROUP_ORDER: ModuleGroup[] = ["plan", "money", "wedding", "comm", "admin"];

/** Labels used by the permission grid. */
export const GROUP_LABELS: Record<ModuleGroup, string> = {
  plan: "Planning",
  money: "Money",
  wedding: "Wedding",
  comm: "Comm",
  admin: "Admin",
};

/** Labels used by the More sheet (money folds into Plan). */
export const NAV_GROUP_LABELS: Record<ModuleGroup, string> = {
  plan: "Plan",
  money: "Plan",
  wedding: "Wedding",
  comm: "Comm",
  admin: "Admin",
};

export function canSeeModule(session: SessionAccount, module: ModuleDef): boolean {
  if (session.isMaster) return true;
  if (!module.href) return false;
  if (module.key === "home") return canSeeHome(session);
  if (module.key === "accounts") return canManageAccounts(session);
  if (module.key === "rehearsal") return canSeeDinnerTab(session);
  return module.see ? Boolean(session[module.see]) : false;
}

/** Modules pinned to the bottom bar. */
export function primaryModules(session: SessionAccount): ModuleDef[] {
  return MODULES.filter((m) => m.primary && canSeeModule(session, m));
}

export type MoreGroup = { group: ModuleGroup; label: string; items: ModuleDef[] };

/** Non-primary modules grouped for the More sheet. */
export function moreGroups(session: SessionAccount): MoreGroup[] {
  const result: MoreGroup[] = [];
  for (const group of GROUP_ORDER) {
    const items = MODULES.filter(
      (m) => m.href && !m.primary && !m.hideFromMore && m.group === group && canSeeModule(session, m),
    );
    if (items.length) result.push({ group, label: NAV_GROUP_LABELS[group], items });
  }
  return result;
}

/** Permission-grid rows (includes permission-only modules like Dinner). */
export function permissionModules(group: ModuleGroup): ModuleDef[] {
  return MODULES.filter((m) => m.group === group && (m.see || m.edit));
}
