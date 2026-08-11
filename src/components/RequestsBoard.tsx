"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
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
} from "@/lib/requests";

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
  createdAt: string;
  completedAt: string | null;
  declinedAt: string | null;
};

type AccountOption = { id: string; name: string };
type TaskOption = { id: string; title: string };
type Tab = "needs" | "waiting" | "closed";

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
  const [pending, startTransition] = useTransition();

  const recipients = accounts.filter((a) => a.id !== session.id);

  const grouped = useMemo(() => {
    const needs = requests.filter(
      (r) => r.status === "open" && r.recipientAccountId === session.id,
    );
    const waiting = requests.filter(
      (r) => r.status === "open" && r.senderAccountId === session.id,
    );
    const closed = requests.filter((r) => r.status === "done" || r.status === "declined");

    // Masters also see open requests they didn't send/receive in "needs" if they're recipient,
    // and all other open ones that aren't theirs can go in waiting? Keep simple:
    // For masters who aren't sender/recipient, show open under needs.
    if (session.isMaster) {
      const seen = new Set([...needs, ...waiting].map((r) => r.id));
      for (const r of requests) {
        if (r.status === "open" && !seen.has(r.id)) needs.push(r);
      }
    }

    return { needs, waiting, closed };
  }, [requests, session.id, session.isMaster]);

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
              <span className="mb-1 block text-xs text-muted">Note (optional)</span>
              <textarea
                name="note"
                rows={3}
                placeholder="Details, deadline, context…"
                className="field-input resize-y"
              />
            </label>
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
          {list.map((row) => {
            const open = openId === row.id;
            const unread =
              row.status === "open" &&
              row.recipientAccountId === session.id &&
              !row.readAt;
            const rowPerm = {
              id: row.id,
              status: row.status,
              senderAccountId: row.senderAccountId,
              recipientAccountId: row.recipientAccountId,
              readAt: row.readAt ? new Date(row.readAt) : null,
            };
            const perms = {
              complete: canCompleteRequest(session, rowPerm),
              decline: canDeclineRequest(session, rowPerm),
              reopen: canReopenRequest(session, rowPerm),
              edit: canEditRequest(session, rowPerm),
              delete: canDeleteRequest(session, rowPerm),
            };

            return (
              <article key={row.id} className="card p-4">
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 text-left"
                  onClick={() => {
                    const next = open ? null : row.id;
                    setOpenId(next);
                    if (next && unread) {
                      startTransition(async () => {
                        await markRequestRead(row.id);
                      });
                    }
                  }}
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
                    </p>
                  </div>
                  <span className="step-check shrink-0 text-sm text-muted">{open ? "−" : "+"}</span>
                </button>

                {open ? (
                  <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
                    {row.note ? <p className="text-sm whitespace-pre-wrap">{row.note}</p> : null}
                    {row.taskId && row.taskTitle ? (
                      <Link
                        href={`/work/${row.taskId}`}
                        className="text-sm font-semibold text-[var(--accent)]"
                      >
                        Related: {row.taskTitle}
                      </Link>
                    ) : null}
                    {row.status === "declined" && row.declineNote ? (
                      <p className="text-sm text-[var(--danger)]">Declined: {row.declineNote}</p>
                    ) : null}

                    {perms.edit ? (
                      <form action={saveRequest} className="flex flex-col gap-3">
                        <input type="hidden" name="id" value={row.id} />
                        <label className="text-sm">
                          <span className="mb-1 block text-xs text-muted">Title</span>
                          <input
                            name="title"
                            required
                            defaultValue={row.title}
                            className="field-input"
                          />
                        </label>
                        <label className="text-sm">
                          <span className="mb-1 block text-xs text-muted">Note</span>
                          <textarea
                            name="note"
                            rows={3}
                            defaultValue={row.note ?? ""}
                            className="field-input resize-y"
                          />
                        </label>
                        <label className="text-sm">
                          <span className="mb-1 block text-xs text-muted">Related decision</span>
                          <select
                            name="taskId"
                            defaultValue={row.taskId ?? ""}
                            className="field-input"
                          >
                            <option value="">None</option>
                            {tasks.map((task) => (
                              <option key={task.id} value={task.id}>
                                {task.title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button type="submit" className="btn-primary" disabled={pending}>
                          Save changes
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
                      {perms.reopen ? (
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={pending}
                          onClick={() =>
                            startTransition(async () => {
                              await reopenRequest(row.id);
                            })
                          }
                        >
                          Reopen
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
                              setOpenId(null);
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
                          <input
                            name="declineNote"
                            placeholder="Why not / later?"
                            className="field-input"
                          />
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
          })}
        </div>
      )}
    </div>
  );
}
