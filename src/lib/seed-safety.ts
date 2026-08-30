/**
 * Guards destructive seed/reset operations against accidental runs on remote DBs.
 *
 * Set ALLOW_DESTRUCTIVE_SEED=1 to override (e.g. intentional fresh Neon branch seed).
 */
export function isLocalDatabaseUrl(databaseUrl = process.env.DATABASE_URL ?? ""): boolean {
  if (!databaseUrl.trim()) return false;
  try {
    const host = new URL(databaseUrl.replace(/^postgres(ql)?:\/\//, "http://")).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "db";
  } catch {
    return false;
  }
}

export function assertDestructiveSeedAllowed(operation = "db:seed"): void {
  if (process.env.ALLOW_DESTRUCTIVE_SEED === "1") return;
  if (isLocalDatabaseUrl()) return;

  const target = process.env.DATABASE_URL ? "the configured DATABASE_URL" : "DATABASE_URL (unset)";
  console.error(`Refusing ${operation} against ${target}.`);
  console.error("This operation deletes and recreates core wedding data (tasks, budget, guests, pins, timeline, AppSettings).");
  console.error("To run intentionally, set ALLOW_DESTRUCTIVE_SEED=1.");
  process.exit(1);
}
