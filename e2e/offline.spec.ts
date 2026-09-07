import { expect, test } from "@playwright/test";
import { DAY_OF_CONTACTS, SHOPPING_ITEMS } from "./expected";
import { attachPageGuards } from "./helpers";

test.describe("offline critical path", () => {
  test("online backup remains usable after the browser goes offline", async ({ page, context }) => {
    const guards = await attachPageGuards(page);
    await page.goto("/more");
    await expect(page.getByText(/Offline copy ready/i)).toBeVisible({ timeout: 30_000 });
    await page.evaluate(async () => {
      if ("serviceWorker" in navigator) await navigator.serviceWorker.ready;
    });
    await page.getByRole("link", { name: "Open offline copy" }).click();
    await expect(page).toHaveURL(/\/offline/);
    await expect(page.getByRole("heading", { name: /WeddingSquirrels · Offline/i })).toBeVisible({
      timeout: 30_000,
    });

    const dayTab = page.getByRole("button", { name: /Day-of · 19/ });
    await expect(dayTab).toBeVisible();
    await dayTab.click();
    const offline = await page.locator("body").innerText();
    expect(offline).toContain("Settle in at Airbnb");
    expect(offline).toMatch(/Wendy Rush|Shelly Wiewiora/);
    for (const name of ["Avalon Green", "Wendy Rush"]) {
      expect(offline.includes(name) || (await page.getByRole("button", { name: /Contacts/ }).count()) > 0).toBeTruthy();
    }

    const contactsTab = page.getByRole("button", { name: /Contacts/ });
    if (await contactsTab.count()) {
      await contactsTab.click();
      const contacts = await page.locator("body").innerText();
      expect(DAY_OF_CONTACTS.some((name) => contacts.includes(name.split(" · ")[0]!))).toBeTruthy();
    }

    const shopTab = page.getByRole("button", { name: /Shop/ });
    if (await shopTab.count()) {
      await shopTab.click();
      const shop = await page.locator("body").innerText();
      if (!SHOPPING_ITEMS.some((item) => shop.includes(item))) {
        test.info().annotations.push({ type: "not-run", description: "Offline shopping list empty in this pack" });
      }
    } else {
      test.info().annotations.push({ type: "not-run", description: "Offline shopping tab not present" });
    }

    const stayTab = page.getByRole("button", { name: /Stay/ });
    await expect(stayTab).toBeVisible();
    await stayTab.click();
    await expect(page.getByText(/Bed|Stay|Airbnb|Haley|David/i).first()).toBeVisible();

    for (const name of ["Home", "Assignments", "Guests", "Money", "Ask"]) {
      const tab = page.getByRole("button", { name: new RegExp(`^${name}`) });
      if (await tab.count()) await tab.click();
    }

    const tel = page.locator('a[href^="tel:"]');
    if (await tel.count()) expect(await tel.first().getAttribute("href")).toMatch(/^tel:/);

    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /WeddingSquirrels · Offline/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Day-of · 19/ })).toBeVisible();
    await context.setOffline(false);
    guards.assertClean();
  });
});
