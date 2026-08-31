import { PrismaNeon } from "@prisma/adapter-neon";
import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export function isNeonDatabaseUrl(databaseUrl: string | undefined): boolean {
  if (!databaseUrl) return false;

  try {
    const hostname = new URL(databaseUrl).hostname.toLowerCase();
    return hostname === "neon.tech" || hostname.endsWith(".neon.tech");
  } catch {
    return false;
  }
}

export type DatabaseTransport = "neon-websocket" | "native";

export function selectDatabaseTransport(databaseUrl: string | undefined): DatabaseTransport {
  return isNeonDatabaseUrl(databaseUrl) ? "neon-websocket" : "native";
}

export function createPrismaClient(databaseUrl = process.env.DATABASE_URL): PrismaClient {
  const transport = selectDatabaseTransport(databaseUrl);
  const log: Prisma.LogLevel[] =
    process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];

  if (transport === "neon-websocket") {
    const adapter = new PrismaNeon({ connectionString: databaseUrl });
    return new PrismaClient({ adapter, log });
  }

  return new PrismaClient({ log });
}

export function isDatabaseUnreachable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /can't reach database server|p1001|p1017|timed out|connection refused|server has closed the connection|authentication failed/i.test(
    message,
  );
}

export function prismaErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return "";
}

export const databaseTransport = selectDatabaseTransport(process.env.DATABASE_URL);

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
