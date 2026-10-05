import type { SessionAccount } from "@/lib/types";

export type RequestRow = {
  id: string;
  status: string;
  senderAccountId: string;
  recipientAccountId: string;
  readAt: Date | null;
  senderReadAt?: Date | null;
};

export function requestVisibilityWhere(session: SessionAccount) {
  if (session.isMaster) return {};
  return {
    OR: [{ senderAccountId: session.id }, { recipientAccountId: session.id }],
  };
}

/** Threads with activity this account has not seen yet, whatever their status. */
export function unreadRequestsWhere(session: SessionAccount) {
  return {
    OR: [
      { recipientAccountId: session.id, readAt: null },
      { senderAccountId: session.id, senderReadAt: null },
    ],
  };
}

/** Unread is per participant. Masters can open any thread but are only "unread" on their own. */
export function isRequestUnread(session: SessionAccount, row: RequestRow) {
  if (row.recipientAccountId === session.id) return !row.readAt;
  if (row.senderAccountId === session.id) return !row.senderReadAt;
  return false;
}

/** When this account last read the thread. Null when never read, or not a participant. */
export function readMarkerFor(
  session: SessionAccount,
  row: Pick<RequestRow, "senderAccountId" | "recipientAccountId" | "readAt" | "senderReadAt">,
): Date | null {
  if (row.recipientAccountId === session.id) return row.readAt;
  if (row.senderAccountId === session.id) return row.senderReadAt ?? null;
  return null;
}

/** A message from someone else that landed after this account last read the thread. */
export function isMessageNew(
  session: Pick<SessionAccount, "id">,
  readMarker: Date | null,
  message: { authorAccountId: string; createdAt: Date },
): boolean {
  if (message.authorAccountId === session.id) return false;
  if (!readMarker) return true;
  return message.createdAt.getTime() > readMarker.getTime();
}

export function canViewRequest(session: SessionAccount, row: RequestRow) {
  return (
    session.isMaster ||
    row.senderAccountId === session.id ||
    row.recipientAccountId === session.id
  );
}

/** Conversations stay open for replies even after the ask itself is done or declined. */
export function canReplyToRequest(session: SessionAccount, row: RequestRow) {
  return canViewRequest(session, row);
}

export function canCompleteRequest(session: SessionAccount, row: RequestRow) {
  if (row.status !== "open") return false;
  return row.senderAccountId === session.id || row.recipientAccountId === session.id || session.isMaster;
}

export function canDeclineRequest(session: SessionAccount, row: RequestRow) {
  return row.status === "open" && row.recipientAccountId === session.id;
}

export function canReopenRequest(session: SessionAccount, row: RequestRow) {
  if (row.status !== "done" && row.status !== "declined") return false;
  return (
    session.isMaster ||
    row.senderAccountId === session.id ||
    row.recipientAccountId === session.id
  );
}

export function canEditRequest(session: SessionAccount, row: RequestRow) {
  if (row.status !== "open") return false;
  return session.isMaster || row.senderAccountId === session.id;
}

export function canDeleteRequest(session: SessionAccount, row: RequestRow) {
  return session.isMaster || row.senderAccountId === session.id;
}

export function readMarkersForParticipant(
  session: SessionAccount,
  row: Pick<RequestRow, "senderAccountId" | "recipientAccountId">,
) {
  const now = new Date();
  const data: { readAt?: Date; senderReadAt?: Date } = {};
  if (row.recipientAccountId === session.id) data.readAt = now;
  if (row.senderAccountId === session.id) data.senderReadAt = now;
  // A master reading someone else's thread must not clear their unread state.
  return data;
}

export function unreadMarkersForAuthor(
  authorAccountId: string,
  row: Pick<RequestRow, "senderAccountId" | "recipientAccountId">,
) {
  if (authorAccountId === row.senderAccountId) {
    return { readAt: null, senderReadAt: new Date() };
  }
  if (authorAccountId === row.recipientAccountId) {
    return { readAt: new Date(), senderReadAt: null };
  }
  // A master posting into someone else's thread notifies both participants.
  return { readAt: null, senderReadAt: null };
}
