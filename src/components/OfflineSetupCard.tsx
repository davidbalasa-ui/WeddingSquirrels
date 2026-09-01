"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PwaInstallPrompt } from "@/components/PwaRegister";
import {
  formatFetchedAt,
  loadOfflinePack,
  type OfflinePack,
} from "@/lib/offline-db";

type OfflineSetupVariant = "indicator" | "panel";

function isStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function isAppleMobile(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function OfflineSetupCard({
  variant = "indicator",
}: {
  variant?: OfflineSetupVariant;
}) {
  const [pack, setPack] = useState<OfflinePack | null>(null);
  const [checking, setChecking] = useState(true);
  const [syncFailed, setSyncFailed] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<PwaInstallPrompt | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [appleMobile, setAppleMobile] = useState(false);

  useEffect(() => {
    let active = true;
    setInstalled(isStandaloneMode());
    setAppleMobile(isAppleMobile());
    setInstallPrompt(window.__weddingsquirrelsInstallPrompt ?? null);

    const onPackUpdated = (event: Event) => {
      const detail = (event as CustomEvent<OfflinePack>).detail;
      if (detail) setPack(detail);
      setChecking(false);
      setSyncFailed(false);
    };
    const onSyncError = () => {
      setChecking(false);
      setSyncFailed(true);
    };
    const onSyncStarted = () => {
      setChecking(true);
      setSyncFailed(false);
    };
    const onInstallAvailable = () => {
      setInstallPrompt(window.__weddingsquirrelsInstallPrompt ?? null);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowGuide(false);
    };

    window.addEventListener("weddingsquirrels:offline-pack-updated", onPackUpdated);
    window.addEventListener("weddingsquirrels:offline-pack-error", onSyncError);
    window.addEventListener("weddingsquirrels:offline-sync-started", onSyncStarted);
    window.addEventListener("weddingsquirrels:install-available", onInstallAvailable);
    window.addEventListener("weddingsquirrels:installed", onInstalled);

    const hydratePack = async () => {
      try {
        let saved = await loadOfflinePack();
        if (!active) return;
        if (!saved && !window.__weddingsquirrelsOfflineSync) {
          saved = await loadOfflinePack();
          if (!active) return;
        }
        setPack(saved);
        if (saved) {
          setChecking(false);
          return;
        }
        if (window.__weddingsquirrelsOfflineSync) {
          setChecking(true);
          return;
        }
        if (navigator.onLine) {
          setChecking(true);
          window.dispatchEvent(new Event("weddingsquirrels:offline-sync-request"));
        } else {
          setChecking(false);
        }
      } catch {
        if (active) setChecking(false);
      }
    };

    void hydratePack();

    return () => {
      active = false;
      window.removeEventListener("weddingsquirrels:offline-pack-updated", onPackUpdated);
      window.removeEventListener("weddingsquirrels:offline-pack-error", onSyncError);
      window.removeEventListener("weddingsquirrels:offline-sync-started", onSyncStarted);
      window.removeEventListener("weddingsquirrels:install-available", onInstallAvailable);
      window.removeEventListener("weddingsquirrels:installed", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) {
      setShowGuide(true);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallPrompt(null);
    window.__weddingsquirrelsInstallPrompt = undefined;
  };

  const requestSync = () => {
    window.dispatchEvent(new Event("weddingsquirrels:offline-sync-request"));
  };

  const healthy = Boolean(pack) && !syncFailed;
  const showIndicatorOnly = variant === "indicator" && healthy && !checking;

  if (showIndicatorOnly) {
    return (
      <p
        className="mb-3 flex items-center gap-2 text-xs leading-none text-muted"
        role="status"
        aria-label={`Offline backup active, updated ${formatFetchedAt(pack!.fetchedAt)}`}
      >
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"
          aria-hidden
        />
        <span>
          Offline backup active
          <span aria-hidden> · </span>
          <span className="text-[color-mix(in_srgb,var(--muted)_82%,transparent)]">
            updated {formatFetchedAt(pack!.fetchedAt)}
          </span>
        </span>
      </p>
    );
  }

  const status = checking
    ? "Saving your offline copy…"
    : pack
      ? syncFailed
        ? `Offline copy ready · updated ${formatFetchedAt(pack.fetchedAt)} · refresh failed`
        : `Offline copy ready · updated ${formatFetchedAt(pack.fetchedAt)}`
      : syncFailed
        ? "Couldn’t save an offline copy. Stay online and retry."
        : "Sign in once while online to prepare this device.";

  if (variant === "indicator") {
    return (
      <>
        <p className="mb-3 text-xs leading-snug text-muted" role="status">
          {checking ? (
            status
          ) : syncFailed ? (
            <>
              {status}{" "}
              <button
                type="button"
                className="font-semibold text-[var(--accent)] underline"
                onClick={requestSync}
              >
                Retry
              </button>
            </>
          ) : !pack ? (
            status
          ) : null}
        </p>
        {installGuide(showGuide, setShowGuide, appleMobile)}
      </>
    );
  }

  return (
    <>
      <section className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 flex-1 text-sm leading-snug text-muted" role="status">
            {status}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-[var(--accent)]">
            {!installed ? (
              <button type="button" className="underline" onClick={install}>
                {installPrompt ? "Install app" : "Add to Home Screen"}
              </button>
            ) : null}
            <Link href="/offline" className="underline">
              Open offline copy
            </Link>
            {pack ? (
              <button
                type="button"
                className="underline disabled:opacity-60"
                disabled={checking}
                onClick={requestSync}
              >
                {checking ? "Updating…" : "Update now"}
              </button>
            ) : syncFailed ? (
              <button type="button" className="underline" onClick={requestSync}>
                Retry
              </button>
            ) : null}
          </div>
        </div>
      </section>
      {installGuide(showGuide, setShowGuide, appleMobile)}
    </>
  );
}

function installGuide(
  showGuide: boolean,
  setShowGuide: (open: boolean) => void,
  appleMobile: boolean,
) {
  if (!showGuide) return null;

  return (
    <div className="overlay-backdrop" role="presentation" onClick={() => setShowGuide(false)}>
      <div
        className="overlay-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-guide-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              One-time setup
            </p>
            <h2
              id="install-guide-title"
              className="font-[family-name:var(--font-display)] text-2xl"
            >
              Add WeddingSquirrels to your phone
            </h2>
          </div>
          <button
            type="button"
            className="filter-pill rounded-full px-3 text-sm font-semibold"
            onClick={() => setShowGuide(false)}
            aria-label="Close install guide"
          >
            Close
          </button>
        </div>

        {appleMobile ? (
          <ol className="mt-5 space-y-4 text-sm leading-relaxed">
            <li>
              <strong>1.</strong> Open this page in Safari.
            </li>
            <li>
              <strong>2.</strong> Tap the Share button (square with an upward arrow).
            </li>
            <li>
              <strong>3.</strong> Scroll down and tap <strong>Add to Home Screen</strong>.
            </li>
            <li>
              <strong>4.</strong> Tap <strong>Add</strong>.
            </li>
          </ol>
        ) : (
          <ol className="mt-5 space-y-4 text-sm leading-relaxed">
            <li>
              <strong>1.</strong> Open your browser menu.
            </li>
            <li>
              <strong>2.</strong> Tap <strong>Install app</strong> or{" "}
              <strong>Add to Home screen</strong>.
            </li>
            <li>
              <strong>3.</strong> Confirm the installation.
            </li>
          </ol>
        )}

        <p className="mt-5 rounded-2xl bg-[var(--accent-soft)] p-3 text-sm text-muted">
          The Home Screen app opens your saved offline copy first. No login or internet is required
          after this device has synced once.
        </p>
      </div>
    </div>
  );
}
