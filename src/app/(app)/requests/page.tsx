import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { RequestsBoard } from "@/components/RequestsBoard";
import type { RequestView } from "@/components/RequestCard";
import { prisma } from "@/lib/db";
import {
  canCompleteRequest,
  canDeclineRequest,
  canDeleteRequest,
  canEditRequest,
  canReopenRequest,
  requestVisibilityWhere,
} from "@/lib/requests";
import { requirePageSession } from "@/lib/session";

function toView(request: {
  id: string;
  title: string;
  note: string | null;
  status: string;
  senderAccountId: string;
  recipientAccountId: string;
  taskId: string | null;
  readAt: Date | null;
  completedAt: Date | null;
  declinedAt: Date | null;
  declineNote: string | null;
  createdAt: Date;
  senderAccount: { id: string; name: string };
  recipientAccount: { id: string; name: string };
  task: { id: string; title: string } | null;
}): RequestView {
  return {
    ...request,
    readAt: request.readAt?.toISOString() ?? null,
    completedAt: request.completedAt?.toISOString() ?? null,
    declinedAt: request.declinedAt?.toISOString() ?? null,
    createdAt: request.createdAt.toISOString(),
  };
}

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ closed?: string; taskId?: string }>;
}) {
  const session = await requirePageSession({ need: "canSeeRequests" });
  const sp = await searchParams;
  const showClosed = sp.closed === "1";
  const taskIdParam = sp.taskId?.trim() || undefined;

  const [rows, accounts, tasks] = await Promise.all([
    prisma.request.findMany({
      where: requestVisibilityWhere(session),
      include: {
        senderAccount: { select: { id: true, name: true } },
        recipientAccount: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.pinAccount.findMany({
      where: { id: { not: session.id } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.task.findMany({
      where: { parentId: null, orgKey: null },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  const views = rows.map(toView);
  const needsYou = views.filter(
    (r) => r.status === "open" && r.recipientAccountId === session.id,
  );
  const waitingOnOthers = views.filter(
    (r) => r.status === "open" && r.senderAccountId === session.id,
  );
  // Masters may see open asks between others — keep them in waiting for visibility.
  const otherOpen = session.isMaster
    ? views.filter(
        (r) =>
          r.status === "open" &&
          r.senderAccountId !== session.id &&
          r.recipientAccountId !== session.id,
      )
    : [];
  const closed = views.filter((r) => r.status === "done" || r.status === "declined");

  const caps = Object.fromEntries(
    views.map((request) => [
      request.id,
      {
        canEdit: canEditRequest(session, request),
        canComplete: canCompleteRequest(session, request),
        canDecline: canDeclineRequest(session, request),
        canReopen: canReopenRequest(session, request),
        canDelete: canDeleteRequest(session, request),
        isRecipient: request.recipientAccountId === session.id,
        isUnread:
          request.status === "open" &&
          request.readAt === null &&
          request.recipientAccountId === session.id,
      },
    ]),
  );

  const defaultTaskId =
    taskIdParam && tasks.some((t) => t.id === taskIdParam) ? taskIdParam : undefined;

  return (
    <>
      <AppHeader
        session={session}
        title="Ask"
        subtitle={`${needsYou.length} need you · PIN-to-PIN requests`}
      />
      <Suspense>
        <RequestsBoard
          needsYou={needsYou}
          waitingOnOthers={[...waitingOnOthers, ...otherOpen]}
          closed={closed}
          showClosed={showClosed}
          accounts={accounts}
          tasks={tasks}
          caps={caps}
          defaultTaskId={defaultTaskId}
        />
      </Suspense>
    </>
  );
}
