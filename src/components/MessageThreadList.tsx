"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createRequest } from "@/app/actions";
import { requestUnreadRefresh } from "@/components/AskNotifier";
import type { MessageThreadSummary, ThreadRecipient } from "@/lib/messages";
import { AutoGrowTextarea } from "@/components/AutoGrowTextarea";

function relativeTime(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMinutes = Math.round((now.getTime() - date.getTime()) / 60_000);
  if (diffMinutes < 1) return "now";
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24 && date.getDate() === now.getDate()) return `${diffHours}h`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function statusLabel(status: string): string | null {
  if (status === "done") return "Done";
  if (status === "declined") return "Declined";
  return null;
}

export function MessageThreadList({
  threads,
  recipients,
}: {
  threads: MessageThreadSummary[];
  recipients: ThreadRecipient[];
}) {
  const router = useRouter();
  const [composing, setComposing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="pb-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          {threads.length === 0 ? "No conversations yet" : `${threads.length} conversation${threads.length === 1 ? "" : "s"}`}
        </p>
        {recipients.length > 0 ? (
          <button
            type="button"
            className={composing ? "btn-secondary min-h-11 px-4 text-sm" : "btn-primary min-h-11 px-4 text-sm"}
            onClick={() => {
              setError(null);
              setComposing((open) => !open);
            }}
          >
            {composing ? "Cancel" : "New message"}
          </button>
        ) : null}
      </div>

      {composing ? (
        <form
          className="card mb-5 flex flex-col gap-3 p-4"
          onSubmit={(event) => {
            // Submitting by hand keeps the typed message on screen if sending fails.
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            setError(null);
            // The server drops a blank title silently; say so instead of closing the form.
            if (!String(formData.get("title") || "").trim()) {
              setError("Add what it's about.");
              return;
            }
            startTransition(async () => {
              try {
                await createRequest(formData);
                setComposing(false);
                requestUnreadRefresh();
                router.refresh();
              } catch {
                setError("Couldn't send — try again.");
              }
            });
          }}
        >
          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted" htmlFor="message-to">
            To
          </label>
          <select id="message-to" name="recipientAccountId" required className="field-input" defaultValue="">
            <option value="" disabled>
              Choose a person
            </option>
            {recipients.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted" htmlFor="message-title">
            What is it about?
          </label>
          <input
            id="message-title"
            name="title"
            required
            maxLength={120}
            className="field-input"
            placeholder="e.g. Cake stand pickup"
            autoComplete="off"
          />
          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted" htmlFor="message-note">
            Message
          </label>
          <AutoGrowTextarea
            id="message-note"
            name="note"
            rows={3}
            className="field-input"
            placeholder="Write your message…"
          />
          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
          <button type="submit" className="btn-primary self-start" disabled={pending}>
            {pending ? "Sending…" : "Send"}
          </button>
        </form>
      ) : null}

      {threads.length === 0 && !composing ? (
        <p className="text-base text-muted">
          Start a conversation with anyone who has a PIN. Asks you send from Today show up here too.
        </p>
      ) : null}

      <ul className="divide-y divide-[var(--line)]">
        {threads.map((thread) => {
          const status = statusLabel(thread.status);
          return (
            <li key={thread.id}>
              <Link
                href={`/messages/${thread.id}`}
                className="flex items-start gap-3 py-3.5"
                data-unread={thread.unread}
              >
                <span
                  aria-hidden="true"
                  className="mt-2 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: thread.unread ? "var(--accent)" : "transparent" }}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className={`truncate text-[15px] ${thread.unread ? "font-bold" : "font-semibold"}`}>
                      {thread.withName}
                    </span>
                    <span className="shrink-0 text-xs text-muted">{relativeTime(thread.lastAt)}</span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className="truncate text-sm text-muted">{thread.title}</span>
                    {status ? (
                      <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                        {status}
                      </span>
                    ) : null}
                  </span>
                  {thread.lastBody ? (
                    <span
                      className={`mt-0.5 block truncate text-sm ${thread.unread ? "text-ink" : "text-muted"}`}
                    >
                      {thread.lastFromMe ? "You: " : ""}
                      {thread.lastBody}
                    </span>
                  ) : null}
                </span>
                {thread.unread ? <span className="sr-only">Unread</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
