"use client";

import { useEffect, useRef } from "react";
import type { UploadedPhotoOption } from "@/lib/people-sort";

export function GuestPhotoPicker({
  photos,
  personName,
  currentSrc,
  onSelect,
  onUpload,
  onRemoveFromLibrary,
  onClearCurrent,
  onClose,
}: {
  photos: UploadedPhotoOption[];
  personName: string;
  currentSrc?: string | null;
  onSelect: (src: string) => void;
  onUpload: (file: File) => void;
  onRemoveFromLibrary: (src: string) => void;
  onClearCurrent?: () => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Choose photo for ${personName}`}
        tabIndex={-1}
        className="sheet"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-lg">Choose photo</h2>
          <button
            type="button"
            className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[var(--surface)]"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>

        {photos.length > 0 ? (
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Master photo list ({photos.length})
            </p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {photos.map((photo) => {
                const selected = currentSrc === photo.src;
                return (
                  <div key={photo.src} className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      className={`rounded-full p-0.5 ${
                        selected ? "ring-2 ring-[var(--accent)]" : "hover:bg-[var(--bg-elevated)]"
                      }`}
                      onClick={() => onSelect(photo.src)}
                      aria-label={`Use photo of ${photo.label}`}
                    >
                      <img
                        src={photo.src}
                        alt={photo.label}
                        className="h-14 w-14 rounded-full object-cover"
                      />
                    </button>
                    <span className="max-w-full truncate text-[10px] text-muted">{photo.label}</span>
                    <button
                      type="button"
                      className="text-[10px] font-semibold text-[var(--danger)] underline underline-offset-2"
                      onClick={() => {
                        if (!window.confirm(`Remove ${photo.label}'s image from the master list?`)) return;
                        onRemoveFromLibrary(photo.src);
                      }}
                    >
                      remove
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="mb-4 text-sm text-muted">No photos in the master list yet.</p>
        )}

        <div className="flex flex-col gap-2">
          <input
            ref={uploadRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onUpload(file);
            }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onUpload(file);
            }}
          />
          <button
            type="button"
            className="btn-primary"
            onClick={() => uploadRef.current?.click()}
          >
            Upload photo
          </button>
          <button
            type="button"
            className="rounded-xl border border-line px-3 py-2.5 text-sm font-semibold text-ink hover:bg-[var(--bg-elevated)]"
            onClick={() => cameraRef.current?.click()}
          >
            Take picture
          </button>
          {currentSrc ? (
            <button
              type="button"
              className="text-sm font-semibold text-[var(--danger)] underline underline-offset-2"
              onClick={() => {
                if (!window.confirm(`Remove the photo from ${personName}?`)) return;
                onClearCurrent?.();
              }}
            >
              Remove photo
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
