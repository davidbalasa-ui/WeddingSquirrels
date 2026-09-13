"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveProfileContact } from "@/app/actions";

export function PeopleContactEditor({
  profileId,
  name,
  phone,
  email,
  canEdit,
}: {
  profileId: string;
  name: string;
  phone: string | null;
  email: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftPhone, setDraftPhone] = useState(phone ?? "");
  const [draftEmail, setDraftEmail] = useState(email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canEdit) return null;

  if (!editing) {
    return (
      <button
        type="button"
        className="mt-2 text-sm font-semibold text-[var(--accent)]"
        onClick={() => {
          setDraftName(name);
          setDraftPhone(phone ?? "");
          setDraftEmail(email ?? "");
          setEditing(true);
          setError(null);
        }}
      >
        Edit contact info
      </button>
    );
  }

  return (
    <form
      className="mt-3 flex flex-col gap-3 rounded-xl border border-line p-3"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await saveProfileContact(profileId, {
            name: draftName.trim(),
            phone: draftPhone,
            email: draftEmail,
          });
          if (!result.ok) {
            setError("Couldn’t save contact info — try again.");
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
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          className="field-input"
          required
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-xs text-muted">Phone</span>
        <input
          value={draftPhone}
          onChange={(event) => setDraftPhone(event.target.value)}
          className="field-input"
          inputMode="tel"
          autoComplete="tel"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-xs text-muted">Email</span>
        <input
          value={draftEmail}
          onChange={(event) => setDraftEmail(event.target.value)}
          className="field-input"
          type="email"
          autoComplete="email"
        />
      </label>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={pending || !draftName.trim()}>
          {pending ? "Saving…" : "Save contact"}
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
