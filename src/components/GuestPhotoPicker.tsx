"use client";

import { useEffect, useRef } from "react";
import type { UploadedPhotoOption } from "@/lib/people-sort";

export function GuestPhotoPicker({
  photos,
  personName,
  onSelect,
  onUpload,
  onClose,
}: {
  photos: UploadedPhotoOption[];
  personName: string;
  onSelect: (src: string) => void;
  onUpload: (file: File) => void;
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
              Uploaded photos
            </p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {photos.map((photo) => (
                <button
                  key={photo.src}
                  type="button"
                  className="flex flex-col items-center gap-1 rounded-xl p-1 hover:bg-[var(--bg-elevated)]"
                  onClick={() => onSelect(photo.src)}
                >
                  <img
                    src={photo.src}
                    alt={photo.label}
                    className="h-14 w-14 rounded-full object-cover"
                  />
                  <span className="max-w-full truncate text-[10px] text-muted">{photo.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

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
        </div>
      </div>
    </div>
  );
}
