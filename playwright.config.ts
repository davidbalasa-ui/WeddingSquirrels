import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

loadEnv();

const PORT = Number(process.env.CERT_PORT || 3100);
const BASE_URL = process.env.CERT_BASE_URL || `http://127.0.0.1:${PORT}`;
const DATABASE_URL =
  process.env.CERT_DATABASE_URL ||
  "postgresql://wedding:wedding@127.0.0.1:5432/wedding_production_merge_simulation_20260907?sslmode=disable";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  workers: Number(process.env.CERT_WORKERS || 4),
  timeout: 45_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: [["list"], ["./e2e/reporter.ts"]],
  globalSetup: "./e2e/global-setup.ts",
  outputDir: "test-artifacts/output",
  use: {
    baseURL: BASE_URL,
    channel: process.env.CERT_USE_BUNDLED_CHROMIUM === "1" ? undefined : "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    storageState: "test-artifacts/.auth/master.json",
    viewport: { width: 1280, height: 900 },
  },
  webServer: process.env.CERT_BASE_URL
    ? undefined
    : {
        command: "npx next start -p " + PORT,
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          ...process.env,
          DATABASE_URL,
          VERCEL_ENV: "development",
          PORT: String(PORT),
        },
      },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], channel: process.env.CERT_USE_BUNDLED_CHROMIUM === "1" ? undefined : "chrome", viewport: { width: 1280, height: 900 } },
      testIgnore: ["mobile.spec.ts", "permissions.spec.ts"],
    },
    {
      name: "restricted",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.CERT_USE_BUNDLED_CHROMIUM === "1" ? undefined : "chrome",
        storageState: "test-artifacts/.auth/restricted.json",
        viewport: { width: 1280, height: 900 },
      },
      testMatch: ["permissions.spec.ts"],
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        channel: process.env.CERT_USE_BUNDLED_CHROMIUM === "1" ? undefined : "chrome",
      },
      testMatch: ["mobile.spec.ts"],
    },
  ],
});
