/**
 * What the app remembers about where you have been, so that going back lands
 * where you were. Pure helpers; the browser side lives in ScrollMemory and BackLink.
 *
 * `stack` is the in-app history (path + query) in the order it was visited and
 * `index` is where in it the current screen sits. `positions` holds the scroll
 * offset of each entry, by its index.
 */
export type NavigationMemory = {
  stack: string[];
  index: number;
  positions: Record<number, number>;
};

export const NAVIGATION_MEMORY_KEY = "ws:navigation";
const MAX_ENTRIES = 60;

export function emptyMemory(url: string): NavigationMemory {
  return { stack: [url], index: 0, positions: {} };
}

export function parseMemory(raw: string | null | undefined, currentUrl: string): NavigationMemory {
  if (!raw) return emptyMemory(currentUrl);
  try {
    const parsed = JSON.parse(raw) as Partial<NavigationMemory>;
    if (!Array.isArray(parsed.stack) || typeof parsed.index !== "number") return emptyMemory(currentUrl);
    const stack = parsed.stack.filter((entry): entry is string => typeof entry === "string");
    if (stack.length === 0 || parsed.index < 0 || parsed.index >= stack.length) return emptyMemory(currentUrl);
    const positions: Record<number, number> = {};
    for (const [key, value] of Object.entries(parsed.positions ?? {})) {
      const n = Number(key);
      if (Number.isInteger(n) && typeof value === "number" && Number.isFinite(value) && value >= 0) positions[n] = value;
    }
    return { stack, index: parsed.index, positions };
  } catch {
    return emptyMemory(currentUrl);
  }
}

export function serializeMemory(memory: NavigationMemory): string {
  return JSON.stringify(memory);
}

export function currentUrl(memory: NavigationMemory): string {
  return memory.stack[memory.index] ?? "";
}

/** The screen before this one in the app's own history, if there is one. */
export function previousUrl(memory: NavigationMemory): string | null {
  return memory.index > 0 ? (memory.stack[memory.index - 1] ?? null) : null;
}

/** A new screen was pushed: everything "forward" of here is gone. */
export function pushEntry(memory: NavigationMemory, url: string): NavigationMemory {
  const stack = memory.stack.slice(0, memory.index + 1);
  const positions: Record<number, number> = {};
  for (const [key, value] of Object.entries(memory.positions)) {
    if (Number(key) <= memory.index) positions[Number(key)] = value;
  }
  stack.push(url);
  let index = stack.length - 1;
  if (stack.length > MAX_ENTRIES) {
    const drop = stack.length - MAX_ENTRIES;
    stack.splice(0, drop);
    index -= drop;
    const shifted: Record<number, number> = {};
    for (const [key, value] of Object.entries(positions)) {
      const n = Number(key) - drop;
      if (n >= 0) shifted[n] = value;
    }
    return { stack, index, positions: shifted };
  }
  return { stack, index, positions };
}

/** The current screen's URL changed in place (a filter, a tab, a redirect). */
export function replaceEntry(memory: NavigationMemory, url: string): NavigationMemory {
  const stack = memory.stack.slice();
  stack[memory.index] = url;
  return { ...memory, stack };
}

export type Traversal = { kind: "back" | "forward"; memory: NavigationMemory } | { kind: "unknown"; memory: NavigationMemory };

/**
 * The browser moved through history (back, forward, or a swipe). We find out which
 * way by looking at the neighbours; an entry we never recorded becomes a push.
 */
export function traverseTo(memory: NavigationMemory, url: string): Traversal {
  if (memory.stack[memory.index - 1] === url) return { kind: "back", memory: { ...memory, index: memory.index - 1 } };
  if (memory.stack[memory.index + 1] === url) return { kind: "forward", memory: { ...memory, index: memory.index + 1 } };
  if (memory.stack[memory.index] === url) return { kind: "unknown", memory };
  // Look a little further back (several entries skipped at once, e.g. a long-press on the back button).
  for (let i = memory.index - 2; i >= Math.max(0, memory.index - 10); i--) {
    if (memory.stack[i] === url) return { kind: "back", memory: { ...memory, index: i } };
  }
  for (let i = memory.index + 2; i < Math.min(memory.stack.length, memory.index + 10); i++) {
    if (memory.stack[i] === url) return { kind: "forward", memory: { ...memory, index: i } };
  }
  return { kind: "unknown", memory: pushEntry(memory, url) };
}

export function rememberPosition(memory: NavigationMemory, y: number): NavigationMemory {
  const value = Math.max(0, Math.round(y));
  if (memory.positions[memory.index] === value) return memory;
  return { ...memory, positions: { ...memory.positions, [memory.index]: value } };
}

export function savedPosition(memory: NavigationMemory): number {
  return memory.positions[memory.index] ?? 0;
}

function pathOf(url: string): string {
  return url.split("?")[0].split("#")[0];
}

/**
 * Whether tapping an in-app back link to `href` should step back in history
 * (keeping the previous screen as it was) instead of opening `href` fresh.
 */
export function backLinkStepsBack(memory: NavigationMemory, href: string): boolean {
  const previous = previousUrl(memory);
  if (!previous) return false;
  return pathOf(previous) === pathOf(href);
}
