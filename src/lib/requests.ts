import type { SessionAccount } from "@/lib/types";

export type RequestRow = {
  id: string;
  status: string;
  senderAccountId: string;
  recipientAccountId: string;
  readAt: Date | null;
};

export function requestVisibilityWhere(session: SessionAccount) {
  if (session.isMaster) return {};
  return {
    OR: [{ senderAccountId: session.id }, { recipientAccountId: session.id }],
  };
}

export function unreadRequestsWhere(session: SessionAccount) {
  return {
    recipientAccountId: session.id,
    status: "open",
    readAt: null,
  };
}

export function canViewRequest(session: SessionAccount, row: RequestRow) {
  return (
    session.isMaster ||
    row.senderAccountId === session.id ||
    row.recipientAccountId === session.id
  );
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
