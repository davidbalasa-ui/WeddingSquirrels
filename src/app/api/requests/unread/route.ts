import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { unreadRequestsWhere } from "@/lib/requests";

export const dynamic = "force-dynamic";

export type UnreadAsksPayload = {
  count: number;
  latest: {
    /** Stable id for "already shown" tracking on the client. */
    key: string;
    requestId: string;
    title: string;
    fromName: string;
    body: string;
    at: string;
  } | null;
};

/** Live unread count for the bottom-nav badge and the new-message toast. */
export async function GET() {
  const session = await getSession();
  if (!session || !session.canSeeRequests) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const where = unreadRequestsWhere(session);
  const [count, latestMessage, latestBareAsk] = await Promise.all([
    prisma.request.count({ where }),
    prisma.requestMessage.findFirst({
      where: { authorAccountId: { not: session.id }, request: where },
      orderBy: { createdAt: "desc" },
      include: {
        authorAccount: { select: { name: true } },
        request: { select: { id: true, title: true } },
      },
    }),
    prisma.request.findFirst({
      where: { ...where, senderAccountId: { not: session.id }, messages: { none: {} } },
      orderBy: { createdAt: "desc" },
      include: { senderAccount: { select: { name: true } } },
    }),
  ]);

  const fromMessage = latestMessage
    ? {
        key: `message:${latestMessage.id}`,
        requestId: latestMessage.request.id,
        title: latestMessage.request.title,
        fromName: latestMessage.authorAccount.name,
        body: latestMessage.body,
        at: latestMessage.createdAt.toISOString(),
      }
    : null;
  const fromAsk = latestBareAsk
    ? {
        key: `ask:${latestBareAsk.id}`,
        requestId: latestBareAsk.id,
        title: latestBareAsk.title,
        fromName: latestBareAsk.senderAccount.name,
        body: latestBareAsk.title,
        at: latestBareAsk.createdAt.toISOString(),
      }
    : null;
  const latest =
    fromMessage && fromAsk ? (fromMessage.at >= fromAsk.at ? fromMessage : fromAsk) : fromMessage ?? fromAsk;

  const payload: UnreadAsksPayload = { count, latest };
  return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
}
