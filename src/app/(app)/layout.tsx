import { Suspense } from "react";
import { AutoOfflineSync } from "@/components/AutoOfflineSync";
import { PreviewTimeControl } from "@/components/PreviewTimeControl";
import { V2BottomNav } from "@/components/V2BottomNav";
import { OfflineBanner } from "@/components/OfflineBanner";
import { prisma } from "@/lib/db";
import { canShowPreviewHarness } from "@/lib/preview-clock";
import { unreadRequestsWhere } from "@/lib/requests";
import { requirePageSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePageSession();

  const [unreadRequests, settings] = await Promise.all([
    session.canSeeRequests
      ? prisma.request.count({ where: unreadRequestsWhere(session) })
      : Promise.resolve(0),
    canShowPreviewHarness({ isMaster: session.isMaster })
      ? prisma.appSettings.findUnique({
          where: { id: 1 },
          select: { weddingDate: true, timezone: true },
        })
      : Promise.resolve(null),
  ]);

  const showPreview = canShowPreviewHarness({ isMaster: session.isMaster });

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <AutoOfflineSync />
      <OfflineBanner />
      {showPreview ? (
        <Suspense fallback={null}>
          <PreviewTimeControl
            weddingDateIso={settings?.weddingDate?.toISOString() ?? null}
            timezone={settings?.timezone ?? "America/Detroit"}
          />
        </Suspense>
      ) : null}
      <main id="main-content">{children}</main>
      <Suspense fallback={null}>
        <V2BottomNav session={session} unreadRequests={unreadRequests} />
      </Suspense>
    </div>
  );
}
