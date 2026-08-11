import { BottomNav } from "@/components/BottomNav";
import { prisma } from "@/lib/db";
import { unreadRequestsWhere } from "@/lib/requests";
import { requirePageSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePageSession();

  const unreadRequests =
    session.canSeeRequests
      ? await prisma.request.count({ where: unreadRequestsWhere(session) })
      : 0;

  return (
    <div className="app-shell">
      {children}
      <BottomNav session={session} unreadRequests={unreadRequests} />
    </div>
  );
}
