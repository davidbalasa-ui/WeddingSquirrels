"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  /** Compact list rows: show a short name instead of repeating the full call-list phrase. */
  personLabel?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(checked);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(checked);
  }, [checked]);

  const visibleLabel = personLabel ?? "On day-of call list";
  const checkboxLabel = personLabel ? `On day-of call list, ${personLabel}` : "On day-of call list";

  return (
    <div className={compact ? undefined : "flex flex-col gap-1"}>
      <label
        className={`flex items-center gap-2 ${compact ? "text-xs" : "text-sm"} ${disabled ? "text-muted" : ""}`}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <input
          type="checkbox"
          className="h-4 w-4 shrink-0 rounded border-line"
          checked={value}
          disabled={disabled || pending}
          aria-label={checkboxLabel}
          onChange={(event) => {
            const next = event.target.checked;
            setError(null);
            setValue(next);
            startTransition(async () => {
              const result = await setDayOfContact(profileId, next);
              if (!result.ok) {
                setValue(checked);
                setError("Could not update day-of call list.");
                return;
              }
              router.refresh();
            });
          }}
        />
        <span className="whitespace-nowrap">{visibleLabel}</span>
      </label>
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
      {pending ? <p className="text-xs text-muted">Saving…</p> : null}
    </div>
  );
}
