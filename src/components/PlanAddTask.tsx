"use client";

import { useActionState, useState } from "react";
import { createTaskPackage, type TaskFormState } from "@/app/actions";

export function PlanAddTask({ returnTo }: { returnTo: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createTaskPackage, {} as TaskFormState);

  if (!open) {
    return (
      <div className="mb-5">
        <button type="button" className="btn-primary min-h-[44px] w-full sm:w-auto" onClick={() => setOpen(true)}>
          Add Task
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="mb-5 flex flex-col gap-2 border border-[var(--line)] p-3">
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className="text-sm">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-muted">New task</span>
        <input
          name="title"
          required
          autoFocus
          className="field-input text-[15px] font-semibold"
          placeholder="What needs deciding?"
        />
      </label>
      {state.error ? <p className="text-sm text-[var(--danger)]">{state.error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary min-h-[44px]" disabled={pending}>
          {pending ? "Adding…" : "Add Task"}
        </button>
        <button type="button" className="btn-secondary min-h-[44px]" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
