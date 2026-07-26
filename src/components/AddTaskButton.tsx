"use client";

import { useState } from "react";
import { createTaskPackage } from "@/app/actions";
import { StarIcon } from "@/components/StarIcon";

type PersonOption = { id: string; name: string };

export function AddTaskButton({ people }: { people: PersonOption[] }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-[18px] border border-dashed border-line bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] px-4 py-4 text-sm font-semibold text-[var(--accent)]"
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

      <form action={createTaskPackage} className="flex flex-col gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted">Title</span>
          <input
            name="title"
            required
            placeholder="What needs deciding or doing?"
            className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
            autoFocus
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted">What is this</span>
          <textarea
            name="summary"
            rows={2}
            placeholder="Short explanation of the decision…"
            className="w-full resize-y rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted">First notes (optional)</span>
          <textarea
            name="planNotes"
            rows={3}
            placeholder="Start the plan here…"
            className="w-full resize-y rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
          />
        </label>

        {people.length > 0 ? (
          <fieldset>
            <legend className="mb-2 text-xs text-muted">Assigned to</legend>
            <div className="flex flex-wrap gap-2">
              {people.map((person) => (
                <label
                  key={person.id}
                  className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    name="assignees"
                    value={person.id}
                    defaultChecked={person.id === "david" || person.id === "haley"}
                  />
                  {person.name}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <button
          type="submit"
          className="rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white"
        >
          Create task
        </button>
      </form>
    </article>
  );
}
