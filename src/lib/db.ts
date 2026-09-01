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

/** True when Prisma reports the BudgetPayment table/relation is missing (Phase 5 not migrated yet). */
export function isMissingBudgetPaymentTable(error: unknown): boolean {
  const code = prismaErrorCode(error);
  if (code === "P2021" || code === "P2010") return true;
  const message = error instanceof Error ? error.message : String(error);
  return /BudgetPayment|relation.*BudgetPayment/i.test(message);
}

/** True when Prisma reports the BudgetFundingSource table/relation is missing. */
export function isMissingBudgetFundingSourceTable(error: unknown): boolean {
  const code = prismaErrorCode(error);
  if (code === "P2021" || code === "P2010") return true;
  const message = error instanceof Error ? error.message : String(error);
  return /BudgetFundingSource|relation.*BudgetFundingSource/i.test(message);
}

let budgetPaymentsAvailable: boolean | null = null;
let budgetFundingAvailable: boolean | null = null;

/** Cached probe — production can run before neon-budget-payment.sql is applied. */
export async function supportsBudgetPayments(): Promise<boolean> {
  if (budgetPaymentsAvailable !== null) return budgetPaymentsAvailable;
  try {
    await prisma.budgetPayment.count();
    budgetPaymentsAvailable = true;
  } catch (error) {
    budgetPaymentsAvailable = isMissingBudgetPaymentTable(error) ? false : null;
    if (budgetPaymentsAvailable === null) throw error;
  }
  return budgetPaymentsAvailable;
}

/** Cached probe — production can run before neon-budget-funding.sql is applied. */
export async function supportsBudgetFundingSources(): Promise<boolean> {
  if (budgetFundingAvailable !== null) return budgetFundingAvailable;
  try {
    await prisma.budgetFundingSource.count();
    budgetFundingAvailable = true;
  } catch (error) {
    budgetFundingAvailable = isMissingBudgetFundingSourceTable(error) ? false : null;
    if (budgetFundingAvailable === null) throw error;
  }
  return budgetFundingAvailable;
}

export const databaseTransport = selectDatabaseTransport(process.env.DATABASE_URL);

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
