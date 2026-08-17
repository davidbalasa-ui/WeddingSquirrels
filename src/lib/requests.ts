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

export function unreadRequestsWhere(session: SessionAccount) {
  return {
    status: "open",
    OR: [
      { recipientAccountId: session.id, readAt: null },
      { senderAccountId: session.id, senderReadAt: null },
    ],
  };
}

export function isRequestUnread(session: SessionAccount, row: RequestRow) {
  if (row.status !== "open") return false;
  if (row.recipientAccountId === session.id) return !row.readAt;
  if (row.senderAccountId === session.id) return !row.senderReadAt;
  return session.isMaster && (!row.readAt || !row.senderReadAt);
}

export function canViewRequest(session: SessionAccount, row: RequestRow) {
  return (
    session.isMaster ||
    row.senderAccountId === session.id ||
    row.recipientAccountId === session.id
  );
}

export function canReplyToRequest(session: SessionAccount, row: RequestRow) {
  return row.status === "open" && canViewRequest(session, row);
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
  return session.isMaster || row.senderAccountId === session.id;
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
  if (session.isMaster) {
    data.readAt = now;
    data.senderReadAt = now;
  }
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
  return {};
}
