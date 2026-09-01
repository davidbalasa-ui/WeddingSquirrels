"use client";

import { useEffect } from "react";
import {
  loadOfflinePack,
  saveOfflinePack,
  shouldRefreshOfflinePack,
  type OfflinePack,
} from "@/lib/offline-db";

const OFFLINE_CACHE = "weddingsquirrels-v2";
const PACK_UPDATED_EVENT = "weddingsquirrels:offline-pack-updated";
const PACK_SYNC_ERROR_EVENT = "weddingsquirrels:offline-pack-error";

declare global {
  interface Window {
    __weddingsquirrelsOfflineSync?: Promise<void>;
  }
}

async function warmOfflineShell(): Promise<void> {
  if (!("caches" in window)) return;

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

  const cache = await caches.open(OFFLINE_CACHE);
  await cache.put("/offline", response);
  await Promise.allSettled(
    [...new Set(assetUrls)].map(async (url) => {
      const asset = await fetch(url, { credentials: "same-origin" });
      if (asset.ok) await cache.put(url, asset);
    }),
  );
}

async function syncOfflineCopy(): Promise<void> {
  const existing = await loadOfflinePack().catch(() => null);
  if (!shouldRefreshOfflinePack(existing?.fetchedAt)) {
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
    if (!navigator.onLine) return;

    const run = () => {
      if (!navigator.onLine) return;
      if (!window.__weddingsquirrelsOfflineSync) {
        window.__weddingsquirrelsOfflineSync = syncOfflineCopy()
          .catch((error) => {
            console.error(error);
            window.dispatchEvent(new Event(PACK_SYNC_ERROR_EVENT));
          })
          .finally(() => {
            window.__weddingsquirrelsOfflineSync = undefined;
          });
      }
    };

    run();
    window.addEventListener("online", run);
    return () => window.removeEventListener("online", run);
  }, []);

  return null;
}

