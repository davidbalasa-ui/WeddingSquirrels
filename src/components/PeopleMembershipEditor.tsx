"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { savePrimaryList, setDayOfContact } from "@/app/actions";
import type { PeoplePrimaryList } from "@/lib/people-directory";

const PRIMARY_OPTIONS: { value: PeoplePrimaryList; label: string }[] = [
  { value: "guests", label: "Guest list" },
  { value: "vendors", label: "Vendors" },
];

export function PeopleMembershipEditor({
  profileId,
  primaryList,
  isDayOfContact,
  canEditPrimaryList,
  canEditDayOf,
}: {
  profileId: string;
  primaryList: PeoplePrimaryList;
  isDayOfContact: boolean;
  canEditPrimaryList: boolean;
  canEditDayOf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!canEditPrimaryList && !canEditDayOf) {
    return (
      <div className="text-sm text-muted">
        <p>List · {PRIMARY_OPTIONS.find((option) => option.value === primaryList)?.label}</p>
        {isDayOfContact ? <p className="mt-1">On day-of call list</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {canEditPrimaryList ? (
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted">Primary list</span>
          <select
            className="field-input"
            value={primaryList}
            disabled={pending}
            onChange={(event) => {
              const next = event.target.value as PeoplePrimaryList;
              if (next === primaryList) return;
              setError(null);
              startTransition(async () => {
                const result = await savePrimaryList(profileId, next);
                if (!result.ok) {
                  if (result.reason === "protected") {
                    setError("David and Haley can’t be moved off the couple records.");
                  } else {
                    setError("Could not change primary list.");
                  }
                  return;
                }
                router.refresh();
              });
            }}
          >
            {PRIMARY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-sm text-muted">
          List · {PRIMARY_OPTIONS.find((option) => option.value === primaryList)?.label ?? primaryList}
        </p>
      )}

      {canEditDayOf ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-line"
            checked={isDayOfContact}
            disabled={pending}
            onChange={(event) => {
              setError(null);
              startTransition(async () => {
                const result = await setDayOfContact(profileId, event.target.checked);
                if (!result.ok) {
                  setError("Could not update day-of call list.");
                  return;
                }
                router.refresh();
              });
            }}
          />
          <span>On day-of call list</span>
        </label>
      ) : isDayOfContact ? (
        <p className="text-sm text-muted">On day-of call list</p>
      ) : null}

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      {pending ? <p className="text-xs text-muted">Saving…</p> : null}
    </div>
  );
}
