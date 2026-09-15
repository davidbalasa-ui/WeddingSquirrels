import { PrismaNeon } from "@prisma/adapter-neon";
import { Prisma, PrismaClient } from "@prisma/client";
import type { WeddingPlaceFields } from "@/lib/wedding-venue";

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

function prismaErrorColumn(error: unknown): string {
  if (!error || typeof error !== "object" || !("meta" in error)) return "";
  const meta = error.meta;
  if (!meta || typeof meta !== "object" || !("column" in meta)) return "";
  return typeof meta.column === "string" ? meta.column : "";
}

/** Canonical place fields added after AppSettings already existed in production. */
export const WEDDING_PLACE_COLUMNS = [
  "venueName",
  "venueStreet",
  "venueCity",
  "venueState",
  "venueZip",
  "rehearsalDinnerName",
  "rehearsalDinnerStreet",
  "rehearsalDinnerCity",
  "rehearsalDinnerState",
  "rehearsalDinnerZip",
  "airbnbName",
  "airbnbStreet",
  "airbnbCity",
  "airbnbState",
  "airbnbZip",
] as const;

const APP_SETTINGS_CORE_SELECT = {
  id: true,
  weddingDate: true,
  timezone: true,
  coupleNames: true,
  updatedAt: true,
} as const;

const EMPTY_WEDDING_PLACES: WeddingPlaceFields = {
  venueName: null,
  venueStreet: null,
  venueCity: null,
  venueState: null,
  venueZip: null,
  rehearsalDinnerName: null,
  rehearsalDinnerStreet: null,
  rehearsalDinnerCity: null,
  rehearsalDinnerState: null,
  rehearsalDinnerZip: null,
  airbnbName: null,
  airbnbStreet: null,
  airbnbCity: null,
  airbnbState: null,
  airbnbZip: null,
};

const WEDDING_PLACE_COLUMN_RE =
  /AppSettings\.(venue|rehearsalDinner|airbnb)|CalendarEvent\.location/i;

/** True when Prisma reports a wedding-place / calendar location column is missing. */
export function isMissingWeddingPlaceColumn(error: unknown): boolean {
  const code = prismaErrorCode(error);
  const message = error instanceof Error ? error.message : String(error);
  const text = `${prismaErrorColumn(error)} ${message}`;
  if (!WEDDING_PLACE_COLUMN_RE.test(text)) return false;
  return code === "P2022" || /does not exist/i.test(message);
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

/** True when Prisma reports the PlaybookItem table is missing. */
export function isMissingPlaybookItemTable(error: unknown): boolean {
  const code = prismaErrorCode(error);
  if (code === "P2021" || code === "P2010") return true;
  const message = error instanceof Error ? error.message : String(error);
  return /PlaybookItem|relation.*PlaybookItem/i.test(message);
}

let playbookItemsAvailable: boolean | null = null;

export async function supportsPlaybookItems(): Promise<boolean> {
  if (playbookItemsAvailable !== null) return playbookItemsAvailable;
  try {
    await prisma.playbookItem.count();
    playbookItemsAvailable = true;
  } catch (error) {
    playbookItemsAvailable = isMissingPlaybookItemTable(error) ? false : null;
    if (playbookItemsAvailable === null) throw error;
  }
  return playbookItemsAvailable;
}

export const databaseTransport = selectDatabaseTransport(process.env.DATABASE_URL);

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Idempotent ADD COLUMN for wedding places. Production can boot before the ensure script runs. */
export async function ensureWeddingPlaceColumns(client: PrismaClient = prisma): Promise<void> {
  const additions = WEDDING_PLACE_COLUMNS.map(
    (column) => `ADD COLUMN IF NOT EXISTS "${column}" TEXT`,
  ).join(", ");
  await client.$executeRawUnsafe(`ALTER TABLE "AppSettings" ${additions}`);
  await client.$executeRawUnsafe(
    `ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "location" TEXT`,
  );
}

/**
 * Load AppSettings without crashing Today when venue columns are not migrated yet.
 * Best-effort: add the columns, then fall back to core fields only.
 */
export async function loadAppSettings() {
  try {
    return await prisma.appSettings.findUnique({ where: { id: 1 } });
  } catch (error) {
    if (!isMissingWeddingPlaceColumn(error)) throw error;
    try {
      await ensureWeddingPlaceColumns();
    } catch {
      // ALTER may be denied; still serve the home screen from core columns.
    }
    try {
      return await prisma.appSettings.findUnique({ where: { id: 1 } });
    } catch (retryError) {
      if (!isMissingWeddingPlaceColumn(retryError)) throw retryError;
      const core = await prisma.appSettings.findUnique({
        where: { id: 1 },
        select: APP_SETTINGS_CORE_SELECT,
      });
      return core ? { ...EMPTY_WEDDING_PLACES, ...core } : null;
    }
  }
}
