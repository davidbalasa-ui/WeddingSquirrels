"use client";

import { useEffect } from "react";
import {
  loadOfflinePack,
  OFFLINE_SYNC_INTERVAL_MS,
  saveOfflinePack,
  shouldRefreshOfflinePack,
  type OfflinePack,
} from "@/lib/offline-db";

const OFFLINE_CACHE = "weddingsquirrels-v2";
const PACK_UPDATED_EVENT = "weddingsquirrels:offline-pack-updated";
const PACK_SYNC_ERROR_EVENT = "weddingsquirrels:offline-pack-error";
const PACK_SYNC_REQUEST_EVENT = "weddingsquirrels:offline-sync-request";
const PACK_SYNC_STARTED_EVENT = "weddingsquirrels:offline-sync-started";

declare global {
  interface Window {
    __weddingsquirrelsOfflineSync?: Promise<void>;
  }
}

async function warmOfflineShell(): Promise<void> {
  if (!("caches" in window)) return;

  const cache = await caches.open(OFFLINE_CACHE);
  // Bypass the service worker's cache-first /offline handler so deploys refresh the shell.
  await cache.delete("/offline");

  const response = await fetch("/offline", { credentials: "same-origin" });
  if (!response.ok) return;

  const html = await response.clone().text();
  const document = new DOMParser().parseFromString(html, "text/html");
  const assetUrls = [
    ...document.querySelectorAll<HTMLScriptElement>("script[src]"),
    ...document.querySelectorAll<HTMLLinkElement>(
      'link[rel="stylesheet"][href], link[rel="preload"][href]',
    ),
  ]
    .map((element) => element.getAttribute("src") ?? element.getAttribute("href"))
    .filter((url): url is string => Boolean(url?.startsWith("/")));

  await cache.put("/offline", response);
  await Promise.allSettled(
    [...new Set(assetUrls)].map(async (url) => {
      const asset = await fetch(url, { credentials: "same-origin" });
      if (asset.ok) await cache.put(url, asset);
    }),
  );
}

async function syncOfflineCopy(force = false): Promise<void> {
  const existing = await loadOfflinePack().catch(() => null);
  if (!force && !shouldRefreshOfflinePack(existing?.fetchedAt)) {
    await warmOfflineShell().catch(() => {
      // Existing data remains usable even if shell warming fails.
    });
    window.dispatchEvent(
      new CustomEvent(PACK_UPDATED_EVENT, { detail: existing }),
    );
    return;
  }

  const response = await fetch("/api/offline", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Offline sync failed: HTTP ${response.status}`);

  const pack = (await response.json()) as OfflinePack;
  await saveOfflinePack(pack);
  await warmOfflineShell();
  window.dispatchEvent(new CustomEvent(PACK_UPDATED_EVENT, { detail: pack }));
}

export function AutoOfflineSync() {
  useEffect(() => {
    let pendingForce = false;

    const run = (force = false) => {
      if (!navigator.onLine) return;
      if (force) pendingForce = true;
      if (window.__weddingsquirrelsOfflineSync) return;

      const shouldForce = pendingForce;
      pendingForce = false;

      window.dispatchEvent(new Event(PACK_SYNC_STARTED_EVENT));
      window.__weddingsquirrelsOfflineSync = syncOfflineCopy(shouldForce)
        .catch((error) => {
          console.error(error);
          window.dispatchEvent(new Event(PACK_SYNC_ERROR_EVENT));
        })
        .finally(() => {
          window.__weddingsquirrelsOfflineSync = undefined;
          if (pendingForce) run(true);
        });
    };

    run();
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      run(true);
    }, OFFLINE_SYNC_INTERVAL_MS);
    const onOnline = () => run(true);
    const onSyncRequest = () => run(true);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") run();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener(PACK_SYNC_REQUEST_EVENT, onSyncRequest);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", onOnline);
      window.removeEventListener(PACK_SYNC_REQUEST_EVENT, onSyncRequest);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}

