"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { UnreadAsksPayload } from "@/app/api/requests/unread/route";

/** Fired with `{ count }` whenever the live unread-asks count is fetched. */
export const UNREAD_ASKS_EVENT = "weddingsquirrels:unread-asks";
/** Dispatch this after sending or reading a message to refresh the badge right away. */
export const ASKS_CHANGED_EVENT = "weddingsquirrels:asks-changed";

const POLL_MS = 30_000;
const TOAST_MS = 8_000;

type Latest = NonNullable<UnreadAsksPayload["latest"]>;

export function requestUnreadRefresh() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ASKS_CHANGED_EVENT));
}

/**
 * Keeps the unread badge live without a navigation and shows a toast for a new
 * message. Polls only while the tab is visible and online.
 */
export function AskNotifier({ accountId }: { accountId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  const [toast, setToast] = useState<Latest | null>(null);

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let lastCount: number | null = null;
    const seenKey = `weddingsquirrels:asks-seen:${accountId}`;

    async function poll() {
      if (!active || inFlight) return;
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      inFlight = true;
      try {
        const response = await fetch("/api/requests/unread", {
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok || !active) return;
        const data = (await response.json()) as UnreadAsksPayload;
        if (!active) return;

        window.dispatchEvent(new CustomEvent(UNREAD_ASKS_EVENT, { detail: { count: data.count } }));
        if (lastCount !== null && lastCount !== data.count) router.refresh();
        lastCount = data.count;

        if (data.latest) {
          let seen: string | null = null;
          try {
            seen = localStorage.getItem(seenKey);
          } catch {
            /* private mode */
          }
          if (seen !== data.latest.key) {
            try {
              localStorage.setItem(seenKey, data.latest.key);
            } catch {
              /* private mode */
            }
            const onThatThread = pathRef.current === `/messages/${data.latest.requestId}`;
            if (!onThatThread) {
              setToast(data.latest);
              try {
                navigator.vibrate?.(40);
              } catch {
                /* unsupported */
              }
            }
          }
        }
      } catch {
        // Offline or server hiccup: the next poll will try again.
      } finally {
        inFlight = false;
      }
    }

    void poll();
    const interval = window.setInterval(() => void poll(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    const onPoll = () => void poll();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onPoll);
    window.addEventListener("online", onPoll);
    window.addEventListener(ASKS_CHANGED_EVENT, onPoll);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onPoll);
      window.removeEventListener("online", onPoll);
      window.removeEventListener(ASKS_CHANGED_EVENT, onPoll);
    };
  }, [accountId, router]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  return (
    <div className="ask-toast print-hide" role="status" aria-live="polite">
      <Link
        href={`/messages/${toast.requestId}`}
        className="ask-toast-body"
        onClick={() => setToast(null)}
      >
        <span className="ask-toast-from">{toast.fromName}</span>
        <span className="ask-toast-title">{toast.title}</span>
        <span className="ask-toast-text">{toast.body}</span>
      </Link>
      <button
        type="button"
        className="ask-toast-close"
        aria-label="Dismiss notification"
        onClick={() => setToast(null)}
      >
        ×
      </button>
    </div>
  );
}
