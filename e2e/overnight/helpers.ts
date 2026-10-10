import { expect, test, type Locator, type Page } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";
import { parseBlockNotes } from "../../src/lib/day-of-now";

const IGNORE_CONSOLE = /Download the React DevTools|beforeinstallprompt|net::ERR_|favicon|hydrat/i;

/** Collects browser and server errors so a test fails on anything the page logged. */
export function attachGuards(page: Page, options: { allow?: RegExp } = {}) {
  const pageErrors: string[] = [];
  const serverErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (IGNORE_CONSOLE.test(text)) return;
    if (options.allow?.test(text)) return;
    pageErrors.push(text);
  });
  page.on("response", (response) => {
    if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
  });
  // Named in the failure message so a "Failed to fetch" says which request it was.
  const failedRequests: string[] = [];
  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.method()} ${request.url()} (${request.failure()?.errorText ?? "?"})`);
  });
  return {
    assertClean() {
      expect(
        pageErrors,
        `console/page errors:\n${pageErrors.join("\n")}\nfailed requests:\n${failedRequests.join("\n")}`,
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
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("button", { name: "+ Add moment" })).toBeVisible();
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
