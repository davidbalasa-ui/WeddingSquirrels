"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

/** How long a save may take to settle on its own before the page is refreshed anyway. */
const SETTLE_TIMEOUT_MS = 1500;

/**
 * Runs a save (a server action plus any state change after it) and makes sure the page shows
 * the saved data afterwards.
 *
 * Why not `await action(); router.refresh()`: the action's response already carries the
 * revalidated page and Next applies it inside the same transition. Now and then (seen only with
 * the offline service worker controlling the page) that apply never finishes: the transition
 * stays pending forever, a refresh queued inside it never runs, buttons disabled on `pending`
 * stay disabled, and the page keeps the old rows until a reload. A refresh issued on its own
 * later always works, so this hook refreshes once the transition settles and, if it has not
 * settled soon after the action returned, refreshes anyway.
 */
export function useRefreshAfterSave() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Own flag for disabling controls: it clears when the action returns, even if the transition hangs.
  const [busy, setBusy] = useState(false);
  const needsRefresh = useRef(false);
  const fallback = useRef<number | null>(null);

  function refresh() {
    if (!needsRefresh.current) return;
    needsRefresh.current = false;
    if (fallback.current !== null) {
      window.clearTimeout(fallback.current);
      fallback.current = null;
    }
    router.refresh();
  }

  useEffect(() => {
    if (!pending) refresh();
    // refresh reads refs and the router only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  useEffect(
    () => () => {
      if (fallback.current !== null) window.clearTimeout(fallback.current);
    },
    [],
  );

  function save(action: () => Promise<void>) {
    startTransition(async () => {
      setBusy(true);
      try {
        await action();
      } finally {
        setBusy(false);
      }
      needsRefresh.current = true;
      fallback.current = window.setTimeout(() => {
        fallback.current = null;
        refresh();
      }, SETTLE_TIMEOUT_MS);
    });
  }

  return { pending: busy, save };
}
