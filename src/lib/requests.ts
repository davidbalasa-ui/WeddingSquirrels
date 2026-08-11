import type { Prisma } from "@prisma/client";
import type { SessionAccount } from "@/lib/types";

export const REQUEST_STATUSES = ["open", "done", "declined"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export type RequestActorFields = {
  status: string;
  senderAccountId: string;
  recipientAccountId: string;
};

export function isRequestStatus(value: string): value is RequestStatus {
  return (REQUEST_STATUSES as readonly string[]).includes(value);
}

export function canViewRequest(session: SessionAccount, req: RequestActorFields): boolean {
  if (session.isMaster) return true;
  return (
    req.senderAccountId === session.id || req.recipientAccountId === session.id
  );
}

export function canCompleteRequest(session: SessionAccount, req: RequestActorFields): boolean {
  if (req.status !== "open") return false;
  return (
    req.senderAccountId === session.id || req.recipientAccountId === session.id
  );
}

export function canDeclineRequest(session: SessionAccount, req: RequestActorFields): boolean {
  if (req.status !== "open") return false;
  return req.recipientAccountId === session.id;
}

export function canReopenRequest(session: SessionAccount, req: RequestActorFields): boolean {
  if (req.status !== "done" && req.status !== "declined") return false;
  return session.isMaster || req.senderAccountId === session.id;
}

export function canEditRequest(session: SessionAccount, req: RequestActorFields): boolean {
  if (req.status !== "open") return false;
  return session.isMaster || req.senderAccountId === session.id;
}

export function canDeleteRequest(session: SessionAccount, req: RequestActorFields): boolean {
  return session.isMaster || req.senderAccountId === session.id;
}

/** Masters see all; others only requests they sent or received. */
export function requestVisibilityWhere(session: SessionAccount): Prisma.RequestWhereInput {
  if (session.isMaster) return {};
  return {
    OR: [{ senderAccountId: session.id }, { recipientAccountId: session.id }],
  };
}

/** Unread badge: open + unread + I am the recipient (never for sender / closed). */
export function unreadRequestsWhere(session: SessionAccount): Prisma.RequestWhereInput {
  return {
    status: "open",
    readAt: null,
    recipientAccountId: session.id,
  };
}

export type RequestTransition =
  | "create"
  | "complete"
  | "decline"
  | "reopen"
  | "edit"
  | "delete"
  | "markRead";

export function assertTransition(
  session: SessionAccount,
  req: RequestActorFields | null,
  action: RequestTransition,
): void {
  switch (action) {
    case "create":
      if (!session.canSeeRequests) throw new Error("FORBIDDEN");
      return;
    case "complete":
      if (!req || !canCompleteRequest(session, req)) throw new Error("FORBIDDEN");
      return;
    case "decline":
      if (!req || !canDeclineRequest(session, req)) throw new Error("FORBIDDEN");
      return;
    case "reopen":
      if (!req || !canReopenRequest(session, req)) throw new Error("FORBIDDEN");
      return;
    case "edit":
      if (!req || !canEditRequest(session, req)) throw new Error("FORBIDDEN");
      return;
    case "delete":
      if (!req || !canDeleteRequest(session, req)) throw new Error("FORBIDDEN");
      return;
    case "markRead":
      if (!req || !canViewRequest(session, req)) throw new Error("FORBIDDEN");
      if (req.recipientAccountId !== session.id) throw new Error("FORBIDDEN");
      return;
    default:
      throw new Error("FORBIDDEN");
  }
}
