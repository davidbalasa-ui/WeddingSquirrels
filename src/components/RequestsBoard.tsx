"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  addRequestMessage,
  completeRequest,
  createRequest,
  declineRequest,
  deleteRequest,
  markRequestRead,
  reopenRequest,
  saveRequest,
} from "@/app/actions";
import type { SessionAccount } from "@/lib/types";
import {
  canCompleteRequest,
  canDeclineRequest,
  canDeleteRequest,
  canEditRequest,
  canReopenRequest,
  canReplyToRequest,
  isRequestUnread,
} from "@/lib/requests";

export type RequestMessageView = {
  id: string;
  body: string;
  authorAccountId: string;
  authorName: string;
  createdAt: string;
};

export type RequestView = {
  id: string;
  title: string;
  note: string | null;
  status: string;
  senderAccountId: string;
  recipientAccountId: string;
  senderName: string;
  recipientName: string;
  taskId: string | null;
  taskTitle: string | null;
  declineNote: string | null;
  readAt: string | null;
  senderReadAt: string | null;
  createdAt: string;
  completedAt: string | null;
  declinedAt: string | null;
  messages: RequestMessageView[];
};

type AccountOption = { id: string; name: string };
type TaskOption = { id: string; title: string };
type Tab = "needs" | "waiting" | "closed";

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function RequestsBoard({
  session,
  requests,
  accounts,
  tasks,
}: {
  session: SessionAccount;
  requests: RequestView[];
  accounts: AccountOption[];
  tasks: TaskOption[];
}) {
  const [tab, setTab] = useState<Tab>("needs");
  const [openId, setOpenId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [, startTransition] = useTransition();

  const recipients = accounts.filter((a) => a.id !== session.id);

  const grouped = useMemo(() => {
    // Sections are role-based, not read-based: asks sent TO me are "Needs you",
    // asks I SENT are "Waiting". Marking an ask read on expand therefore never
    // moves it between tabs or re-sorts it out of place.
    const needs = requests.filter(
      (row) => row.status === "open" && row.recipientAccountId === session.id,
    );
    const waiting = requests.filter(
      (row) => row.status === "open" && row.senderAccountId === session.id,
    );
    const closed = requests.filter((row) => row.status === "done" || row.status === "declined");

    if (session.isMaster) {
      const seen = new Set([...needs, ...waiting, ...closed].map((row) => row.id));
      for (const row of requests) {
        if (row.status === "open" && !seen.has(row.id)) needs.push(row);
      }
    }

    return { needs, waiting, closed };
  }, [requests, session]);

  const list =
    tab === "needs" ? grouped.needs : tab === "waiting" ? grouped.waiting : grouped.closed;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["needs", "Needs you", grouped.needs.length],
            ["waiting", "Waiting", grouped.waiting.length],
            ["closed", "Closed", grouped.closed.length],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            className="filter-pill rounded-full border px-3.5 py-2 text-sm font-semibold"
            data-active={tab === key}
            style={
              tab === key
                ? {
                    borderColor: "var(--accent)",
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                  }
                : undefined
            }
            onClick={() => {
              setTab(key);
              setOpenId(null);
            }}
          >
            {label}
            {count > 0 ? ` · ${count}` : ""}
          </button>
        ))}
      </div>

      <section className="card p-4">
        {composing ? (
          <form
            action={async (fd) => {
              await createRequest(fd);
              setComposing(false);
            }}
            className="flex flex-col gap-3"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
              New ask
            </p>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted">Ask</span>
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
              <span className="mb-1 block text-xs text-muted">Title</span>
              <input
                name="title"
                required
                placeholder="What do you need?"
                className="field-input"
                autoFocus
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted">Message</span>
              <textarea
                name="note"
                rows={3}
                placeholder="Details, deadline, context…"
                className="field-input resize-y"
              />
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
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn-primary">
                Send ask
              </button>
              <button type="button" className="btn-secondary" onClick={() => setComposing(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className="btn-primary w-full" onClick={() => setComposing(true)}>
            Ask someone
          </button>
        )}
      </section>

      {list.length === 0 ? (
        <div className="card p-5 text-sm text-muted">
          {tab === "needs"
            ? "Nothing waiting on you."
            : tab === "waiting"
              ? "No open asks you sent."
              : "No closed asks yet."}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((row) => (
            <RequestCard
              key={row.id}
              row={row}
              session={session}
              tasks={tasks}
              open={openId === row.id}
              onToggle={(nextOpen) => {
                setOpenId(nextOpen ? row.id : null);
                if (nextOpen) {
                  startTransition(async () => {
                    await markRequestRead(row.id);
                  });
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestCard({
  row,
  session,
  tasks,
  open,
  onToggle,
}: {
  row: RequestView;
  session: SessionAccount;
  tasks: TaskOption[];
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  const [reply, setReply] = useState("");
  const [pending, startTransition] = useTransition();
  const rowPerm = {
    id: row.id,
    status: row.status,
    senderAccountId: row.senderAccountId,
    recipientAccountId: row.recipientAccountId,
    readAt: row.readAt ? new Date(row.readAt) : null,
    senderReadAt: row.senderReadAt ? new Date(row.senderReadAt) : null,
  };
  const unread = isRequestUnread(session, rowPerm);
  const perms = {
    complete: canCompleteRequest(session, rowPerm),
    decline: canDeclineRequest(session, rowPerm),
    reopen: canReopenRequest(session, rowPerm),
    edit: canEditRequest(session, rowPerm),
    delete: canDeleteRequest(session, rowPerm),
    reply: canReplyToRequest(session, rowPerm),
  };

  return (
    <article className="card p-4">
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start justify-between gap-3 text-left"
          onClick={() => onToggle(!open)}
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">{row.title}</h3>
              {unread ? (
                <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--accent)]">
                  New
                </span>
              ) : null}
              {row.status !== "open" ? (
                <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                  {row.status}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-muted">
              {row.senderAccountId === session.id
                ? `To ${row.recipientName}`
                : `From ${row.senderName}`}
              {" · "}
              {formatWhen(row.createdAt)}
              {row.messages.length > 0 ? ` · ${row.messages.length} messages` : ""}
            </p>
          </div>
          <span className="step-check shrink-0 text-sm text-muted">{open ? "−" : "+"}</span>
        </button>
        {perms.reopen ? (
          <button
            type="button"
            className="shrink-0 rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)]"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                await reopenRequest(row.id);
                onToggle(false);
              });
            }}
          >
            Reopen
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
          <RequestThread messages={row.messages} sessionId={session.id} />

          {row.taskId && row.taskTitle && session.canSeeTasks ? (
            <Link href={`/work/${row.taskId}`} className="text-sm font-semibold text-[var(--accent)]">
              Related: {row.taskTitle}
            </Link>
          ) : row.taskId && row.taskTitle ? (
            <p className="text-sm text-muted">Related decision: {row.taskTitle}</p>
          ) : null}

          {row.status === "declined" && row.declineNote ? (
            <p className="text-sm text-[var(--danger)]">Declined: {row.declineNote}</p>
          ) : null}

          {perms.reply ? (
            <form
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const body = reply.trim();
                if (!body) return;
                startTransition(async () => {
                  await addRequestMessage(row.id, body);
                  setReply("");
                });
              }}
            >
              <label className="text-sm">
                <span className="mb-1 block text-xs text-muted">Reply</span>
                <textarea
                  value={reply}
                  rows={3}
                  placeholder="Write a reply…"
                  className="field-input resize-y"
                  onChange={(event) => setReply(event.target.value)}
                />
              </label>
              <button type="submit" className="btn-primary self-start" disabled={pending || !reply.trim()}>
                {pending ? "Sending…" : "Send reply"}
              </button>
            </form>
          ) : null}

          {perms.edit ? (
            <form action={saveRequest} className="flex flex-col gap-3">
              <input type="hidden" name="id" value={row.id} />
              <label className="text-sm">
                <span className="mb-1 block text-xs text-muted">Title</span>
                <input name="title" required defaultValue={row.title} className="field-input" />
              </label>
              {session.canSeeTasks ? (
                <label className="text-sm">
                  <span className="mb-1 block text-xs text-muted">Related decision</span>
                  <select name="taskId" defaultValue={row.taskId ?? ""} className="field-input">
                    <option value="">None</option>
                    {tasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <input type="hidden" name="taskId" value={row.taskId ?? ""} />
              )}
              <button type="submit" className="btn-secondary" disabled={pending}>
                Save title
              </button>
            </form>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {perms.complete ? (
              <button
                type="button"
                className="btn-primary"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await completeRequest(row.id);
                  })
                }
              >
                Done
              </button>
            ) : null}
            {perms.delete ? (
              <button
                type="button"
                className="text-sm font-semibold text-[var(--danger)]"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await deleteRequest(row.id);
                  })
                }
              >
                Delete
              </button>
            ) : null}
          </div>

          {perms.decline ? (
            <form action={declineRequest} className="flex flex-col gap-2">
              <input type="hidden" name="id" value={row.id} />
              <label className="text-sm">
                <span className="mb-1 block text-xs text-muted">Decline note (optional)</span>
                <input name="declineNote" placeholder="Why not / later?" className="field-input" />
              </label>
              <button type="submit" className="btn-secondary">
                Decline
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function RequestThread({
  messages,
  sessionId,
}: {
  messages: RequestMessageView[];
  sessionId: string;
}) {
  if (messages.length === 0) {
    return <p className="text-sm text-muted">No messages yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {messages.map((message) => {
        const mine = message.authorAccountId === sessionId;
        return (
          <div
            key={message.id}
            className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-5 ${
              mine
                ? "ml-auto bg-[var(--accent-soft)] text-ink"
                : "mr-auto border border-line bg-[var(--bg-elevated)]"
            }`}
          >
            <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              {mine ? "You" : message.authorName}
              {" · "}
              {formatTime(message.createdAt)}
            </p>
            <p className="whitespace-pre-wrap">{message.body}</p>
          </div>
        );
      })}
    </div>
  );
}
