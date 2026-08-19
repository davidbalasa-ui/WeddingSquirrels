"use client";

import { useEffect, useState } from "react";
import { formatFetchedAt, loadOfflinePack, saveOfflinePack, type OfflinePack } from "@/lib/offline-db";

type State = "idle" | "downloading" | "saved" | "error";

export function DownloadOfflineButton() {
  const [state, setState] = useState<State>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadOfflinePack()
      .then((pack) => {
        if (active && pack) {
          setSavedAt(pack.fetchedAt);
          setState("saved");
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const download = async () => {
    setState("downloading");
    setMessage(null);
    try {
      const res = await fetch("/api/offline", { headers: { Accept: "application/json" } });
      if (res.status === 401) {
        setState("error");
        setMessage("You need to be signed in to download the offline copy.");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const pack = (await res.json()) as OfflinePack;
      await saveOfflinePack(pack);
      setSavedAt(pack.fetchedAt ?? new Date().toISOString());
      setState("saved");
    } catch (err) {
      console.error(err);
      setState("error");
      setMessage("Couldn't download the offline copy — make sure you're online.");
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className="btn-secondary"
        onClick={download}
        disabled={state === "downloading"}
      >
        {state === "downloading"
          ? "Downloading…"
          : state === "saved"
            ? "Update offline copy"
            : "Download for offline"}
      </button>
      {state === "saved" && savedAt ? (
        <p className="text-xs text-muted">Saved {formatFetchedAt(savedAt)}</p>
      ) : null}
      {state === "error" && message ? (
        <p className="text-xs text-[var(--danger)]">{message}</p>
      ) : null}
    </div>
  );
}
