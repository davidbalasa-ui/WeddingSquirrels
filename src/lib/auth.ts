import { compare, hash } from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import type { SessionAccount } from "@/lib/types";

const COOKIE = "ws_session";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 days

function secret() {
  const value = process.env.PIN_SESSION_SECRET || "dev-wedding-squirrels-secret-change-me";
  return new TextEncoder().encode(value);
}

export async function hashPin(pin: string) {
  return hash(pin, 10);
}

export async function verifyPin(pin: string, pinHash: string) {
  return compare(pin, pinHash);
}

function toSession(account: {
  id: string;
  name: string;
  isMaster: boolean;
  canSeeTasks: boolean;
  canSeeBudget: boolean;
  canSeeGuests: boolean;
  canSeeTimeline: boolean;
  canManageAccounts: boolean;
  canSeeShop: boolean;
  canSeeCalendar: boolean;
  canSeePeople: boolean;
  canSeeRequests: boolean;
  canSeeStay: boolean;
  canSeeDinner: boolean;
  canEditBudget: boolean;
  canEditTimeline: boolean;
  linkedPersonId: string | null;
  assigneeFilterJson: string | null;
}): SessionAccount {
  let assigneeFilter: string[] | null = null;
  if (account.assigneeFilterJson) {
    try {
      const parsed = JSON.parse(account.assigneeFilterJson) as string[];
      assigneeFilter = Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
    } catch {
      assigneeFilter = null;
    }
  }

  if (account.isMaster) {
    return {
      id: account.id,
      name: account.name,
      isMaster: true,
      canSeeTasks: true,
      canSeeBudget: true,
      canSeeGuests: true,
      canSeeTimeline: true,
      canManageAccounts: true,
      canSeeShop: true,
      canSeeCalendar: true,
      canSeePeople: true,
      canSeeRequests: true,
      canSeeStay: true,
      canSeeDinner: true,
      canEditBudget: true,
      canEditTimeline: true,
      linkedPersonId: account.linkedPersonId,
      assigneeFilter: null,
    };
  }

  return {
    id: account.id,
    name: account.name,
    isMaster: false,
    canSeeTasks: account.canSeeTasks,
    canSeeBudget: account.canSeeBudget,
    canSeeGuests: account.canSeeGuests,
    canSeeTimeline: account.canSeeTimeline,
    canManageAccounts: account.canManageAccounts,
    canSeeShop: account.canSeeShop,
    canSeeCalendar: account.canSeeCalendar,
    canSeePeople: account.canSeePeople,
    canSeeRequests: account.canSeeRequests,
    canSeeStay: account.canSeeStay,
    canSeeDinner: account.canSeeDinner || account.canManageAccounts,
    canEditBudget: account.canEditBudget,
    canEditTimeline: account.canEditTimeline,
    linkedPersonId: account.linkedPersonId,
    assigneeFilter,
  };
}

export async function createSession(accountId: string) {
  const token = await new SignJWT({ accountId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<SessionAccount | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    const accountId = payload.accountId;
    if (typeof accountId !== "string") return null;

    const account = await prisma.pinAccount.findUnique({ where: { id: accountId } });
    if (!account) return null;
    return toSession(account);
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export async function unlockWithPin(pin: string) {
  const accounts = await prisma.pinAccount.findMany({
    orderBy: { createdAt: "desc" },
  });
  for (const account of accounts) {
    if (await verifyPin(pin, account.pinHash)) {
      await createSession(account.id);
      return toSession(account);
    }
  }
  return null;
}
