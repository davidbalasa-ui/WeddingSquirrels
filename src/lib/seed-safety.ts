/**
 * Guards destructive seed/reset operations.
 *
 * Localhost remains seedable. Remote DBs require ALLOW_DESTRUCTIVE_SEED=1 —
 * except the known WeddingSquirrels production Neon endpoint, which is
 * hard-blocked and cannot be bypassed.
 */

export const PROTECTED_PRODUCTION_REFUSAL =
  "REFUSING DESTRUCTIVE SEED AGAINST PROTECTED WEDDINGSQUIRRELS PRODUCTION DATABASE";

/** Known production compute (direct + pooled). Hard-coded; not env-dependent. */
export const PROTECTED_PRODUCTION_HOSTS = [
  "ep-holy-mouse-avnzi9jd.c-11.us-east-1.aws.neon.tech",
  "ep-holy-mouse-avnzi9jd-pooler.c-11.us-east-1.aws.neon.tech",
] as const;

export const PROTECTED_PRODUCTION_ENDPOINT_ID = "ep-holy-mouse-avnzi9jd";
export const PROTECTED_PRODUCTION_BRANCH_ID = "br-empty-darkness-avx7u2gx";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "db"]);

export type DatabaseTarget = {
  host: string;
  database: string;
};

export type DestructiveGuardInput = {
  operation?: string;
  databaseUrl?: string;
  pgHost?: string;
  pgDatabase?: string;
  allowDestructiveSeed?: string;
  extraProtectedHosts?: string[];
  productionDbId?: string;
};

export class DestructiveDatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DestructiveDatabaseError";
  }
}

function stripUrlAuth(raw: string): string {
  return raw.replace(/^postgres(ql)?:\/\//, "http://").replace(/:[^/@]+@/, "@");
}

export function parseDatabaseTarget(databaseUrl: string): DatabaseTarget | null {
  const trimmed = databaseUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(stripUrlAuth(trimmed));
    const host = parsed.hostname.trim().toLowerCase();
    const database = decodeURIComponent(parsed.pathname.replace(/^\//, "").trim());
    if (!host) return null;
    return { host, database };
  } catch {
    return null;
  }
}

function extraHostsFromEnv(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function hostMatchesEndpoint(host: string, id: string): boolean {
  const needle = id.toLowerCase();
  return host === needle || host.startsWith(`${needle}.`) || host.startsWith(`${needle}-pooler.`);
}

export function isProtectedProductionTarget(
  target: DatabaseTarget | null,
  extra: { extraProtectedHosts?: string[]; productionDbId?: string } = {},
): boolean {
  if (!target) return false;
  const host = target.host.toLowerCase();
  if ((PROTECTED_PRODUCTION_HOSTS as readonly string[]).includes(host)) return true;
  if (hostMatchesEndpoint(host, PROTECTED_PRODUCTION_ENDPOINT_ID)) return true;
  if (hostMatchesEndpoint(host, PROTECTED_PRODUCTION_BRANCH_ID)) return true;

  const extraHosts = extra.extraProtectedHosts ?? extraHostsFromEnv(process.env.PROTECTED_DATABASE_HOSTS);
  if (extraHosts.includes(host)) return true;

  const productionDbId = (extra.productionDbId ?? process.env.WEDDINGSQUIRRELS_PRODUCTION_DB_ID ?? "")
    .trim()
    .toLowerCase();
  if (productionDbId && (host === productionDbId || hostMatchesEndpoint(host, productionDbId))) {
    return true;
  }
  return false;
}

export function isLocalDatabaseUrl(databaseUrl = process.env.DATABASE_URL ?? ""): boolean {
  const target = parseDatabaseTarget(databaseUrl);
  if (!target) return false;
  return LOCAL_HOSTS.has(target.host);
}

function resolveTarget(input: DestructiveGuardInput): DatabaseTarget | null {
  const fromUrl = parseDatabaseTarget(input.databaseUrl ?? "");
  if (fromUrl) return fromUrl;
  const host = (input.pgHost ?? "").trim().toLowerCase();
  if (!host) return null;
  return { host, database: (input.pgDatabase ?? "").trim() };
}

function guardInputFromEnv(operation: string): DestructiveGuardInput {
  return {
    operation,
    databaseUrl: process.env.DATABASE_URL ?? "",
    pgHost: process.env.PGHOST,
    pgDatabase: process.env.PGDATABASE,
    allowDestructiveSeed: process.env.ALLOW_DESTRUCTIVE_SEED,
    extraProtectedHosts: extraHostsFromEnv(process.env.PROTECTED_DATABASE_HOSTS),
    productionDbId: process.env.WEDDINGSQUIRRELS_PRODUCTION_DB_ID,
  };
}

export function evaluateDestructiveDatabaseAccess(input: DestructiveGuardInput): {
  allowed: boolean;
  message: string;
} {
  const operation = input.operation || "destructive database operation";
  const target = resolveTarget(input);

  if (isProtectedProductionTarget(target, input)) {
    return { allowed: false, message: PROTECTED_PRODUCTION_REFUSAL };
  }

  if (target && LOCAL_HOSTS.has(target.host)) {
    return { allowed: true, message: "" };
  }

  if (input.allowDestructiveSeed === "1") {
    if (!target) {
      return {
        allowed: false,
        message: `Refusing ${operation}: DATABASE_URL is missing or malformed.`,
      };
    }
    return { allowed: true, message: "" };
  }

  if (!target) {
    return {
      allowed: false,
      message: `Refusing ${operation}: DATABASE_URL is missing or malformed.`,
    };
  }

  return {
    allowed: false,
    message: `Refusing ${operation} against a non-local database. This operation deletes and recreates core wedding data. ALLOW_DESTRUCTIVE_SEED=1 cannot be used on the protected production endpoint.`,
  };
}

/** Shared guard for seed, reset, and other wipe/recreate entry points. */
export function assertDestructiveDatabaseAllowed(
  operation = "db:seed",
  input?: DestructiveGuardInput,
): void {
  const decision = evaluateDestructiveDatabaseAccess(input ?? guardInputFromEnv(operation));
  if (decision.allowed) return;
  console.error(decision.message);
  throw new DestructiveDatabaseError(decision.message);
}

/** @deprecated use assertDestructiveDatabaseAllowed */
export function assertDestructiveSeedAllowed(operation = "db:seed"): void {
  assertDestructiveDatabaseAllowed(operation);
}
