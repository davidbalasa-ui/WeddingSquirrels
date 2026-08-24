"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createDayAssignment,
  deleteDayAssignment,
  saveDayAssignment,
} from "@/app/actions";

export type AssignmentView = {
  id: string;
  title: string;
  notes: string | null;
  assignees: { personId: string; personName: string }[];
};

export function AssignmentPanel({
  assignments,
  people,
  canEdit,
}: {
  assignments: AssignmentView[];
  people: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<AssignmentView | "new" | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      {canEdit ? (
        <button
          type="button"
          className="btn-primary w-full"
          onClick={() => setEditing((current) => (current === "new" ? null : "new"))}
        >
          Add assignment
        </button>
      ) : null}

      {editing === "new" ? (
        <AssignmentForm
          key="new"
          assignment={null}
          people={people}
          onDone={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      {assignments.length === 0 ? (
        <div className="card p-5 text-sm text-muted">
          No assignments yet{canEdit ? " — add the first one above" : "."}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {assignments.map((assignment) =>
            editing !== "new" && editing?.id === assignment.id ? (
              <AssignmentForm
                key={assignment.id}
                assignment={assignment}
                people={people}
                onDone={() => setEditing(null)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <article key={assignment.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug">{assignment.title}</p>
                    {assignment.notes ? (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{assignment.notes}</p>
                    ) : null}
                  </div>
                  {canEdit ? (
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <button
                        type="button"
                        className="text-sm font-semibold text-[var(--accent)]"
                        onClick={() => setEditing(assignment)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-sm font-semibold text-[var(--danger)]"
                        disabled={pending}
                        onClick={() => {
                          if (!window.confirm(`Delete "${assignment.title}"?`)) return;
                          startTransition(async () => {
                            await deleteDayAssignment(assignment.id);
                            router.refresh();
                          });
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
                {assignment.assignees.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {assignment.assignees.map((assignee) => (
                      <span
                        key={assignee.personId}
                        className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-muted"
                      >
                        {assignee.personName}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted">No one assigned yet</p>
                )}
              </article>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function AssignmentForm({
  assignment,
  people,
  onDone,
  onCancel,
}: {
  assignment: AssignmentView | null;
  people: { id: string; name: string }[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const preselected = new Set(assignment?.assignees.map((a) => a.personId) ?? []);

  return (
    <form
      className="card flex flex-col gap-3 p-4"
      action={async (formData) => {
        startTransition(async () => {
          if (assignment) formData.set("id", assignment.id);
          if (assignment) {
            await saveDayAssignment(formData);
          } else {
            await createDayAssignment(formData);
          }
          onDone();
          router.refresh();
        });
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
        {assignment ? "Edit assignment" : "New assignment"}
      </p>

      <label className="text-sm">
        <span className="mb-1 block text-xs text-muted">Task</span>
        <input
          name="title"
          required
          defaultValue={assignment?.title ?? ""}
          placeholder="e.g. Keep the bar stocked"
          className="field-input"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-xs text-muted">Notes</span>
        <textarea
          name="notes"
          rows={2}
          defaultValue={assignment?.notes ?? ""}
          placeholder="Details, timing, location…"
          className="field-input resize-y"
        />
      </label>

      <div className="text-sm">
        <span className="mb-1 block text-xs text-muted">Who (pick from known names)</span>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {people.map((person) => (
            <label
              key={person.id}
              className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-sm"
            >
              <input
                type="checkbox"
                name="personIds"
                value={person.id}
                defaultChecked={preselected.has(person.id)}
                className="accent-[var(--accent)]"
              />
              <span className="truncate">{person.name}</span>
            </label>
          ))}
        </div>
      </div>

      <label className="text-sm">
        <span className="mb-1 block text-xs text-muted">Or add a new name</span>
        <input
          name="newPerson"
          placeholder="e.g. Uncle Bob"
          className="field-input"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : assignment ? "Save" : "Add assignment"}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
