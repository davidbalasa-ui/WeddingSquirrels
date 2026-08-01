"use client";

import { useTransition } from "react";
import { saveStepNotes, saveTaskWorkspace, toggleTaskDone } from "@/app/actions";
import { EscalatePriorityButton } from "@/components/EscalatePriorityButton";
import { AssigneeFields } from "@/components/AssigneeFields";
import type { TaskWorkspace } from "@/lib/tasks";
import { dueLabel } from "@/lib/tasks";

type PersonOption = { id: string; name: string };

export function TaskWorkspaceForm({
  task,
  people,
  canManageOwners,
}: {
  task: TaskWorkspace;
  people: PersonOption[];
  canManageOwners: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const label = dueLabel(task.dueDate, task.status);
  const dueDateValue = task.dueDate
    ? `${task.dueDate.getFullYear()}-${String(task.dueDate.getMonth() + 1).padStart(2, "0")}-${String(task.dueDate.getDate()).padStart(2, "0")}`
    : "";
  const ownerNames = task.assignees.map((a) => a.person.name).join(" · ");
  const childTotal = task.children.length;
  const childDone = task.children.filter((c) => c.status === "done").length;
  const selectedIds = task.assignees.map((a) => a.personId);
  const escalated = Boolean(task.escalatedAt);

  return (
    <div className="flex flex-col gap-4 pb-8">
      {escalated ? (
        <section className="card border-[var(--warn)] bg-[var(--warn-soft)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--warn)]">
            Priority pin active
          </p>
          <p className="mt-1 text-sm text-[var(--warn)]">
            Pinned to the top of Today{task.escalatedBy ? ` by ${task.escalatedBy}` : ""}.
          </p>
        </section>
      ) : null}

      <EscalatePriorityButton taskId={task.id} escalated={escalated} />

      <section className="card p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">What is this</p>
        <p className="mt-2 text-sm leading-relaxed text-ink">
          {task.summary || "A decision you need to make and finish."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
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
      </section>

      <form action={saveTaskWorkspace} className="card flex flex-col gap-4 p-4">
        <input type="hidden" name="id" value={task.id} />

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-muted">
            The plan / decision
          </span>
          <textarea
            name="planNotes"
            defaultValue={task.planNotes || ""}
            rows={5}
            placeholder="Write what you’re doing, what you decided, who is helping, and anything still open…"
            className="field-input text-[15px] leading-relaxed"
          />
        </label>

        {canManageOwners ? (
          <AssigneeFields people={people} selectedIds={selectedIds} allowNew />
        ) : (
          <p className="text-sm text-muted">Owners: {ownerNames || "Unassigned"}</p>
        )}

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
          <span className="text-sm font-semibold">Mark this decision completed</span>
        </label>

        <button type="submit" className="btn-primary">
          Save decision
        </button>
      </form>

      {task.children.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl">Steps inside this</h2>
          <p className="text-sm text-muted">
            Each step can have its own note. Check it when that piece is finished.
          </p>
          {task.children.map((step) => {
            const stepDone = step.status === "done";
            return (
              <article key={step.id} className={`card p-4 ${stepDone ? "opacity-70" : ""}`}>
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    aria-label={stepDone ? "Mark step not done" : "Mark step done"}
                    disabled={pending}
                    onClick={() => startTransition(() => toggleTaskDone(step.id))}
                    className="step-check mt-0.5 shrink-0"
                    style={{
                      background: stepDone ? "var(--accent)" : "transparent",
                      color: stepDone ? "white" : "var(--muted)",
                    }}
                  >
                    {stepDone ? "✓" : ""}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[15px] font-semibold leading-snug ${stepDone ? "line-through" : ""}`}>
                      {step.title}
                    </p>
                    <form action={saveStepNotes} className="mt-2">
                      <input type="hidden" name="id" value={step.id} />
                      <textarea
                        name="planNotes"
                        defaultValue={step.planNotes || ""}
                        rows={2}
                        placeholder="Notes for this step…"
                        className="w-full resize-y rounded-xl border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                        onBlur={(e) => {
                          const form = e.currentTarget.form;
                          if (form) form.requestSubmit();
                        }}
                      />
                    </form>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
