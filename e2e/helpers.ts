import { expect, test, type Page } from "@playwright/test";
import { SECRET_LEAK } from "./expected";

const IGNORE_CONSOLE =
  /Download the React DevTools|beforeinstallprompt|net::ERR_|favicon|hydrat/i;

export async function attachPageGuards(page: Page) {
  const pageErrors: string[] = [];
  const serverErrors: string[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(String(error));
  });
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (IGNORE_CONSOLE.test(text)) return;
    pageErrors.push(text);
  });
  page.on("response", (response) => {
    if (response.status() >= 500) {
      serverErrors.push(`${response.status()} ${response.url()}`);
    }
  });
  return {
    assertClean() {
      expect(pageErrors, `console/page errors:\n${pageErrors.join("\n")}`).toEqual([]);
      expect(serverErrors, `server errors:\n${serverErrors.join("\n")}`).toEqual([]);
    },
  };
}

export async function expectHealthy(page: Page, path: string, content: RegExp) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 0, `${path} status`).toBeLessThan(400);
  await expect(page.locator("body")).not.toContainText("Enter your PIN");
  await expect(page.locator("body")).toContainText(content);
  await expectNoSecrets(page);
}

export async function expectNoSecrets(page: Page) {
  const text = await page.locator("body").innerText();
  expect(SECRET_LEAK.test(text), "UI leaked an internal secret").toBeFalsy();
}

export async function clickPrimaryNav(page: Page, label: string) {
  await page.locator("nav[aria-label='Primary']").getByRole("link", { name: label, exact: true }).click();
}

export async function openPreviewPreset(page: Page, label: string) {
  const details = page.locator("details.preview-time-control");
  if (!(await details.count())) {
    test.info().annotations.push({
      type: "not-run",
      description: "Preview time control not available",
    });
    test.skip(true, "Preview time control not available");
  }
  await expect(details).toBeVisible();
  const isOpen = await details.evaluate((el) => (el as HTMLDetailsElement).open);
  if (!isOpen) {
    await details.locator("summary").click();
  }
  const select = details.locator("#preview-time-preset");
  await expect(select).toBeVisible();
  const previous = page.url();
  await select.selectOption({ label });
  await page.waitForURL((url) => url.href !== previous);
}

export function certName(suffix: string) {
  return `CERT-WS ${suffix} ${Date.now()}`;
}

export async function countVisibleTitles(page: Page, titles: string[]) {
  if (titles[0]) {
    await expect(page.getByText(titles[0], { exact: true }).first()).toBeVisible();
  }
  let found = 0;
  const body = await page.locator("#main-content").innerText();
  for (const title of titles) {
    if (body.includes(title)) found += 1;
  }
  return found;
}
