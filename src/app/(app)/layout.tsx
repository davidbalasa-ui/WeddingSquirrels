import { V2BottomNav } from "@/components/V2BottomNav";
import { OfflineBanner } from "@/components/OfflineBanner";
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

  return (
    <div className="app-shell">
      <OfflineBanner />
      {children}
      <V2BottomNav session={session} unreadRequests={unreadRequests} />
    </div>
  );
}
