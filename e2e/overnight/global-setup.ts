import { mkdirSync, writeFileSync } from "node:fs";
import { SignJWT } from "jose";
import { config as loadEnv } from "dotenv";
import { overnightPrisma, resetOvernightData } from "./db";

loadEnv();

/**
 * The suite's pages start as if this build's changes were already applied, so the
 * "Applied just now" pass does not run under every spec; auto-apply.spec.ts clears it.
 */
export const AUTO_APPLIED_KEY = "ws-auto-applied:local";

async function storageState(accountId: string) {
  const secret = process.env.PIN_SESSION_SECRET;
  if (!secret) throw new Error("PIN_SESSION_SECRET is required");
  const token = await new SignJWT({ accountId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(new TextEncoder().encode(secret));
  return {
    cookies: [
      {
        name: "ws_session",
        value: token,
        domain: "127.0.0.1",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax" as const,
        expires: Math.floor(Date.now() / 1000) + 8 * 60 * 60,
      },
    ],
    origins: [
      {
        origin: process.env.OVERNIGHT_BASE_URL || `http://127.0.0.1:${process.env.OVERNIGHT_PORT || 3200}`,
        localStorage: [{ name: AUTO_APPLIED_KEY, value: "1" }],
      },
    ],
  };
}

export default async function globalSetup() {
  const prisma = overnightPrisma();
  try {
    if (process.env.OVERNIGHT_SKIP_RESET !== "1") await resetOvernightData(prisma);
    const master = await prisma.pinAccount.findFirst({ where: { isMaster: true }, orderBy: { name: "asc" } });
    const restricted = await prisma.pinAccount.findFirst({ where: { isMaster: false, canSeeTimeline: false } });
    if (!master) throw new Error("No master PIN account in the overnight database");
    mkdirSync("test-artifacts/overnight/.auth", { recursive: true });
    writeFileSync("test-artifacts/overnight/.auth/master.json", JSON.stringify(await storageState(master.id)));
    if (restricted) {
      writeFileSync("test-artifacts/overnight/.auth/restricted.json", JSON.stringify(await storageState(restricted.id)));
    }
  } finally {
    await prisma.$disconnect();
  }
}
