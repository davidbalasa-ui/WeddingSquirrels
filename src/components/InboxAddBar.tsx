"use client";

import { useState, useTransition } from "react";
import { createRequest, createShoppingItemFromInbox, createTaskFromInbox } from "@/app/actions";
import { defaultAssigneeIds } from "@/lib/people";
import type { PersonOption, TaskOption } from "@/lib/inbox";
import type { SessionAccount } from "@/lib/types";

type AccountOption = { id: string; name: string };

type ComposeKind = "ask" | "task" | "buy";

export function InboxAddBar({
  session,
  accounts,
  people,
  tasks,
  preferredAssigneeIds,
}: {
  session: SessionAccount;
  accounts: AccountOption[];
  people: PersonOption[];
  tasks: TaskOption[];
  preferredAssigneeIds?: string[];
}) {
  const kinds: ComposeKind[] = [];
  if (session.canSeeRequests) kinds.push("ask");
  if (session.canSeeTasks) kinds.push("task");
  if (session.canSeeShop) kinds.push("buy");

  const [kind, setKind] = useState<ComposeKind>(kinds[0] ?? "ask");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const recipients = accounts.filter((a) => a.id !== session.id);

  if (kinds.length === 0) return null;

  if (!open) {
    return (
      <div className="sticky top-[var(--header-offset,0px)] z-10 -mx-1 mb-3 bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] py-2 backdrop-blur-sm">
        <button
          type="button"
          className="btn-primary min-h-[48px] w-full"
          onClick={() => setOpen(true)}
        >
          {session.canSeeRequests ? "Ask someone" : kinds[0] === "task" ? "Add task" : "Add item"}
        </button>
      </div>
    );
  }

  return (
    <section className="card sticky top-0 z-10 mb-3 p-3">
      {kinds.length > 1 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              className="filter-pill rounded-full border px-3 py-1.5 text-xs font-semibold"
              data-active={kind === k}
              style={
                kind === k
                  ? {
                      borderColor: "var(--accent)",
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                    }
                  : undefined
              }
              onClick={() => setKind(k)}
            >
              {k === "ask" ? "Ask" : k === "task" ? "Task" : "Buy"}
            </button>
          ))}
        </div>
      ) : null}

      {kind === "ask" ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const fd = new FormData(event.currentTarget);
            startTransition(async () => {
              setError(null);
              await createRequest(fd);
              setOpen(false);
              event.currentTarget.reset();
            });
          }}
        >
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted">To</span>
            <select name="recipientAccountId" required className="field-input" defaultValue="">
              <option value="" disabled>
                Choose who…
              </option>
              {recipients.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted">What do you need?</span>
            <input name="title" required className="field-input" placeholder="Short title" autoFocus />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted">Message (optional)</span>
            <textarea name="note" rows={2} className="field-input resize-y" placeholder="Details…" />
          </label>
          {session.canSeeTasks ? (
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted">Related decision (optional)</span>
              <select name="taskId" defaultValue="" className="field-input">
                <option value="">None</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <ComposeActions pending={pending} onCancel={() => setOpen(false)} submitLabel="Send ask" />
        </form>
      ) : null}

      {kind === "task" ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const fd = new FormData(event.currentTarget);
            const title = String(fd.get("title") || "");
            const dueDate = String(fd.get("dueDate") || "");
            const assignees = defaultAssigneeIds(people, preferredAssigneeIds);
            startTransition(async () => {
              setError(null);
              const result = await createTaskFromInbox(title, dueDate || undefined, assignees);
              if ("error" in result) {
                setError(result.error);
                return;
              }
              setOpen(false);
              event.currentTarget.reset();
            });
          }}
        >
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted">Task</span>
            <input name="title" required className="field-input" placeholder="What needs deciding?" autoFocus />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted">Due (optional)</span>
            <input name="dueDate" type="date" className="field-input" />
          </label>
          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
          <ComposeActions pending={pending} onCancel={() => setOpen(false)} submitLabel="Add task" />
        </form>
      ) : null}

      {kind === "buy" ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const fd = new FormData(event.currentTarget);
            const name = String(fd.get("name") || "");
            const ownerId = String(fd.get("ownerId") || "");
            startTransition(async () => {
              setError(null);
              await createShoppingItemFromInbox(name, ownerId || null);
              setOpen(false);
              event.currentTarget.reset();
            });
          }}
        >
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted">Item</span>
            <input name="name" required className="field-input" placeholder="What to buy?" autoFocus />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted">Who&apos;s buying</span>
            <select name="ownerId" defaultValue="" className="field-input">
              <option value="">Both / unset</option>
              <option value="david">David</option>
              <option value="haley">Haley</option>
            </select>
          </label>
          <ComposeActions pending={pending} onCancel={() => setOpen(false)} submitLabel="Add to list" />
        </form>
      ) : null}
    </section>
  );
}

function ComposeActions({
  pending,
  onCancel,
  submitLabel,
}: {
  pending: boolean;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <button type="submit" className="btn-primary min-h-[44px]" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </button>
      <button type="button" className="btn-secondary min-h-[44px]" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
