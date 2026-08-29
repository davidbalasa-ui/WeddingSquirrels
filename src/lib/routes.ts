import { canManageAccounts, canSeeDinnerTab } from "@/lib/access";
import { canSeeHome } from "@/lib/inbox";
import { MODULES } from "@/lib/modules";
import type { SessionAccount } from "@/lib/types";

export type AppRoute = {
  href: string;
  need: keyof SessionAccount | "canManageAccounts" | "canSeeDinner" | "canSeeHome";
};

/** Main app tabs in bottom-nav order (derived from the module registry). */
export const APP_ROUTES: AppRoute[] = MODULES.filter((m) => m.href).map((m) => ({
  href: m.href!,
  need:
    m.key === "home"
      ? "canSeeHome"
      : m.key === "accounts"
        ? "canManageAccounts"
        : m.key === "rehearsal"
          ? "canSeeDinner"
          : (m.see ?? "canSeeTasks"),
}));

const SKIP_FIRST_ROUTE = new Set(["/today", "/requests", "/shop", "/people"]);

export function canSeeRoute(session: SessionAccount, route: AppRoute): boolean {
  if (session.isMaster) return true;
  if (route.need === "canSeeHome") return canSeeHome(session);
  if (route.need === "canManageAccounts") return canManageAccounts(session);
  if (route.need === "canSeeDinner") return canSeeDinnerTab(session);
  return Boolean(session[route.need]);
}

export function firstAllowedRoute(session: SessionAccount): string | null {
  if (canSeeHome(session)) return "/home";
  for (const route of APP_ROUTES) {
    if (SKIP_FIRST_ROUTE.has(route.href)) continue;
    if (canSeeRoute(session, route)) return route.href;
  }
  return null;
}
