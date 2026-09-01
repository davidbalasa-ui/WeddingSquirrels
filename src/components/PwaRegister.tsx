"use client";

import { useEffect } from "react";

export type PwaInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Window {
    __weddingsquirrelsInstallPrompt?: PwaInstallPrompt;
  }
}

export function PwaRegister() {
  useEffect(() => {
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      window.__weddingsquirrelsInstallPrompt = event as PwaInstallPrompt;
      window.dispatchEvent(new Event("weddingsquirrels:install-available"));
    };
    const clearInstallPrompt = () => {
      window.__weddingsquirrelsInstallPrompt = undefined;
      window.dispatchEvent(new Event("weddingsquirrels:installed"));
    };

    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", clearInstallPrompt);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {
          // Service workers are best-effort; failure should never break the app.
        });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      window.removeEventListener("appinstalled", clearInstallPrompt);
    };
  }, []);

  return null;
}
