import { canManageAccounts, canSeeDinnerTab } from "@/lib/access";
import type { SessionAccount } from "@/lib/types";

export type AppRoute = {
  href: string;
  need: keyof SessionAccount | "canManageAccounts" | "canSeeDinner";
};

/** Main app tabs in bottom-nav order. */
export const APP_ROUTES: AppRoute[] = [
  { href: "/today", need: "canSeeTasks" },
  { href: "/people", need: "canSeePeople" },
  { href: "/calendar", need: "canSeeCalendar" },
  { href: "/shop", need: "canSeeShop" },
  { href: "/requests", need: "canSeeRequests" },
  { href: "/money", need: "canSeeBudget" },
  { href: "/stay", need: "canSeeStay" },
  { href: "/dinner", need: "canSeeDinner" },
  { href: "/day", need: "canSeeTimeline" },
  { href: "/guests", need: "canSeeGuests" },
  { href: "/accounts", need: "canManageAccounts" },
];

export function canSeeRoute(session: SessionAccount, route: AppRoute): boolean {
  if (session.isMaster) return true;
  if (route.need === "canManageAccounts") return canManageAccounts(session);
  if (route.need === "canSeeDinner") return canSeeDinnerTab(session);
  return Boolean(session[route.need]);
}

export function firstAllowedRoute(session: SessionAccount): string | null {
  if (session.isMaster) return "/today";
  for (const route of APP_ROUTES) {
    if (canSeeRoute(session, route)) return route.href;
  }
  return null;
}
