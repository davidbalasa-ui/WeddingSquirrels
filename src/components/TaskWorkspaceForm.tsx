"use client";

import { useActionState, useOptimistic, useRef, useState, useTransition } from "react";
import {
  addTaskStep,
  saveStepNotes,
  saveTaskWorkspace,
  toggleTaskDone,
  renameTask,
  type TaskFormState,
} from "@/app/actions";
import { AutoGrowTextarea, fitTextarea } from "@/components/AutoGrowTextarea";
import { EscalatePriorityButton } from "@/components/EscalatePriorityButton";
import { AssigneeFields } from "@/components/AssigneeFields";
import { assigneeDisplayNames } from "@/lib/people";
import type { TaskWorkspace } from "@/lib/tasks";
import { dueDateInputValue, dueLabel } from "@/lib/tasks";

type PersonOption = { id: string; name: string };

export function TaskWorkspaceForm({
  task,
  people,
  canManageOwners,
  returnTo,
}: {
  task: TaskWorkspace;
  people: PersonOption[];
  canManageOwners: boolean;
  returnTo: string;
}) {
  const [, startTransition] = useTransition();
  // Step checks flip on tap; the server copy replaces them after the action.
  const [steps, toggleOptimisticStep] = useOptimistic(
    task.children,
    (current: typeof task.children, stepId: string) =>
      current.map((step) =>
        step.id === stepId ? { ...step, status: step.status === "done" ? "todo" : "done" } : step,
      ),
  );
  const [saveState, saveAction, saving] = useActionState(saveTaskWorkspace, {} as TaskFormState);
  const label = dueLabel(task.dueDate, task.status);
  const dueDateValue = dueDateInputValue(task.dueDate);
  const ownerNames = assigneeDisplayNames(task.assignees);
  const childTotal = task.children.length;
  const childDone = steps.filter((c) => c.status === "done").length;
  const selectedIds = task.assignees.map((a) => a.personId);
  const escalated = Boolean(task.escalatedAt);

  return (
    <div className="flex flex-col gap-4 pb-8">
      {escalated ? (
        <section
          className="card p-4"
          style={{ borderColor: "var(--warn)", background: "var(--warn-soft)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--warn)]">
            Priority pin active
          </p>
          <p className="mt-1 text-sm text-[var(--warn)]">
            Pinned to the top of Today{task.escalatedBy ? ` by ${task.escalatedBy}` : ""}.
          </p>
        </section>
      ) : null}

      <EscalatePriorityButton taskId={task.id} escalated={escalated} />

      <section className="flex flex-col gap-3">
        {task.children.length > 0 ? (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-[family-name:var(--font-display)] text-xl">Steps inside this</h2>
              <p className="shrink-0 text-sm font-semibold text-[var(--accent)]">
                {childDone}/{childTotal} done
              </p>
            </div>
            <p className="text-sm text-muted">
              Each step can have its own note. Check it when that piece is finished.
            </p>
          </>
        ) : null}
        {/* One card holds every step as a compact row, so several read at a glance. */}
        {steps.length > 0 ? (
          <div className="card divide-y divide-[var(--line)] overflow-hidden">
            {steps.map((step) => {
              const stepDone = step.status === "done";
              return (
                <article
                  key={step.id}
                  className={`flex items-start gap-2 py-1.5 pl-1 pr-3 ${stepDone ? "opacity-70" : ""}`}
                >
                  {/* A 40px tap target around a smaller circle. */}
                  <button
                    type="button"
                    aria-label={stepDone ? "Mark step not done" : "Mark step done"}
                    onClick={() =>
                      startTransition(async () => {
                        toggleOptimisticStep(step.id);
                        await toggleTaskDone(step.id);
                      })
                    }
                    className="flex h-10 w-10 shrink-0 items-center justify-center"
                  >
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-sm"
                      style={{
                        background: stepDone ? "var(--accent)" : "transparent",
                        color: stepDone ? "white" : "var(--muted)",
                      }}
                    >
                      {stepDone ? "✓" : ""}
                    </span>
                  </button>
                  <div className="min-w-0 flex-1 pt-2">
                    {/* The title wraps onto more lines instead of running off the card. */}
                    <AutoGrowTextarea
                      aria-label="Step title"
                      defaultValue={step.title}
                      rows={1}
                      className="block w-full border-0 bg-transparent p-0 text-[15px] font-semibold leading-snug outline-none focus:underline"
                      onBlur={(event) => {
                        const el = event.currentTarget;
                        const next = el.value.replace(/\s+/g, " ").trim();
                        if (!next) {
                          // A step keeps its name; an emptied box shows the saved title again.
                          el.value = step.title;
                          fitTextarea(el);
                          return;
                        }
                        if (next === step.title) return;
                        startTransition(() => renameTask(step.id, next));
                      }}
                      onKeyDown={(event) => {
                        // A title is one line: Enter saves it instead of starting a new line.
                        if (event.key === "Enter") {
                          event.preventDefault();
                          event.currentTarget.blur();
                        }
                      }}
                    />
                    {/* The note reads as text under the title and grows with it; tap to edit, it saves on leaving. */}
                    <form action={saveStepNotes}>
                      <input type="hidden" name="id" value={step.id} />
                      <AutoGrowTextarea
                        name="planNotes"
                        defaultValue={step.planNotes || ""}
                        rows={1}
                        placeholder="Add a note…"
                        className="-mx-1.5 mt-0.5 block w-[calc(100%+0.75rem)] rounded-lg border border-transparent bg-transparent px-1.5 py-0.5 text-sm leading-snug text-ink/80 outline-none placeholder:text-muted focus:border-[var(--accent)] focus:bg-white focus:text-ink"
                        onBlur={(e) => {
                          const form = e.currentTarget.form;
                          if (form) form.requestSubmit();
                        }}
                      />
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
        <AddStep taskId={task.id} hasSteps={task.children.length > 0} />
      </section>

      {/* With steps, the checklist comes first; the decision form stays fully visible below it. */}
      <form
        action={saveAction}
        onSubmit={(event) => {
          // Submitting through a transition keeps the typed values on screen
          // if the save comes back with an error (a plain form action resets them).
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(() => saveAction(data));
        }}
        className="card flex flex-col gap-4 p-4"
      >
        <input type="hidden" name="id" value={task.id} />
        <input type="hidden" name="returnTo" value={returnTo} />
        {canManageOwners ? <input type="hidden" name="manageOwners" value="1" /> : null}

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-muted">
            Decision title
          </span>
          <input
            name="title"
            required
            defaultValue={task.title}
            className="field-input text-[15px] font-semibold"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-muted">
            What is this
          </span>
          <AutoGrowTextarea
            name="summary"
            defaultValue={task.summary || ""}
            rows={2}
            placeholder="Short context for what this decision is about…"
            className="field-input text-[15px] leading-relaxed"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-muted">
            The plan / decision
          </span>
          <AutoGrowTextarea
            name="planNotes"
            defaultValue={task.planNotes || ""}
            rows={5}
            placeholder="Write what you’re doing, what you decided, who is helping, and anything still open…"
            className="field-input text-[15px] leading-relaxed"
          />
        </label>

        <div className="flex flex-wrap gap-2 text-xs text-muted">
          <span>{ownerNames || "Unassigned"}</span>
          {label ? (
            <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 font-semibold text-[var(--accent)]">
              {label}
            </span>
          ) : null}
          {childTotal > 0 ? (
            <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 font-semibold text-[var(--accent)]">
              {childDone}/{childTotal} steps done
            </span>
          ) : null}
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-muted">
            Due date
          </span>
          <input
            name="dueDate"
            type="date"
            defaultValue={dueDateValue}
            className="field-input text-[15px]"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Money needed
            </span>
            <input
              name="amountNeeded"
              inputMode="decimal"
              defaultValue={task.amountNeeded ?? ""}
              placeholder="0"
              className="field-input text-[15px]"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Money spent
            </span>
            <input
              name="amountSpent"
              inputMode="decimal"
              defaultValue={task.amountSpent || ""}
              placeholder="0"
              className="field-input text-[15px]"
            />
          </label>
        </div>

        {task.budgetItem ? (
          <p className="text-xs text-muted">
            Linked budget line: {task.budgetItem.name} · $
            {task.budgetItem.amountPaid.toLocaleString()} paid of $
            {task.budgetItem.price.toLocaleString()}
          </p>
        ) : null}

        <label className="flex min-h-[48px] items-center gap-3 rounded-xl border border-line px-3 py-3">
          <input
            type="checkbox"
            name="markDone"
            defaultChecked={task.status === "done"}
            className="h-6 w-6 accent-[var(--accent)]"
          />
          <span className="text-sm font-semibold">Mark this whole package completed</span>
        </label>

        {canManageOwners ? (
          <details className="rounded-xl border border-line px-3 py-2">
            <summary className="cursor-pointer text-sm font-semibold">
              Owners · {ownerNames || "Unassigned"}
            </summary>
            <div className="mt-3">
              <AssigneeFields people={people} selectedIds={selectedIds} allowNew />
            </div>
          </details>
        ) : (
          <p className="text-sm text-muted">Owners: {ownerNames || "Unassigned"}</p>
        )}

        {saveState.error ? (
          <p className="text-sm text-[var(--danger)]">{saveState.error}</p>
        ) : null}

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Save decision"}
        </button>
      </form>

    </div>
  );
}

/** "+ Add a step" at the end of the steps list; stays open to add several in a row. */
function AddStep({ taskId, hasSteps }: { taskId: string; hasSteps: boolean }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        className="btn-secondary self-start"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {hasSteps ? "+ Add a step" : "+ Add steps inside this"}
      </button>
    );
  }

  return (
    <form
      className="card flex flex-col gap-2 p-3 sm:p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const next = title.replace(/\s+/g, " ").trim();
        if (!next || pending) return;
        setError(null);
        startTransition(async () => {
          try {
            const result = await addTaskStep(taskId, next);
            if ("error" in result) {
              setError(result.error);
              return;
            }
            setTitle("");
            inputRef.current?.focus();
          } catch {
            setError("Couldn't add the step. Check the connection and try again.");
          }
        });
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-muted">
          New step
        </span>
        <input
          ref={inputRef}
          value={title}
          autoFocus
          enterKeyHint="done"
          placeholder="What needs doing?"
          className="field-input text-[15px]"
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending || !title.trim()}>
          {pending ? "Adding…" : "Add step"}
        </button>
        <button
          type="button"
          className="text-sm font-semibold text-muted"
          onClick={() => {
            setOpen(false);
            setTitle("");
            setError(null);
          }}
        >
          {title.trim() ? "Cancel" : "Done"}
        </button>
      </div>
    </form>
  );
}
