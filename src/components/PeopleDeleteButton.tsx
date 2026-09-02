"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteDirectoryEntry } from "@/app/actions";

export function PeopleDeleteButton({
  profileId,
  name,
  canDelete,
}: {
  profileId: string;
  name: string;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!canDelete) return null;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className="btn-secondary w-full text-[var(--danger)]"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
          setError(null);
          startTransition(async () => {
            const result = await deleteDirectoryEntry(profileId);
            if (!result.ok) {
              if (result.reason === "protected") {
                setError("David and Haley can’t be deleted from the couple records.");
              } else {
                setError("Could not delete this person.");
              }
              return;
            }
            router.push("/people");
            router.refresh();
          });
        }}
      >
        {pending ? "Deleting…" : "Delete person"}
      </button>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
