"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PwaInstallPrompt } from "@/components/PwaRegister";
import {
  formatFetchedAt,
  loadOfflinePack,
  type OfflinePack,
} from "@/lib/offline-db";

function isStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function isAppleMobile(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function OfflineSetupCard() {
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

    loadOfflinePack()
      .then((saved) => {
        if (active) setPack(saved);
      })
      .finally(() => {
        if (active) setChecking(false);
      });

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
    window.addEventListener("weddingsquirrels:install-available", onInstallAvailable);
    window.addEventListener("weddingsquirrels:installed", onInstalled);
    return () => {
      active = false;
      window.removeEventListener("weddingsquirrels:offline-pack-updated", onPackUpdated);
      window.removeEventListener("weddingsquirrels:offline-pack-error", onSyncError);
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

  const status = checking
    ? "Saving your offline copy automatically…"
    : pack
      ? `Offline copy ready · updated ${formatFetchedAt(pack.fetchedAt)}`
      : syncFailed
        ? "Couldn’t refresh the offline copy. Your last saved copy is still safe."
        : "Sign in once while online to prepare this device.";

  return (
    <>
      <section className="card mb-5 border-[var(--accent)] bg-[var(--accent-soft)]/45 p-4">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white"
            aria-hidden
          >
            ✓
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-[family-name:var(--font-display)] text-lg leading-tight">
              Ready when the signal isn&apos;t
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted" role="status">
              {status}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {!installed ? (
                <button type="button" className="btn-primary min-h-11 px-4 py-2" onClick={install}>
                  {installPrompt ? "Install app" : "Add to Home Screen"}
                </button>
              ) : (
                <span className="text-sm font-semibold text-[var(--accent)]">
                  Installed on this device
                </span>
              )}
              <Link href="/offline" className="text-sm font-semibold text-[var(--accent)] underline">
                Open offline copy
              </Link>
            </div>
          </div>
        </div>
      </section>

      {showGuide ? (
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
                <li><strong>1.</strong> Open this page in Safari.</li>
                <li><strong>2.</strong> Tap the Share button (square with an upward arrow).</li>
                <li><strong>3.</strong> Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                <li><strong>4.</strong> Tap <strong>Add</strong>.</li>
              </ol>
            ) : (
              <ol className="mt-5 space-y-4 text-sm leading-relaxed">
                <li><strong>1.</strong> Open your browser menu.</li>
                <li>
                  <strong>2.</strong> Tap <strong>Install app</strong> or{" "}
                  <strong>Add to Home screen</strong>.
                </li>
                <li><strong>3.</strong> Confirm the installation.</li>
              </ol>
            )}

            <p className="mt-5 rounded-2xl bg-[var(--accent-soft)] p-3 text-sm text-muted">
              The Home Screen app opens your saved offline copy first. No login or internet is
              required after this device has synced once.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

