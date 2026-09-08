import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";
import { MASTER_ACCOUNT_ID, RESTRICTED_ACCOUNT_ID } from "./expected";

loadEnv();

/** Production-like simulation used by `npm run test:cert`. Not the daily-dev `wedding` database. */
export const CERT_SIMULATION_DATABASE_URL =
  "postgresql://wedding:wedding@127.0.0.1:5432/wedding_production_merge_simulation_20260907?sslmode=disable";

export function certDatabaseUrl() {
  // CERT_DATABASE_URL may override. Never fall back to DATABASE_URL from `.env`,
  // which points at the reconstruction/dev database `wedding`.
  return process.env.CERT_DATABASE_URL || CERT_SIMULATION_DATABASE_URL;
}

export async function resolveCertAccountIds() {
  const prisma = new PrismaClient({ datasourceUrl: certDatabaseUrl() });
  try {
    const accounts = await prisma.pinAccount.findMany({
      select: {
        id: true,
        name: true,
        isMaster: true,
        canSeeBudget: true,
        canSeeTimeline: true,
      },
      orderBy: [{ isMaster: "desc" }, { name: "asc" }],
    });
    const master =
      accounts.find((row) => row.id === MASTER_ACCOUNT_ID) ?? accounts.find((row) => row.isMaster);
    const restricted =
      accounts.find((row) => row.id === RESTRICTED_ACCOUNT_ID) ??
      accounts.find((row) => !row.isMaster && !row.canSeeBudget && !row.canSeeTimeline);
    if (!master) throw new Error("No master PIN account in the cert database");
    if (!restricted) throw new Error("No restricted PIN account in the cert database");
    return { masterId: master.id, restrictedId: restricted.id };
  } finally {
    await prisma.$disconnect();
  }
}
