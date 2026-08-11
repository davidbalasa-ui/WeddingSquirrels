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

function parseAssigneeFilter(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const ids = parsed.filter((v): v is string => typeof v === "string" && v.length > 0);
    return ids.length > 0 ? ids : null;
  } catch {
    return null;
  }
}

function toSession(account: {
  id: string;
  name: string;
  isMaster: boolean;
  canSeeTasks: boolean;
  canSeeBudget: boolean;
  canSeeGuests: boolean;
  canSeeTimeline: boolean;
  canSeeShop: boolean;
  canSeeCalendar: boolean;
  canSeePeople: boolean;
  canSeeRequests: boolean;
  canEditBudget: boolean;
  canEditTimeline: boolean;
  canManageAccounts: boolean;
  assigneeFilterJson: string | null;
  linkedPersonId: string | null;
}): SessionAccount {
  const assigneeFilter = parseAssigneeFilter(account.assigneeFilterJson);

  // Masters always get full module access regardless of DB flags.
  if (account.isMaster) {
    return {
      id: account.id,
      name: account.name,
      isMaster: true,
      canSeeTasks: true,
      canSeeBudget: true,
      canSeeGuests: true,
      canSeeTimeline: true,
      canSeeShop: true,
      canSeeCalendar: true,
      canSeePeople: true,
      canSeeRequests: true,
      canEditBudget: true,
      canEditTimeline: true,
      canManageAccounts: true,
      assigneeFilter: null,
      linkedPersonId: account.linkedPersonId,
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
    canSeeShop: account.canSeeShop,
    canSeeCalendar: account.canSeeCalendar,
    canSeePeople: account.canSeePeople,
    canSeeRequests: account.canSeeRequests,
    canEditBudget: account.canEditBudget,
    canEditTimeline: account.canEditTimeline,
    canManageAccounts: account.canManageAccounts,
    assigneeFilter,
    linkedPersonId: account.linkedPersonId,
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
  const accounts = await prisma.pinAccount.findMany();
  for (const account of accounts) {
    if (await verifyPin(pin, account.pinHash)) {
      await createSession(account.id);
      return toSession(account);
    }
  }
  return null;
}
