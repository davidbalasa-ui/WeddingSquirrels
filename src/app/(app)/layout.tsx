import { BottomNav } from "@/components/BottomNav";
import { mealsEditable } from "@/lib/access";
import { prisma } from "@/lib/db";
import { unreadRequestsWhere } from "@/lib/requests";
import { requirePageSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePageSession();

  let unreadRequests = 0;
  if (session.canSeeRequests) {
    unreadRequests = await prisma.request.count({
      where: unreadRequestsWhere(session),
    });
  }

  let dinnerVisible = mealsEditable(session);
  if (!dinnerVisible) {
    try {
      const settings = await prisma.mealSettings.findUnique({ where: { id: 1 } });
      dinnerVisible = Boolean(settings?.published);
    } catch {
      dinnerVisible = false;
    }
  }

  return (
    <div className="app-shell">
      {children}
      <BottomNav session={session} unreadRequests={unreadRequests} dinnerVisible={dinnerVisible} />
    </div>
  );
}
