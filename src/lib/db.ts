import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

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

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
