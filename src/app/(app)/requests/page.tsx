import { AppHeader } from "@/components/AppHeader";
import { RequestsBoard } from "@/components/RequestsBoard";
import { prisma } from "@/lib/db";
import { requestVisibilityWhere } from "@/lib/requests";
import { requirePageSession } from "@/lib/session";

export default async function RequestsPage() {
  const session = await requirePageSession({ need: "canSeeRequests" });

  const [rows, accounts, tasks] = await Promise.all([
    prisma.request.findMany({
      where: requestVisibilityWhere(session),
      include: {
        senderAccount: { select: { id: true, name: true } },
        recipientAccount: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
        messages: {
          orderBy: { sortOrder: "asc" },
          include: { authorAccount: { select: { id: true, name: true } } },
        },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.pinAccount.findMany({
      orderBy: [{ isMaster: "desc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.task.findMany({
      where: { parentId: null, orgKey: null },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  return (
    <>
      <AppHeader
        session={session}
        title="Ask"
        subtitle="Send asks, reply back and forth, and mark them done"
      />
      <RequestsBoard
        session={session}
        accounts={accounts}
        tasks={tasks}
        requests={rows.map((row) => ({
          id: row.id,
          title: row.title,
          note: row.note,
          status: row.status,
          senderAccountId: row.senderAccountId,
          recipientAccountId: row.recipientAccountId,
          senderName: row.senderAccount.name,
          recipientName: row.recipientAccount.name,
          taskId: row.taskId,
          taskTitle: row.task?.title ?? null,
          declineNote: row.declineNote,
          readAt: row.readAt?.toISOString() ?? null,
          senderReadAt: row.senderReadAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
          completedAt: row.completedAt?.toISOString() ?? null,
          declinedAt: row.declinedAt?.toISOString() ?? null,
          messages: row.messages.map((message) => ({
            id: message.id,
            body: message.body,
            authorAccountId: message.authorAccountId,
            authorName: message.authorAccount.name,
            createdAt: message.createdAt.toISOString(),
          })),
        }))}
      />
    </>
  );
}
