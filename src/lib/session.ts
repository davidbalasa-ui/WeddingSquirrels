import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import type { SessionAccount } from "@/lib/types";

export async function requirePageSession(opts?: {
  need?: keyof Pick<
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
}) {
  const session = await getSession();
  if (!session) redirect("/");
  if (opts?.need && !session[opts.need] && !(opts.need === "canManageAccounts" && session.isMaster)) {
    redirect("/today");
  }
  return session;
}
