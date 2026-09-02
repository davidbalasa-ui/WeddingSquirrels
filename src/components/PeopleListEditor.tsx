"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveDirectoryList } from "@/app/actions";
import type { PeopleList } from "@/lib/people-directory";

const LIST_OPTIONS: { value: PeopleList; label: string }[] = [
  { value: "guests", label: "Guest list" },
  { value: "day-of", label: "Day-of contacts" },
  { value: "vendors", label: "Vendors" },
];

export function PeopleListEditor({
  profileId,
  currentList,
  canEdit,
}: {
  profileId: string;
  currentList: PeopleList;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!canEdit) {
    return (
      <p className="text-sm text-muted">
        List · {LIST_OPTIONS.find((option) => option.value === currentList)?.label ?? currentList}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm">
        <span className="mb-1 block text-xs text-muted">Which list</span>
        <select
          className="field-input"
          value={currentList}
          disabled={pending}
          onChange={(event) => {
            const next = event.target.value as PeopleList;
            if (next === currentList) return;
            setError(null);
            startTransition(async () => {
              const result = await saveDirectoryList(profileId, next);
              if (!result.ok) {
                if (result.reason === "protected") {
                  setError("David and Haley can’t be removed from the couple records.");
                } else {
                  setError("Could not move to that list.");
                }
                return;
              }
              router.refresh();
            });
          }}
        >
          {LIST_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      {pending ? <p className="text-xs text-muted">Moving…</p> : null}
    </div>
  );
}
