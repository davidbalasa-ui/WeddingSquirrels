import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { OVERNIGHT_DATABASE_URL } from "./e2e/overnight/db";

loadEnv();

/**
 * End-to-end checks for the flows David uses, in a real browser at phone and
 * desktop size, against the local test copy of the data (never the live database).
 *
 *   npm run build && npx playwright test -c playwright.overnight.config.ts
 */
const PORT = Number(process.env.OVERNIGHT_PORT || 3200);
const BASE_URL = process.env.OVERNIGHT_BASE_URL || `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e/overnight",
  // Every spec writes to the same timeline, so they run one at a time.
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "test-artifacts/overnight/report" }]],
  globalSetup: "./e2e/overnight/global-setup.ts",
  outputDir: "test-artifacts/overnight/output",
  use: {
    baseURL: BASE_URL,
    // The container's Chromium; a different Playwright build would otherwise try to download its own.
    launchOptions: process.env.OVERNIGHT_CHROMIUM ? { executablePath: process.env.OVERNIGHT_CHROMIUM } : undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    storageState: "test-artifacts/overnight/.auth/master.json",
  },
  webServer: process.env.OVERNIGHT_BASE_URL
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          ...process.env,
          DATABASE_URL: OVERNIGHT_DATABASE_URL,
          VERCEL_ENV: "development",
          PORT: String(PORT),
        },
      },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], channel: undefined, viewport: { width: 1280, height: 900 } },
    },
    {
      name: "phone",
      use: { ...devices["Pixel 7"], channel: undefined },
    },
  ],
});
