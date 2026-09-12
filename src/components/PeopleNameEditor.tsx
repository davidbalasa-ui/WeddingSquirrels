"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveProfileGuestName } from "@/app/actions";

export function PeopleNameEditor({
  profileId,
  name,
  canEdit,
}: {
  profileId: string;
  name: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(name);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canEdit) return null;

  if (!editing) {
    return (
      <button
        type="button"
        className="mt-2 text-sm font-semibold text-muted"
        onClick={() => {
          setDraft(name);
          setEditing(true);
          setError(null);
        }}
      >
        Edit name
      </button>
    );
  }

  return (
    <form
      className="mt-3 flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await saveProfileGuestName(profileId, draft);
          if (!result.ok) {
            setError("Couldn’t save name — try again.");
            return;
          }
          setEditing(false);
          setError(null);
          router.refresh();
        });
      }}
    >
      <label className="text-sm">
        <span className="mb-1 block text-xs text-muted">Name</span>
        <input
          name="guestName"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="field-input"
          autoFocus
          autoComplete="name"
        />
      </label>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={pending || !draft.trim()}>
          {pending ? "Saving…" : "Save name"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={pending}
          onClick={() => {
            setDraft(name);
            setEditing(false);
            setError(null);
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
