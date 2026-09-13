"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveProfileGuestPhone } from "@/app/actions";

export function PeopleGuestPhoneEditor({
  profileId,
  phone,
  canEdit,
}: {
  profileId: string;
  phone: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canEdit) return null;

  if (!editing) {
    return (
      <button
        type="button"
        className="mt-2 text-sm font-semibold text-[var(--accent)]"
        onClick={() => {
          setDraft(phone ?? "");
          setEditing(true);
          setError(null);
        }}
      >
        {phone?.trim() ? "Edit household phone" : "Add household phone"}
      </button>
    );
  }

  return (
    <form
      className="mt-3 flex flex-col gap-2 rounded-xl border border-line p-3"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await saveProfileGuestPhone(profileId, draft);
          if (!result.ok) {
            setError("Couldn’t save phone — try again.");
            return;
          }
          setEditing(false);
          setError(null);
          router.refresh();
        });
      }}
    >
      <label className="text-sm">
        <span className="mb-1 block text-xs text-muted">Household phone</span>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="field-input"
          inputMode="tel"
          autoComplete="tel"
          autoFocus
        />
      </label>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save phone"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={pending}
          onClick={() => {
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
