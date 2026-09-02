"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setDayOfContact } from "@/app/actions";

export function DayOfCallListToggle({
  profileId,
  checked,
  disabled,
  compact,
}: {
  profileId: string;
  checked: boolean;
  disabled?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(checked);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(checked);
  }, [checked]);

  return (
    <div className={compact ? undefined : "flex flex-col gap-1"}>
      <label
        className={`flex items-center gap-2 text-sm ${disabled ? "text-muted" : ""}`}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-line"
          checked={value}
          disabled={disabled || pending}
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
        <span>On day-of call list</span>
      </label>
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
      {pending ? <p className="text-xs text-muted">Saving…</p> : null}
    </div>
  );
}
