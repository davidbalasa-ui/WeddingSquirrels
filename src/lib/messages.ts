import { prisma } from "@/lib/db";
import { taskHref } from "@/lib/entity-links";
import {
  canCompleteRequest,
  canReopenRequest,
  canReplyToRequest,
  canViewRequest,
  isMessageNew,
  isRequestUnread,
  readMarkerFor,
  requestVisibilityWhere,
} from "@/lib/requests";
import type { SessionAccount } from "@/lib/types";

/** The conversation side of Ask: threads between two PIN accounts. */

export type ThreadAccount = { id: string; name: string };

export type ThreadMessageRow = {
  id: string;
  body: string;
  authorAccountId: string;
  authorAccount: ThreadAccount;
  createdAt: Date;
};

export type ThreadRow = {
  id: string;
  title: string;
  note: string | null;
  status: string;
  declineNote: string | null;
  senderAccountId: string;
  recipientAccountId: string;
  senderAccount: ThreadAccount;
  recipientAccount: ThreadAccount;
  readAt: Date | null;
  senderReadAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  taskId: string | null;
  task: { id: string; title: string } | null;
  messages: ThreadMessageRow[];
};

export type MessageThreadSummary = {
  id: string;
  title: string;
  status: string;
  /** Who the conversation is with, from this account's point of view. */
  withName: string;
  isParticipant: boolean;
  lastBody: string | null;
  lastAuthorName: string | null;
  lastFromMe: boolean;
  lastAt: string;
  unread: boolean;
  messageCount: number;
};

export type MessageThreadMessage = {
  id: string;
  body: string;
  authorAccountId: string;
  authorName: string;
  createdAt: string;
  mine: boolean;
  isNew: boolean;
};

export type MessageThreadView = {
  id: string;
  title: string;
  note: string | null;
  status: string;
  declineNote: string | null;
  withName: string;
  senderName: string;
  recipientName: string;
  isParticipant: boolean;
  unread: boolean;
  canReply: boolean;
  canComplete: boolean;
  canReopen: boolean;
  linkedTaskHref: string | null;
  linkedTaskTitle: string | null;
  createdAt: string;
  messages: MessageThreadMessage[];
};

export const threadInclude = {
  senderAccount: { select: { id: true, name: true } },
  recipientAccount: { select: { id: true, name: true } },
  task: { select: { id: true, title: true } },
  messages: {
    orderBy: { sortOrder: "asc" as const },
    include: { authorAccount: { select: { id: true, name: true } } },
  },
};

export function threadCounterpartName(
  session: Pick<SessionAccount, "id">,
  row: Pick<ThreadRow, "senderAccountId" | "recipientAccountId" | "senderAccount" | "recipientAccount">,
): string {
  if (row.senderAccountId === session.id) return row.recipientAccount.name;
  if (row.recipientAccountId === session.id) return row.senderAccount.name;
  return `${row.senderAccount.name} → ${row.recipientAccount.name}`;
}

export function summarizeThread(session: SessionAccount, row: ThreadRow): MessageThreadSummary {
  const last = row.messages[row.messages.length - 1] ?? null;
  const isParticipant = row.senderAccountId === session.id || row.recipientAccountId === session.id;
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    withName: threadCounterpartName(session, row),
    isParticipant,
    lastBody: last?.body ?? row.note ?? null,
    lastAuthorName: last ? last.authorAccount.name : row.senderAccount.name,
    lastFromMe: last ? last.authorAccountId === session.id : row.senderAccountId === session.id,
    lastAt: (last?.createdAt ?? row.updatedAt).toISOString(),
    unread: isRequestUnread(session, row),
    messageCount: row.messages.length,
  };
}

/** Newest activity first; unread threads do not jump the queue, time does. */
export function sortThreadSummaries(threads: MessageThreadSummary[]): MessageThreadSummary[] {
  return [...threads].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export function viewThread(session: SessionAccount, row: ThreadRow): MessageThreadView {
  const isParticipant = row.senderAccountId === session.id || row.recipientAccountId === session.id;
  const marker = readMarkerFor(session, row);
  return {
    id: row.id,
    title: row.title,
    note: row.note,
    status: row.status,
    declineNote: row.declineNote,
    withName: threadCounterpartName(session, row),
    senderName: row.senderAccount.name,
    recipientName: row.recipientAccount.name,
    isParticipant,
    unread: isRequestUnread(session, row),
    canReply: canReplyToRequest(session, row),
    canComplete: canCompleteRequest(session, row),
    canReopen: canReopenRequest(session, row),
    linkedTaskHref: row.task ? taskHref(row.task.id, { returnTo: `/messages/${row.id}` }) : null,
    linkedTaskTitle: row.task?.title ?? null,
    createdAt: row.createdAt.toISOString(),
    messages: row.messages.map((message) => ({
      id: message.id,
      body: message.body,
      authorAccountId: message.authorAccountId,
      authorName: message.authorAccount.name,
      createdAt: message.createdAt.toISOString(),
      mine: message.authorAccountId === session.id,
      // Only a participant has a read position; an outsider never sees "new".
      isNew: isParticipant && isMessageNew(session, marker, message),
    })),
  };
}

export async function listMessageThreads(session: SessionAccount): Promise<MessageThreadSummary[]> {
  if (!session.canSeeRequests) return [];
  const rows = await prisma.request.findMany({
    where: requestVisibilityWhere(session),
    include: threadInclude,
    orderBy: { updatedAt: "desc" },
  });
  return sortThreadSummaries(rows.map((row) => summarizeThread(session, row)));
}

export async function loadMessageThread(
  session: SessionAccount,
  requestId: string,
): Promise<MessageThreadView | null> {
  if (!session.canSeeRequests) return null;
  const row = await prisma.request.findUnique({ where: { id: requestId }, include: threadInclude });
  if (!row || !canViewRequest(session, row)) return null;
  return viewThread(session, row);
}

export type ThreadRecipient = { id: string; name: string };

export async function listThreadRecipients(session: SessionAccount): Promise<ThreadRecipient[]> {
  const accounts = await prisma.pinAccount.findMany({
    select: { id: true, name: true },
    orderBy: [{ isMaster: "desc" }, { name: "asc" }],
  });
  return accounts.filter((account) => account.id !== session.id);
}
