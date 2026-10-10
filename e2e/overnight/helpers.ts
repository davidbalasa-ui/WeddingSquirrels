import { expect, test, type Locator, type Page } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";
import { parseBlockNotes } from "../../src/lib/day-of-now";

const IGNORE_CONSOLE = /Download the React DevTools|beforeinstallprompt|net::ERR_|favicon|hydrat/i;

/** A request the browser itself gave up on because the page moved on (a prefetch or chunk cut short by a navigation or reload). */
const CANCELLED = /cancel|abort|NS_BINDING_ABORTED/i;

/** Collects browser and server errors so a test fails on anything the page logged. */
export function attachGuards(page: Page, options: { allow?: RegExp } = {}) {
  const pageErrors: string[] = [];
  const serverErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  const pending: Promise<void>[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    // Firefox prints a logged Error object as "JSHandle@object"; read its message instead.
    const described = Promise.all(
      msg.args().map((arg) =>
        arg
          .evaluate((value) => {
            const error = value as { name?: unknown; message?: unknown } | null;
            if (error && typeof error === "object" && typeof error.message === "string") {
              return `${typeof error.name === "string" ? error.name : "Error"}: ${error.message}`;
            }
            if (value && typeof value === "object") {
              try {
                return JSON.stringify(value);
              } catch {
                return String(value);
              }
            }
            return String(value);
          })
          .catch(() => ""),
      ),
    )
      .then((parts) => {
        const text = /JSHandle@/.test(msg.text()) ? parts.filter(Boolean).join(" ") || msg.text() : msg.text();
        if (IGNORE_CONSOLE.test(text)) return;
        if (options.allow?.test(text)) return;
        pageErrors.push(text);
      })
      .catch(() => undefined);
    pending.push(described);
  });
  page.on("response", (response) => {
    if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
  });
  // Named in the failure message so a "Failed to fetch" says which request it was.
  const failedRequests: string[] = [];
  const cancelledUrls = new Set<string>();
  let realFailures = 0;
  page.on("requestfailed", (request) => {
    const reason = request.failure()?.errorText ?? "?";
    failedRequests.push(`${request.method()} ${request.url()} (${reason})`);
    if (CANCELLED.test(reason)) cancelledUrls.add(request.url());
    else realFailures += 1;
  });
  /**
   * WebKit and Firefox log a console error for every request a navigation or reload
   * cut short (Chromium's equivalent, net::ERR_ABORTED, is already ignored above).
   * Those are not errors in the app, so they are set aside when the request was cancelled.
   */
  function isCancellationNoise(text: string) {
    if (/Load request cancelled/.test(text)) return true;
    if (/ServiceWorker intercepted the request and encountered an unexpected error/.test(text)) {
      return [...cancelledUrls].some((url) => text.includes(url));
    }
    // WebKit words a same-origin fetch killed by navigation as an access-control failure
    // (a same-origin request cannot fail access control for real).
    if (/Fetch API cannot load http: \/127\.0\.0\.1:\d+\/.* due to access control checks/.test(text) && realFailures === 0) return true;
    // The unhandled rejection for a fetch or a response stream cut short (Chromium says "Failed to fetch"), when nothing else failed.
    // (WebKit does not always report the cancelled request itself, so only "nothing else failed" is required.)
    if (/^TypeError: (Load failed|Error in input stream|Failed to fetch|NetworkError when attempting to fetch resource\.)$/.test(text) && realFailures === 0) return true;
    // Firefox logged an Error object the page could no longer describe (the navigation that cut
    // the request short also took the page), when nothing else failed.
    if (/^JSHandle@object$/.test(text) && realFailures === 0) return true;
    // Next's own note when a navigation cut its data fetch short; it then loads the page the plain way.
    if (/^Failed to fetch RSC payload for .* Falling back to browser navigation\. TypeError: (Load failed|NetworkError)/.test(text) && realFailures === 0) return true;
    return false;
  }
  return {
    async assertClean() {
      await Promise.all(pending);
      const errors = pageErrors.filter((text) => !isCancellationNoise(text));
      expect(
        errors,
        `console/page errors:\n${errors.join("\n")}\nfailed requests:\n${failedRequests.join("\n")}`,
      ).toEqual([]);
      expect(serverErrors, `server errors:\n${serverErrors.join("\n")}`).toEqual([]);
    },
  };
}

/** Nothing on the page should scroll sideways on a phone or a desktop. */
export async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    return { scrollWidth: root.scrollWidth, innerWidth: window.innerWidth };
  });
  expect(overflow.scrollWidth, `page scrolls sideways (${overflow.scrollWidth} > ${overflow.innerWidth})`).toBeLessThanOrEqual(
    overflow.innerWidth + 1,
  );
}

export async function blockByTitle(prisma: PrismaClient, title: string, schedule: "wedding" | "rehearsal" = "wedding") {
  const rows = await prisma.timelineBlock.findMany({ where: { schedule } });
  const match = rows.filter((row) => parseBlockNotes(row.notes).title.trim().toLowerCase() === title.trim().toLowerCase());
  expect(match.length, `exactly one "${title}" moment in the test data (found ${match.length})`).toBe(1);
  return match[0]!;
}

export async function openTimelineEditor(page: Page) {
  await page.goto("/plan/timeline");
  // A tap that lands before the page is live (Safari after a reload) does nothing; tap again.
  await expect(async () => {
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByRole("button", { name: "+ Add moment" })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}

export function editCard(page: Page, blockId: string): Locator {
  return page.locator(`article[data-day-row="${blockId}"]`);
}

export function reviewRow(page: Page, blockId: string): Locator {
  return page.locator(`#block-${blockId}`);
}

/** Waits until no row on the page is still saving or in error. */
export async function expectAllSaved(page: Page) {
  await expect(page.getByText("Saving…")).toHaveCount(0, { timeout: 15_000 });
  // Typing is saved 400ms after the last keystroke; let that timer fire and its save finish
  // before the test moves on, so a navigation never cuts a save short.
  await page.waitForTimeout(500);
  await expect(page.getByText("Saving…")).toHaveCount(0, { timeout: 15_000 });
  await page.waitForLoadState("networkidle");
  await expect(page.getByText(/Couldn’t save/)).toHaveCount(0);
}

/**
 * Sets the start time of a moment through the clock face the way a person would:
 * hour, minutes, then the AM/PM picker.
 */
export async function setStartTime(card: Locator, hour: string, minute: string, meridiem: "AM" | "PM") {
  const hourInput = card.getByLabel("Start time hour");
  await hourInput.click();
  await hourInput.fill(hour);
  const minuteInput = card.getByLabel("Start time minutes");
  await minuteInput.click();
  await minuteInput.fill(minute);
  await card.getByRole("button", { name: /^Start time .* Tap to choose AM or PM$/ }).click();
  await card.page().getByRole("dialog", { name: "Choose AM or PM" }).getByRole("button", { name: meridiem, exact: true }).click();
}

export const PACKETS = [
  { id: "binder", title: "Groom's Binder", kicker: "Wedding Binder" },
  { id: "bride", title: "Bride's Packet", kicker: "Bride's Packet" },
  { id: "packet", title: "Avalon & Wendy", kicker: "Coordinator & Mistress of Ceremonies" },
  { id: "mc", title: "MC Packet", kicker: "MC Packet" },
  { id: "party", title: "Wedding Party Packet", kicker: "Wedding Party Packet" },
  { id: "photo", title: "Photographer & Shot List", kicker: "Photographer · Shot List" },
  { id: "brideParents", title: "Parents of the Bride", kicker: "Parents of the Bride" },
  { id: "groomParents", title: "Parents of the Groom", kicker: "Parents of the Groom" },
] as const;

export type PacketId = (typeof PACKETS)[number]["id"];

/** Opens the Print Center on one packet and returns the printed document's text. */
export async function openPacket(page: Page, id: PacketId): Promise<string> {
  if (!page.url().endsWith("/print")) await page.goto("/print");
  const card = page.getByTestId(`print-preset-${id}`);
  await card.click();
  await expect(card).toHaveAttribute("aria-pressed", "true");
  return page.locator(".binder-doc").innerText();
}

export function skipUnless(condition: boolean, reason: string) {
  test.skip(!condition, reason);
}
