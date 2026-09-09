import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function isNeon(databaseUrl = process.env.DATABASE_URL ?? "") {
  return /neon\.tech/i.test(databaseUrl);
}

function statementsFromSql(sql: string): string[] {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

async function main() {
  const sql = readFileSync(path.join(process.cwd(), "scripts/neon-playbook.sql"), "utf8");
  for (const statement of statementsFromSql(sql)) {
    await prisma.$executeRawUnsafe(`${statement};`);
  }
  const target = isNeon(process.env.DATABASE_URL) ? "Neon" : "local database";
  console.log(`PlaybookItem table ensured on ${target}. No wedding content rows were changed.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
