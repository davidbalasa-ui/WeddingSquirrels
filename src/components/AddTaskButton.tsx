"use client";

import { useActionState, useState } from "react";
import { createTaskPackage, type TaskFormState } from "@/app/actions";
import { AssigneeFields } from "@/components/AssigneeFields";
import { StarIcon } from "@/components/StarIcon";
import { defaultAssigneeIds } from "@/lib/people";

type PersonOption = { id: string; name: string };

const initial: TaskFormState = {};

export function AddTaskButton({
  people,
  selectedIds,
}: {
  people: PersonOption[];
  selectedIds?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createTaskPackage, initial);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-[18px] border border-dashed border-line bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] px-4 py-4 text-sm font-semibold text-[var(--accent)] min-h-[48px]"
      >
        <StarIcon size={16} />
        Add new task
      </button>
    );
  }

  return (
    <article className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
          New task
        </p>
        <button
          type="button"
          aria-label="Close"
          className="star-btn star-btn-active"
          onClick={() => setOpen(false)}
        >
          <StarIcon filled size={18} />
        </button>
      </div>

      <form action={formAction} className="flex flex-col gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted">Title</span>
          <input
            name="title"
            required
            placeholder="What needs deciding or doing?"
            className="field-input"
            autoFocus
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted">Due date (optional)</span>
          <input name="dueDate" type="date" className="field-input" />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted">What is this</span>
          <textarea
            name="summary"
            rows={2}
            placeholder="Short explanation of the decision…"
            className="field-input resize-y"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted">First notes (optional)</span>
          <textarea
            name="planNotes"
            rows={3}
            placeholder="Start the plan here…"
            className="field-input resize-y"
          />
        </label>

        <AssigneeFields
          people={people}
          selectedIds={defaultAssigneeIds(people, selectedIds)}
          allowNew
        />

        {state.error ? <p className="text-sm text-[var(--danger)]">{state.error}</p> : null}

        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Creating…" : "Create task"}
        </button>
      </form>
    </article>
  );
}
