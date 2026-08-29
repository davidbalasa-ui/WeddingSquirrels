import { redirect } from "next/navigation";
import { canSeeDinnerTab } from "@/lib/access";
import { canSeeHome } from "@/lib/inbox";
import { getSession } from "@/lib/auth";
import { firstAllowedRoute } from "@/lib/routes";
import type { SessionAccount } from "@/lib/types";

type NeedKey = keyof Pick<
  SessionAccount,
  | "canSeeTasks"
  | "canSeeBudget"
  | "canSeeGuests"
  | "canSeeTimeline"
  | "canManageAccounts"
  | "canSeeShop"
  | "canSeeCalendar"
  | "canSeePeople"
  | "canSeeRequests"
  | "canSeeStay"
  | "canSeeDinner"
>;

export async function requirePageSession(opts?: { need?: NeedKey }) {
  const session = await getSession();
  if (!session) redirect("/");

  if (opts?.need) {
    if (session.isMaster) return session;
    const allowed =
      opts.need === "canSeeDinner" ? canSeeDinnerTab(session) : Boolean(session[opts.need]);
    if (!allowed) {
      redirect(firstAllowedRoute(session) ?? "/no-access");
    }
  }

  return session;
}

export async function requireHomeSession() {
  const session = await getSession();
  if (!session) redirect("/");

  if (!canSeeHome(session)) {
    redirect(firstAllowedRoute(session) ?? "/no-access");
  }

  return session;
}
