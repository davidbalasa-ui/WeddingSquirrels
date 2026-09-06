import "dotenv/config";
import { execSync } from "node:child_process";
import {
  DestructiveDatabaseError,
  assertDestructiveDatabaseAllowed,
} from "../src/lib/seed-safety";

try {
  assertDestructiveDatabaseAllowed("db:reset");
} catch (error) {
  if (error instanceof DestructiveDatabaseError) process.exit(1);
  throw error;
}

execSync("npx prisma db push --force-reset", { stdio: "inherit" });
execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env: process.env });
