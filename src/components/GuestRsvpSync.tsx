"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { applyBundledGuestSeating, importGuestRsvpCsv, syncBundledGuestRsvp } from "@/app/actions";

export function GuestRsvpSync() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function runSync(csvText?: string) {
    setMessage(null);
    startTransition(async () => {
      const result = csvText ? await importGuestRsvpCsv(csvText) : await syncBundledGuestRsvp();
      if (!result.ok) {
        setMessage("Couldn’t sync RSVPs — try again.");
        return;
      }
      setMessage(
        `Synced ${result.processed} households (${result.updated} updated, ${result.created} new).`,
      );
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
        setMessage("That file was empty.");
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
            setMessage(null);
            startTransition(async () => {
              const result = await applyBundledGuestSeating();
              if (!result.ok) {
                setMessage("Couldn’t apply seating — try again.");
                return;
              }
              setMessage(
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
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={onFileChange}
        />
      </div>
      {message ? <p className="mt-2 text-sm text-muted">{message}</p> : null}
    </div>
  );
}
