"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";
import {
  NAVIGATION_MEMORY_KEY,
  currentUrl,
  emptyMemory,
  parseMemory,
  pushEntry,
  rememberPosition,
  replaceEntry,
  savedPosition,
  serializeMemory,
  traverseTo,
  type NavigationMemory,
} from "@/lib/navigation-memory";

/** The screen's own URL, the way the stack records it. */
function hereUrl(): string {
  return `${window.location.pathname}${window.location.search}`;
}

export function readNavigationMemory(): NavigationMemory {
  try {
    return parseMemory(window.sessionStorage.getItem(NAVIGATION_MEMORY_KEY), hereUrl());
  } catch {
    return emptyMemory(hereUrl());
  }
}

function writeNavigationMemory(memory: NavigationMemory) {
  try {
    window.sessionStorage.setItem(NAVIGATION_MEMORY_KEY, serializeMemory(memory));
  } catch {
    // Private mode or a full store: the app still works, it just forgets positions.
  }
}

const RESTORE_WINDOW_MS = 3000;

/**
 * Going back lands where you were, not at the top. The browser's own restore
 * fires before the previous screen has rendered (so a long page gets clamped to
 * a short one, and the position is lost); this remembers each screen's scroll
 * offset itself and puts it back once the screen is tall enough.
 */
export function ScrollMemory() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pendingRef = useRef<number | null>(null);
  const cancelRestoreRef = useRef<(() => void) | null>(null);

  function restore(target: number) {
    cancelRestoreRef.current?.();
    const started = performance.now();
    let frame = 0;
    let cancelled = false;
    const stop = () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
      cancelRestoreRef.current = null;
    };
    // The person scrolling themselves always wins.
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("keydown", stop);
    cancelRestoreRef.current = stop;
    const attempt = () => {
      if (cancelled) return;
      const root = document.scrollingElement ?? document.documentElement;
      const reachable = Math.max(0, root.scrollHeight - window.innerHeight);
      const y = Math.min(target, reachable);
      if (Math.abs(window.scrollY - y) > 1) window.scrollTo({ top: y, left: 0, behavior: "instant" });
      if (reachable >= target || performance.now() - started > RESTORE_WINDOW_MS) {
        stop();
        return;
      }
      frame = window.requestAnimationFrame(attempt);
    };
    attempt();
  }

  // Once the screen the browser went back (or forward) to has rendered, put its scroll offset back.
  const query = searchParams.toString();
  useLayoutEffect(() => {
    const target = pendingRef.current;
    if (target === null) return;
    pendingRef.current = null;
    restore(target);
  }, [pathname, query]);

  useEffect(() => {
    if (!("scrollRestoration" in window.history)) return;
    const previousMode = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    let memory = readNavigationMemory();
    const navigationType = (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type;
    if (currentUrl(memory) !== hereUrl()) {
      if (navigationType === "back_forward") {
        const traversal = traverseTo(memory, hereUrl());
        memory = traversal.memory;
        if (traversal.kind !== "unknown") restore(savedPosition(memory));
      } else {
        memory = pushEntry(memory, hereUrl());
      }
    } else if (navigationType === "reload" || navigationType === "back_forward") {
      restore(savedPosition(memory));
    }
    writeNavigationMemory(memory);

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        memory = rememberPosition(memory, window.scrollY);
        writeNavigationMemory(memory);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // The browser moved through history (back, forward, a swipe). React commits that
    // navigation synchronously inside the popstate event, so by the time a listener
    // added here runs, Next has already re-rendered and replaced the history entry;
    // the history hooks below catch it either way, and whichever sees it first wins.
    const noteTraversal = () => {
      const here = hereUrl();
      if (here === currentUrl(memory)) return;
      cancelRestoreRef.current?.();
      const traversal = traverseTo(memory, here);
      memory = traversal.memory;
      writeNavigationMemory(memory);
      pendingRef.current = traversal.kind === "unknown" ? 0 : savedPosition(memory);
    };
    window.addEventListener("popstate", noteTraversal);

    // Every in-app navigation goes through pushState/replaceState; that is where the stack learns about it.
    const originalPush = window.history.pushState;
    const originalReplace = window.history.replaceState;
    window.history.pushState = function pushState(this: History, ...args: Parameters<History["pushState"]>) {
      noteTraversal();
      cancelRestoreRef.current?.();
      memory = rememberPosition(memory, window.scrollY);
      const result = originalPush.apply(this, args);
      if (hereUrl() !== currentUrl(memory)) memory = pushEntry(memory, hereUrl());
      writeNavigationMemory(memory);
      return result;
    };
    window.history.replaceState = function replaceState(this: History, ...args: Parameters<History["replaceState"]>) {
      noteTraversal();
      const result = originalReplace.apply(this, args);
      if (hereUrl() !== currentUrl(memory)) {
        memory = replaceEntry(memory, hereUrl());
        writeNavigationMemory(memory);
      }
      return result;
    };

    return () => {
      window.history.scrollRestoration = previousMode;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("popstate", noteTraversal);
      window.cancelAnimationFrame(frame);
      window.history.pushState = originalPush;
      window.history.replaceState = originalReplace;
    };
  }, []);

  return null;
}
