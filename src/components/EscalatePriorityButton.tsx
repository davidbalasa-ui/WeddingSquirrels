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
          ? `shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold leading-tight min-h-[32px] ${
              escalated
                ? "border-[var(--warn)] bg-[var(--warn-soft)] text-[var(--warn)]"
                : "border-line text-muted"
            }`
          : "btn-secondary w-full"
      }
      style={
        !compact && escalated
          ? { borderColor: "var(--warn)", background: "var(--warn-soft)", color: "var(--warn)" }
          : undefined
      }
    >
      {pending ? "…" : escalated ? "Remove priority pin" : "Escalate priority"}
    </button>
  );
}
