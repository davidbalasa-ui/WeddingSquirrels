"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveDirectoryLabel } from "@/app/actions";

export function PeopleRoleEditor({
  profileId,
  label,
  canEdit,
}: {
  profileId: string;
  label: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(label ?? "");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canEdit) {
    return label ? (
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
        {label}
      </p>
    ) : null;
  }

  if (!editing) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
          {label || "Add a note"}
        </p>
        <button
          type="button"
          className="text-xs font-semibold text-muted"
          onClick={() => {
            setDraft(label ?? "");
            setEditing(true);
            setError(null);
          }}
        >
          Edit role
        </button>
      </div>
    );
  }

  return (
    <form
      className="mt-2 flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          try {
            await saveDirectoryLabel(profileId, draft);
            setEditing(false);
            setError(null);
            router.refresh();
          } catch {
            setError("Could not save role label.");
          }
        });
      }}
    >
      <label className="text-sm">
        <span className="mb-1 block text-xs text-muted">Role (job / relationship)</span>
        <input
          name="directoryLabel"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="e.g. Photographer, Planner"
          className="field-input"
          autoFocus
        />
      </label>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save role"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={pending}
          onClick={() => {
            setDraft(label ?? "");
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
