import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
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
    if (!session[opts.need]) redirect("/today");
  }

  return session;
}
