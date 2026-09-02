"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setDayOfContact } from "@/app/actions";

export function DayOfCallListToggle({
  profileId,
  checked,
  disabled,
  compact,
  personLabel,
}: {
  profileId: string;
  checked: boolean;
  disabled?: boolean;
  compact?: boolean;
  personLabel?: string;
}) {
  const [optimisticChecked, setOptimisticChecked] = useOptimistic(checked);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const errorId = `day-of-error-${profileId}`;
  const visibleLabel = personLabel ?? "On day-of call list";
  const checkboxLabel = personLabel ? `On day-of call list, ${personLabel}` : visibleLabel;

  return (
    <div className={compact ? undefined : "flex flex-col gap-1"} aria-busy={pending || undefined}>
      <label
        className={`flex items-center gap-2 ${compact ? "text-xs" : "text-sm"} ${disabled ? "text-muted" : ""}`}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <input
          type="checkbox"
          className="h-4 w-4 shrink-0 rounded border-line"
          checked={optimisticChecked}
          disabled={disabled || pending}
          aria-label={checkboxLabel}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            const next = event.target.checked;
            setError(null);
            startTransition(async () => {
              setOptimisticChecked(next);
              const result = await setDayOfContact(profileId, next);
              if (!result.ok) {
                setError("Could not update day-of call list.");
              }
            });
          }}
        />
        <span className="whitespace-nowrap">{visibleLabel}</span>
      </label>
      <span className="sr-only" role="status" aria-live="polite">
        {pending ? "Saving day-of call list status" : ""}
      </span>
      {error ? (
        <p id={errorId} className="text-xs text-[var(--danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
