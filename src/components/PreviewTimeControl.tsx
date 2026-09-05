"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  buildPreviewPresets,
  instantAtLocalClock,
  previewPresetIdForAsOf,
  type PreviewPresetId,
} from "@/lib/preview-clock";

export function PreviewTimeControl({
  weddingDateIso,
  timezone,
}: {
  weddingDateIso: string | null;
  timezone: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const asOf = params.get("asOf") ?? "";
  const presets = useMemo(
    () => buildPreviewPresets(weddingDateIso ? new Date(weddingDateIso) : null, timezone),
    [weddingDateIso, timezone],
  );
  const selected = previewPresetIdForAsOf(asOf || undefined, presets);
  const [custom, setCustom] = useState("");

  function applyAsOf(next: string | null) {
    const query = new URLSearchParams(params.toString());
    if (next) query.set("asOf", next);
    else query.delete("asOf");
    const suffix = query.toString();
    startTransition(() => {
      router.push(suffix ? `${pathname}?${suffix}` : pathname);
    });
  }

  return (
    <details className="preview-time-control print-hide mb-3 rounded-lg border border-dashed border-[var(--warn)] bg-[var(--warn-soft)] px-3 py-2">
      <summary className="cursor-pointer list-none text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--warn)]">
        Preview time{selected && selected !== "custom" ? ` · ${presets.find((row) => row.id === selected)?.label}` : asOf ? " · custom" : ""}
      </summary>
      <p className="mt-2 text-[11px] leading-snug text-[var(--warn)]">
        Testing only. Does not change the wedding date, Neon, or anyone else’s clock.
      </p>
      <label className="mt-2 block text-[11px] font-semibold text-[var(--warn)]" htmlFor="preview-time-preset">
        Preset moment
      </label>
      <select
        id="preview-time-preset"
        className="field-input mt-1 min-h-11 text-sm"
        value={selected && selected !== "custom" ? selected : ""}
        disabled={pending}
        onChange={(event) => {
          const id = event.target.value as PreviewPresetId | "";
          const preset = presets.find((row) => row.id === id);
          applyAsOf(preset?.asOf ?? null);
        }}
      >
        <option value="">Live clock</option>
        {presets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
      </select>
      <label className="mt-2 block text-[11px] font-semibold text-[var(--warn)]" htmlFor="preview-time-custom">
        Custom date and time
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id="preview-time-custom"
          type="datetime-local"
          className="field-input min-h-11 text-sm"
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
        />
        <button
          type="button"
          className="btn-secondary min-h-11 px-3 text-xs"
          disabled={pending || !custom}
          onClick={() => {
            const [dateKey, time] = custom.split("T");
            const [hour, minute] = (time ?? "10:00").split(":").map(Number);
            if (!dateKey) return;
            applyAsOf(instantAtLocalClock(dateKey, hour ?? 10, minute ?? 0, timezone).toISOString());
          }}
        >
          Apply
        </button>
      </div>
      {asOf ? (
        <button
          type="button"
          className="mt-2 text-xs font-semibold text-[var(--warn)] underline-offset-2 hover:underline"
          disabled={pending}
          onClick={() => applyAsOf(null)}
        >
          Clear preview
        </button>
      ) : null}
    </details>
  );
}
