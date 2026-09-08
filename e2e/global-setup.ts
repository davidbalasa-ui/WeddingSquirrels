import { mkdirSync, writeFileSync } from "node:fs";
import { SignJWT } from "jose";
import { config as loadEnv } from "dotenv";
import { resolveCertAccountIds } from "./cert-env";

loadEnv();

async function storageState(accountId: string) {
  const secret = process.env.PIN_SESSION_SECRET;
  if (!secret) throw new Error("PIN_SESSION_SECRET is required for certification auth");
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
    origins: [] as [],
  };
}

export default async function globalSetup() {
  const { masterId, restrictedId } = await resolveCertAccountIds();
  mkdirSync("test-artifacts/.auth", { recursive: true });
  writeFileSync("test-artifacts/.auth/master.json", JSON.stringify(await storageState(masterId)));
  writeFileSync(
    "test-artifacts/.auth/restricted.json",
    JSON.stringify(await storageState(restrictedId)),
  );
}
