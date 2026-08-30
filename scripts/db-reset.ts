import "dotenv/config";
import { execSync } from "node:child_process";
import { assertDestructiveSeedAllowed } from "../src/lib/seed-safety";

assertDestructiveSeedAllowed("db:reset");

execSync("npx prisma db push --force-reset", { stdio: "inherit" });
execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env: process.env });
