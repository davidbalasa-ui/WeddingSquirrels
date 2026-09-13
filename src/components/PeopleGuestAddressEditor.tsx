"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveProfileGuestAddress } from "@/app/actions";

export function PeopleGuestAddressEditor({
  profileId,
  street,
  city,
  state,
  zip,
  canEdit,
}: {
  profileId: string;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ street: street ?? "", city: city ?? "", state: state ?? "", zip: zip ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canEdit) return null;

  const hasAddress = [street, city, state, zip].some((value) => value?.trim());

  if (!editing) {
    return (
      <button
        type="button"
        className="mt-2 text-sm font-semibold text-[var(--accent)]"
        onClick={() => {
          setDraft({ street: street ?? "", city: city ?? "", state: state ?? "", zip: zip ?? "" });
          setEditing(true);
          setError(null);
        }}
      >
        {hasAddress ? "Edit mailing address" : "Add mailing address"}
      </button>
    );
  }

  return (
    <form
      className="mt-3 flex flex-col gap-2 rounded-xl border border-line p-3"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await saveProfileGuestAddress(profileId, draft);
          if (!result.ok) {
            setError("Couldn’t save address — try again.");
            return;
          }
          setEditing(false);
          setError(null);
          router.refresh();
        });
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Mailing address</p>
      <label className="text-sm">
        <span className="mb-1 block text-xs text-muted">Street</span>
        <input
          value={draft.street}
          onChange={(event) => setDraft({ ...draft, street: event.target.value })}
          className="field-input"
          autoComplete="street-address"
          autoFocus
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted">City</span>
          <input
            value={draft.city}
            onChange={(event) => setDraft({ ...draft, city: event.target.value })}
            className="field-input"
            autoComplete="address-level2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted">State</span>
          <input
            value={draft.state}
            onChange={(event) => setDraft({ ...draft, state: event.target.value })}
            className="field-input"
            autoComplete="address-level1"
          />
        </label>
      </div>
      <label className="text-sm">
        <span className="mb-1 block text-xs text-muted">ZIP</span>
        <input
          value={draft.zip}
          onChange={(event) => setDraft({ ...draft, zip: event.target.value })}
          className="field-input"
          autoComplete="postal-code"
        />
      </label>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save address"}
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
