"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { savePeopleProfilePhoto } from "@/app/actions";
import { PersonAvatar } from "@/components/PersonAvatar";
import { fileToResizedDataUrl } from "@/lib/resize-image";
import { profilePhotoSrc } from "@/lib/people-experience";

export function PeopleProfilePhotoEditor({
  profileId,
  name,
  photoSrc,
  canEdit,
}: {
  profileId: string;
  name: string;
  photoSrc: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [override, setOverride] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (override === undefined) return;
    if (override && photoSrc) setOverride(undefined);
    if (override === null && !photoSrc) setOverride(undefined);
  }, [photoSrc, override]);

  const displaySrc = profilePhotoSrc(override !== undefined ? override : photoSrc);

  async function persist(next: string | null, clear = false) {
    setError(null);
    setBusy(true);
    try {
      const result = await savePeopleProfilePhoto(profileId, next, clear);
      if (!result.ok) {
        setOverride(undefined);
        setError(
          result.reason === "forbidden"
            ? "You don't have permission to change this photo."
            : result.reason === "invalid"
              ? "That image couldn't be saved. Try a JPEG, PNG, or WebP under the size limit."
              : "Could not save photo.",
        );
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      setOverride(dataUrl);
      await persist(dataUrl);
    } catch {
      setOverride(undefined);
      setError("That image couldn't be read. Try a JPEG or PNG.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (!canEdit) {
    return <PersonAvatar name={name} photoSrc={displaySrc} size="lg" />;
  }

  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      <PersonAvatar name={name} photoSrc={displaySrc} size="lg" />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void onFile(event.target.files?.[0])}
      />
      <button
        type="button"
        className="text-sm font-semibold text-[var(--accent)] disabled:opacity-50"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        {busy ? "Saving…" : displaySrc ? "Change photo" : "Add photo"}
      </button>
      {displaySrc ? (
        <button
          type="button"
          className="text-sm font-semibold text-[var(--danger)] disabled:opacity-50"
          disabled={busy}
          onClick={() => {
            setOverride(null);
            void persist(null, true);
          }}
        >
          Remove photo
        </button>
      ) : null}
      {error ? <p className="max-w-[9rem] text-center text-xs text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
