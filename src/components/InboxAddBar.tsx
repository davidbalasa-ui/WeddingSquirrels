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
  pinToTop = false,
}: {
  session: SessionAccount;
  accounts: AccountOption[];
  people: PersonOption[];
  tasks: TaskOption[];
  preferredAssigneeIds?: string[];
  /** When true, skip sticky positioning (e.g. add bar already at page top). */
  pinToTop?: boolean;
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

  const collapsedWrapClass = pinToTop
    ? "-mx-1 mb-4 py-1"
    : "sticky top-[var(--header-offset,0px)] z-10 -mx-1 bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] py-1 backdrop-blur-sm";

  const openWrapClass = pinToTop
    ? "mb-4 overflow-hidden border border-line"
    : "sticky top-0 z-10 overflow-hidden border border-line";

  function openCompose(nextKind: ComposeKind) {
    setKind(nextKind);
    setOpen(true);
    setError(null);
  }

  if (!open) {
    return (
      <div className={collapsedWrapClass}>
        {kinds.length === 1 ? (
          <button
            type="button"
            className="btn-primary min-h-[44px] w-full"
            onClick={() => openCompose(kinds[0])}
          >
            {kinds[0] === "ask" ? "Ask someone" : kinds[0] === "task" ? "Add task" : "Add item"}
          </button>
        ) : (
          <div className="flex gap-2">
            {kinds.map((k) => (
              <button
                key={k}
                type="button"
                className="btn-primary min-h-[44px] flex-1"
                onClick={() => openCompose(k)}
              >
                {k === "ask" ? "Ask" : k === "task" ? "Task" : "Buy"}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <section className={openWrapClass}>
      {kinds.length > 1 ? (
        <div className="flex border-b border-line">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              className={`flex-1 border-b-2 px-2 py-2 text-xs font-semibold ${
                kind === k
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-transparent text-muted"
              }`}
              onClick={() => setKind(k)}
            >
              {k === "ask" ? "Ask" : k === "task" ? "Task" : "Buy"}
            </button>
          ))}
        </div>
      ) : null}

      <div className="p-2">
        {kind === "ask" ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const fd = new FormData(form);
              startTransition(async () => {
                setError(null);
                await createRequest(fd);
                form.reset();
                setOpen(false);
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
              const form = event.currentTarget;
              const fd = new FormData(form);
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
                form.reset();
                setOpen(false);
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
              const form = event.currentTarget;
              const fd = new FormData(form);
              const name = String(fd.get("name") || "");
              const ownerId = String(fd.get("ownerId") || "");
              startTransition(async () => {
                setError(null);
                await createShoppingItemFromInbox(name, ownerId || null);
                form.reset();
                setOpen(false);
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
      </div>
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
