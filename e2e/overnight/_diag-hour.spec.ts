import { expect, test, type Page } from "@playwright/test";
import { overnightPrisma } from "./db";
import { editCard, openTimelineEditor } from "./helpers";

/**
 * DIAGNOSTIC ONLY (to be removed): records what the Wedding Day hour box receives
 * per keystroke in each engine, so the iPhone failures can be read from the CI log.
 * Every test ends by failing on purpose so the log is printed.
 */
const prisma = overnightPrisma();
const PREFIX = "Diag hour";

test.afterAll(async () => prisma.$disconnect());

async function seed(key: string, startAt = "3:00 PM") {
  await prisma.timelineBlock.deleteMany({ where: { notes: { startsWith: `${PREFIX} ${key}` } } });
  const row = await prisma.timelineBlock.create({
    data: { startAt, endAt: null, notes: `${PREFIX} ${key}\nTest line`, sortOrder: 901, schedule: "wedding" },
  });
  return row.id;
}

async function instrument(page: Page, blockId: string) {
  await page.evaluate((id) => {
    const w = window as Window & { __log?: string[] };
    w.__log = [];
    const card = document.querySelector(`article[data-day-row="${id}"]`)!;
    const inputs = [...card.querySelectorAll<HTMLInputElement>("input[aria-label$='hour'], input[aria-label$='minutes']")];
    const label = (el: Element | null) => (el ? (el.getAttribute("aria-label") ?? el.tagName) : "null");
    const t0 = performance.now();
    const line = (ev: Event) => {
      const el = ev.target as HTMLInputElement;
      const ie = ev as InputEvent;
      w.__log!.push(
        `${Math.round(performance.now() - t0)}ms ${ev.type} on ${label(el)} value=${JSON.stringify(el.value)} sel=${el.selectionStart}-${el.selectionEnd}` +
          (ev.type.includes("input") ? ` inputType=${ie.inputType} data=${JSON.stringify(ie.data)}` : "") +
          ((ev as KeyboardEvent).key !== undefined ? ` key=${(ev as KeyboardEvent).key}` : "") +
          ` active=${label(document.activeElement)} hour=${JSON.stringify(inputs[0]?.value)} minute=${JSON.stringify(inputs[1]?.value)}`,
      );
    };
    for (const input of inputs) {
      for (const type of ["focus", "blur", "click", "pointerdown", "pointerup", "touchstart", "touchend", "keydown", "keypress", "beforeinput", "input", "keyup", "change"]) {
        input.addEventListener(type, line, true);
      }
    }
    document.addEventListener("selectionchange", () => {
      const el = document.activeElement as HTMLInputElement | null;
      if (el && inputs.includes(el)) w.__log!.push(`${Math.round(performance.now() - t0)}ms selectionchange active=${label(el)} sel=${el.selectionStart}-${el.selectionEnd} value=${JSON.stringify(el.value)}`);
    });
  }, blockId);
}

async function dump(page: Page, title: string) {
  const log = await page.evaluate(() => (window as Window & { __log?: string[] }).__log ?? []);
  throw new Error(`DIAG ${title}\n${log.join("\n")}`);
}

for (const [key, startAt, text] of [
  ["two-digit", "11:00 PM", "7"],
  ["two-digit-12", "12:00 PM", "9"],
  ["empty", "", "19"],
] as const) {
  test(`diag: tap the hour showing ${startAt || "nothing"}, type ${text}`, async ({ page }) => {
    const id = await seed(key, startAt);
    await openTimelineEditor(page);
    const card = editCard(page, id);
    await card.scrollIntoViewIfNeeded();
    await instrument(page, id);
    const hour = card.getByLabel("Start time hour");
    await hour.click();
    await page.waitForTimeout(80);
    await page.evaluate(() => (window as Window & { __log?: string[] }).__log!.push("--- typing starts"));
    await page.keyboard.type(text, { delay: 60 });
    await page.waitForTimeout(100);
    await page.evaluate(() => (window as Window & { __log?: string[] }).__log!.push("--- Enter"));
    await page.keyboard.press("Enter");
    await page.waitForTimeout(800);
    const values = { hour: await hour.inputValue(), minute: await card.getByLabel("Start time minutes").inputValue() };
    await page.evaluate((v) => (window as Window & { __log?: string[] }).__log!.push(`--- end hour=${v.hour} minute=${v.minute}`), values);
    expect(true).toBe(true);
    await dump(page, `${test.info().project.name} ${startAt || "empty"} type ${text}`);
  });
}
