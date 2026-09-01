import { canManageAccounts, canSeeDinnerTab } from "@/lib/access";
import { canSeeHome } from "@/lib/inbox";
import type { AccountModuleFlags, SessionAccount } from "@/lib/types";

/** V2 primary navigation tab. */
export type NavTab = "today" | "plan" | "people" | "money" | "more";

/** Icon name for a module — keep in sync with ModuleIcon.tsx. */
export type ModuleIconName =
  | "tasks"
  | "day"
  | "ask"
  | "guests"
  | "people"
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
  /** V2 bottom-nav tab this module belongs to. */
  navTab: NavTab;
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
  {
    key: "home",
    label: "Today",
    href: "/today",
    group: "plan",
    navTab: "today",
    primary: true,
    badge: "unread",
    icon: "tasks",
  },
  {
    key: "dayof",
    label: "Day-of",
    href: "/day",
    group: "wedding",
    navTab: "plan",
    see: "canSeeTimeline",
    primary: true,
    icon: "day",
  },
  {
    key: "guests",
    label: "Guests",
    href: "/guests",
    group: "wedding",
    navTab: "people",
    see: "canSeeGuests",
    primary: true,
    icon: "guests",
  },
  {
    key: "tasks",
    label: "Tasks",
    href: "/plan/tasks",
    group: "plan",
    navTab: "plan",
    see: "canSeeTasks",
    hideFromMore: true,
    icon: "tasks",
  },
  {
    key: "requests",
    label: "Ask",
    href: "/requests",
    group: "comm",
    navTab: "today",
    see: "canSeeRequests",
    hideFromMore: true,
    icon: "ask",
  },
  {
    key: "people",
    label: "People",
    href: "/people",
    group: "plan",
    navTab: "people",
    see: "canSeePeople",
    hideFromMore: true,
    icon: "people",
  },
  {
    key: "shop",
    label: "Shopping",
    href: "/plan/shopping",
    group: "plan",
    navTab: "plan",
    see: "canSeeShop",
    hideFromMore: true,
    icon: "shop",
  },
  {
    key: "money",
    label: "Money",
    href: "/money",
    group: "money",
    navTab: "money",
    see: "canSeeBudget",
    edit: "canEditBudget",
    icon: "money",
  },
  {
    key: "stay",
    label: "Stay",
    href: "/stay",
    group: "wedding",
    navTab: "plan",
    see: "canSeeStay",
    icon: "stay",
  },
  {
    key: "rehearsal",
    label: "Rehearsal",
    href: "/rehearsal",
    group: "wedding",
    navTab: "plan",
    see: "canSeeDinner",
    icon: "rehearsal",
  },
  {
    key: "dinner",
    label: "Dinner",
    group: "wedding",
    navTab: "plan",
    edit: "canEditDinner",
    icon: "dinner",
  },
  {
    key: "accounts",
    label: "Accounts",
    href: "/accounts",
    group: "admin",
    navTab: "more",
    see: "canManageAccounts",
    icon: "accounts",
  },
];

/** V2 bottom navigation tabs in display order. */
export const NAV_TABS: { tab: NavTab; label: string; href: string; icon: ModuleIconName }[] = [
  { tab: "today", label: "Today", href: "/today", icon: "tasks" },
  { tab: "plan", label: "Plan", href: "/plan", icon: "day" },
  { tab: "people", label: "People", href: "/people", icon: "people" },
  { tab: "money", label: "Money", href: "/money", icon: "money" },
  { tab: "more", label: "More", href: "/more", icon: "more" },
];

/** Path prefixes that belong to each V2 nav tab (for active-state detection). */
export const NAV_TAB_PREFIXES: Record<NavTab, string[]> = {
  today: ["/today", "/home", "/work"],
  plan: ["/plan", "/day", "/rehearsal", "/stay", "/shop", "/calendar"],
  people: ["/people", "/guests"],
  money: ["/money"],
  more: ["/more", "/accounts", "/offline"],
};

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

/** Whether a V2 bottom-nav tab is visible for this session. */
export function canSeeNavTab(session: SessionAccount, tab: NavTab): boolean {
  if (session.isMaster) return true;
  if (tab === "more") return true;
  if (tab === "today") return canSeeHome(session);
  if (tab === "money") return Boolean(session.canSeeBudget);
  return MODULES.some((m) => m.navTab === tab && canSeeModule(session, m));
}

export function isNavTabActive(pathname: string, tab: NavTab): boolean {
  return NAV_TAB_PREFIXES[tab].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
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

/** Modules visible under a V2 hub tab (for placeholder hub link lists). */
export function modulesForNavTab(session: SessionAccount, tab: NavTab): ModuleDef[] {
  return MODULES.filter((m) => m.navTab === tab && m.href && canSeeModule(session, m));
}
