"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { savePrimaryList } from "@/app/actions";
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
    <div className="flex flex-col gap-3" aria-busy={pending || undefined}>
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
                if (result.profileId !== profileId) {
                  router.push(`/people/${encodeURIComponent(result.profileId)}`);
                }
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

      {canEditDayOf || isDayOfContact ? (
        <p className="text-sm text-muted">
          Day-of call list ·{" "}
          {canEditDayOf ? (
            <Link href="/people?tab=day-of" className="font-semibold text-[var(--accent)]">
              manage on Day-of contacts
            </Link>
          ) : (
            "Day-of contacts tab"
          )}
          {isDayOfContact ? <span className="mt-1 block text-xs">Currently on the call list</span> : null}
        </p>
      ) : null}

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <span className="sr-only" role="status" aria-live="polite">
        {pending ? "Saving primary list" : ""}
      </span>
    </div>
  );
}
