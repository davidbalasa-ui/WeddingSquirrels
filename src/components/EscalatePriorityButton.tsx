"use client";

import { useTransition } from "react";
import { toggleTaskEscalation } from "@/app/actions";

export function EscalatePriorityButton({
  taskId,
  escalated,
  compact,
}: {
  taskId: string;
  escalated: boolean;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={escalated ? "Remove priority pin" : "Escalate priority"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startTransition(() => toggleTaskEscalation(taskId));
      }}
      className={
        compact
          ? `shrink-0 rounded-full border px-3 py-2 text-xs font-semibold min-h-[40px] ${
              escalated
                ? "border-[var(--warn)] bg-[var(--warn-soft)] text-[var(--warn)]"
                : "border-line text-muted"
            }`
          : `btn-secondary w-full ${escalated ? "border-[var(--warn)] bg-[var(--warn-soft)] text-[var(--warn)]" : ""}`
      }
    >
      {pending ? "…" : escalated ? "Remove priority pin" : "Escalate priority"}
    </button>
  );
}
