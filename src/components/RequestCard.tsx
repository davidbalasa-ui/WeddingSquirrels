"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  completeRequest,
  declineRequest,
  deleteRequest,
  markRequestRead,
  reopenRequest,
  saveRequest,
} from "@/app/actions";

export type RequestView = {
  id: string;
  title: string;
  note: string | null;
  status: string;
  senderAccountId: string;
  recipientAccountId: string;
  taskId: string | null;
  readAt: string | null;
  completedAt: string | null;
  declinedAt: string | null;
  declineNote: string | null;
  createdAt: string;
  senderAccount: { id: string; name: string };
  recipientAccount: { id: string; name: string };
  task: { id: string; title: string } | null;
};

type TaskOption = { id: string; title: string };

type Caps = {
  canEdit: boolean;
  canComplete: boolean;
  canDecline: boolean;
  canReopen: boolean;
  canDelete: boolean;
  isRecipient: boolean;
  isUnread: boolean;
};

function statusLabel(status: string) {
  if (status === "done") return "Done";
  if (status === "declined") return "Declined";
  return "Open";
}

export function RequestCard({
  request,
  tasks,
  caps,
  defaultOpen = false,
}: {
  request: RequestView;
  tasks: TaskOption[];
  caps: Caps;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [declining, setDeclining] = useState(false);
  const [pending, startTransition] = useTransition();
  const unread = caps.isUnread && !open;

  useEffect(() => {
    if (!open || !caps.isRecipient || request.readAt) return;
    startTransition(() => markRequestRead(request.id));
  }, [open, caps.isRecipient, request.id, request.readAt]);

  return (
    <article
      className={`card overflow-hidden ${request.status !== "open" ? "opacity-80" : ""}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-h-[56px] items-start justify-between gap-3 p-4 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{request.title}</p>
            {unread ? (
              <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                New
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted">
            {caps.isRecipient
              ? `From ${request.senderAccount.name}`
              : `To ${request.recipientAccount.name}`}
            {" · "}
            {statusLabel(request.status)}
          </p>
          {request.task ? (
            <p className="mt-1 text-xs font-semibold text-[var(--accent)]">
              {request.task.title}
            </p>
          ) : null}
          {request.note && !open ? (
            <p className="mt-1.5 line-clamp-2 text-sm text-muted">{request.note}</p>
          ) : null}
        </div>
        <span className="mt-0.5 shrink-0 text-lg text-muted" aria-hidden>
          {open ? "−" : "+"}
        </span>
      </button>

      {request.task && !open ? (
        <div className="border-t border-line px-4 py-2">
          <Link
            href={`/work/${request.task.id}`}
            className="inline-flex min-h-[44px] items-center text-sm font-semibold text-[var(--accent)]"
          >
            Open decision →
          </Link>
        </div>
      ) : null}

      {open ? (
        <div className="flex flex-col gap-3 border-t border-line p-4">
          {caps.canEdit ? (
            <form
              action={async (fd) => {
                await saveRequest(fd);
                setOpen(false);
              }}
              className="flex flex-col gap-3"
            >
              <input type="hidden" name="id" value={request.id} />
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-muted">Title</span>
                <input
                  name="title"
                  required
                  defaultValue={request.title}
                  className="field-input"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-muted">Note</span>
                <textarea
                  name="note"
                  rows={3}
                  defaultValue={request.note ?? ""}
                  className="field-input resize-y"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-muted">Related decision</span>
                <select
                  name="taskId"
                  defaultValue={request.taskId ?? ""}
                  className="field-input"
                >
                  <option value="">None</option>
                  {tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                  {request.task && !tasks.some((t) => t.id === request.task!.id) ? (
                    <option value={request.task.id}>{request.task.title}</option>
                  ) : null}
                </select>
              </label>
              <button type="submit" className="btn-primary">
                Save request
              </button>
            </form>
          ) : (
            <div className="flex flex-col gap-2">
              {request.note ? (
                <p className="text-sm leading-relaxed text-ink">{request.note}</p>
              ) : (
                <p className="text-sm text-muted">No note.</p>
              )}
              {request.task ? (
                <Link
                  href={`/work/${request.task.id}`}
                  className="inline-flex min-h-[44px] items-center text-sm font-semibold text-[var(--accent)]"
                >
                  Open decision →
                </Link>
              ) : null}
              {request.status === "declined" && request.declineNote ? (
                <p className="rounded-xl bg-[var(--warn-soft)] px-3 py-2 text-sm text-[var(--warn)]">
                  Decline note: {request.declineNote}
                </p>
              ) : null}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {caps.canComplete ? (
              <button
                type="button"
                className="btn-primary"
                disabled={pending}
                onClick={() => startTransition(() => completeRequest(request.id))}
              >
                Mark done
              </button>
            ) : null}
            {caps.canDecline ? (
              <button
                type="button"
                className="btn-secondary"
                disabled={pending}
                onClick={() => setDeclining((v) => !v)}
              >
                Decline
              </button>
            ) : null}
            {caps.canReopen ? (
              <button
                type="button"
                className="btn-secondary"
                disabled={pending}
                onClick={() => startTransition(() => reopenRequest(request.id))}
              >
                Reopen
              </button>
            ) : null}
            {caps.canDelete ? (
              <button
                type="button"
                className="btn-secondary"
                disabled={pending}
                onClick={() => startTransition(() => deleteRequest(request.id))}
              >
                Delete
              </button>
            ) : null}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>

          {declining && caps.canDecline ? (
            <form
              action={async (fd) => {
                await declineRequest(fd);
                setDeclining(false);
                setOpen(false);
              }}
              className="flex flex-col gap-3 rounded-xl border border-line p-3"
            >
              <input type="hidden" name="id" value={request.id} />
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-muted">
                  Why decline? (optional)
                </span>
                <textarea
                  name="declineNote"
                  rows={2}
                  className="field-input resize-y"
                  placeholder="Optional note for the sender"
                />
              </label>
              <button type="submit" className="btn-primary">
                Confirm decline
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
