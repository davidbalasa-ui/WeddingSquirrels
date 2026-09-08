"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setDayOfContact } from "@/app/actions";

export function DayOfCallListToggle({
  profileId,
  checked,
  disabled,
  compact,
  instanceId,
}: {
  profileId: string;
  checked: boolean;
  disabled?: boolean;
  compact?: boolean;
  instanceId?: string;
}) {
  const router = useRouter();
  const [optimisticChecked, setOptimisticChecked] = useOptimistic(checked);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const errorId = `day-of-error-${instanceId ?? profileId}`;
  const label = optimisticChecked ? "Remove from Day-of Contacts" : "Add to Day-of Contacts";

  return (
    <div className={compact ? undefined : "flex flex-col gap-1"} aria-busy={pending || undefined}>
      <button
        type="button"
        className={
          compact
            ? "text-sm font-semibold text-[var(--accent)] disabled:text-muted"
            : "inline-flex min-h-11 items-center self-start rounded-full bg-[var(--accent-soft)] px-4 text-sm font-semibold text-[var(--accent)] disabled:opacity-50"
        }
        disabled={disabled || pending}
        aria-pressed={optimisticChecked}
        aria-describedby={error ? errorId : undefined}
        onClick={(event) => {
          event.stopPropagation();
          const next = !optimisticChecked;
          setError(null);
          startTransition(async () => {
            setOptimisticChecked(next);
            const result = await setDayOfContact(profileId, next);
            if (!result.ok) {
              setError("Could not update Day-of Contacts.");
              setStatus("");
              return;
            }
            setStatus(next ? "Added to Day-of Contacts" : "Removed from Day-of Contacts");
            router.refresh();
          });
        }}
      >
        {label}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {pending ? "Saving Day-of Contacts" : status}
      </span>
      {error ? (
        <p id={errorId} className="text-xs text-[var(--danger)]">
          {error}
        </p>
      ) : status && !compact ? (
        <p className="text-xs text-muted">{status}</p>
      ) : null}
    </div>
  );
}
