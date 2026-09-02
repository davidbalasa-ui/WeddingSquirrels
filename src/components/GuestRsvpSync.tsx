"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { applyBundledGuestSeating, importGuestRsvpCsv, syncBundledGuestRsvp } from "@/app/actions";

const SYNC_REPORT_KEY = "people-guest-sync-report";

function readStoredReport() {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(SYNC_REPORT_KEY);
  } catch {
    return null;
  }
}

function writeStoredReport(value: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (value) sessionStorage.setItem(SYNC_REPORT_KEY, value);
    else sessionStorage.removeItem(SYNC_REPORT_KEY);
  } catch {
    // ignore storage failures
  }
}

export function GuestRsvpSync() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setMessage(readStoredReport());
  }, []);

  function showReport(next: string) {
    writeStoredReport(next);
    setMessage(next);
  }

  function runSync(csvText?: string) {
    writeStoredReport(null);
    setMessage(null);
    startTransition(async () => {
      const result = csvText ? await importGuestRsvpCsv(csvText) : await syncBundledGuestRsvp();
      if (!result.ok) {
        showReport("Couldn’t sync RSVPs — try again.");
        return;
      }
      const summary = [
        `Synced ${result.processed} households (${result.updated} updated, ${result.created} new)`,
        `merged ${result.merged ?? 0}`,
        `copied ${result.photosCopied ?? 0} photos`,
        `skipped ${result.skippedConflicts ?? 0} conflicts`,
      ].join(" · ");
      const details = (result.report ?? []).join("\n");
      showReport(details ? `${summary}\n\n${details}` : summary);
      router.refresh();
    });
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      if (!text.trim()) {
        showReport("That file was empty.");
        return;
      }
      runSync(text);
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  return (
    <div className="mb-3 print-hide">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-secondary px-4 py-2 text-sm disabled:opacity-60"
          disabled={pending}
          onClick={() => runSync()}
        >
          {pending ? "Syncing…" : "Sync RSVPs"}
        </button>
        <button
          type="button"
          className="btn-secondary px-4 py-2 text-sm disabled:opacity-60"
          disabled={pending}
          onClick={() => {
            writeStoredReport(null);
            setMessage(null);
            startTransition(async () => {
              const result = await applyBundledGuestSeating();
              if (!result.ok) {
                showReport("Couldn’t apply seating — try again.");
                return;
              }
              showReport(
                `Seating applied (${result.updated} updated, ${result.cleared} cleared, ${result.created} added).`,
              );
              router.refresh();
            });
          }}
        >
          {pending ? "Working…" : "Apply seating"}
        </button>
        <button
          type="button"
          className="text-sm text-muted underline-offset-2 hover:underline disabled:opacity-60"
          disabled={pending}
          onClick={() => fileInputRef.current?.click()}
        >
          Upload CSV
        </button>
        {message ? (
          <button
            type="button"
            className="text-sm text-muted underline-offset-2 hover:underline"
            onClick={() => {
              writeStoredReport(null);
              setMessage(null);
            }}
          >
            Clear report
          </button>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={onFileChange}
        />
      </div>
      {message ? (
        <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-line bg-[var(--card)] px-3 py-2 text-sm text-muted whitespace-pre-wrap">
          {message}
        </div>
      ) : null}
    </div>
  );
}
