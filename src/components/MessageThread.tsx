"use client";
import { BackLink } from "@/components/BackLink";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { addRequestMessage, completeRequest, markRequestRead, reopenRequest } from "@/app/actions";
import { requestUnreadRefresh } from "@/components/AskNotifier";
import type { MessageThreadMessage, MessageThreadView } from "@/lib/messages";

const THREAD_REFRESH_MS = 12_000;

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  if (sameDay) return "Today";
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function timeLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

type OptimisticMessage = MessageThreadMessage & { pending?: boolean };

export function MessageThread({ thread }: { thread: MessageThreadView }) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, startSending] = useTransition();
  const [, startStatus] = useTransition();
  const [messages, addOptimistic] = useOptimistic<OptimisticMessage[], OptimisticMessage>(
    thread.messages,
    (current, next) => [...current, next],
  );
  // Done / Reopen flip on tap; the server copy replaces it after the action.
  const [status, setOptimisticStatus] = useOptimistic(thread.status);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mark the thread read when it is on screen, and again when new messages arrive.
  useEffect(() => {
    if (!thread.unread || document.visibilityState !== "visible") return;
    startStatus(async () => {
      try {
        await markRequestRead(thread.id);
        requestUnreadRefresh();
      } catch {
        /* a failed read receipt is harmless */
      }
    });
  }, [thread.id, thread.unread, thread.messages.length]);

  // While the conversation is open, pull new replies without waiting for the global poll.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible" && navigator.onLine) router.refresh();
    };
    const interval = window.setInterval(tick, THREAD_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setError(null);
    const optimistic: OptimisticMessage = {
      id: `pending-${Date.now()}`,
      body,
      authorAccountId: "me",
      authorName: "You",
      createdAt: new Date().toISOString(),
      mine: true,
      isNew: false,
      pending: true,
    };
    setDraft("");
    startSending(async () => {
      addOptimistic(optimistic);
      try {
        await addRequestMessage(thread.id, body);
        requestUnreadRefresh();
        router.refresh();
      } catch {
        setDraft(body);
        setError("Couldn't send — check your connection and try again.");
      }
    });
    textareaRef.current?.focus();
  }

  function setStatus(nextStatus: "done" | "open", action: () => Promise<void>) {
    setError(null);
    startStatus(async () => {
      setOptimisticStatus(nextStatus);
      try {
        await action();
        requestUnreadRefresh();
        router.refresh();
      } catch {
        setError("Couldn't update — try again.");
      }
    });
  }

  const statusLabel = status === "done" ? "Done" : status === "declined" ? "Declined" : null;
  const showComplete = status === "open" && (thread.canComplete || thread.canReopen);
  const showReopen = status !== "open" && (thread.canReopen || thread.canComplete);

  return (
    <div className="flex min-h-[calc(100dvh-140px)] flex-col pb-2">
      <header className="sticky top-0 z-20 -mx-4 border-b border-line bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <BackLink
            href="/messages"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-lg text-[var(--accent)]"
            aria-label="Back to messages"
          >
            ←
          </BackLink>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-[family-name:var(--font-display)] text-2xl leading-tight tracking-tight">
              {thread.withName}
            </h1>
            <p className="mt-0.5 flex items-center gap-2 text-sm text-muted">
              <span className="truncate">{thread.title}</span>
              {statusLabel ? (
                <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                  {statusLabel}
                </span>
              ) : null}
            </p>
          </div>
          {showComplete ? (
            <button
              type="button"
              className="btn-secondary min-h-10 px-3 text-xs"
              onClick={() => setStatus("done", () => completeRequest(thread.id))}
            >
              Mark done
            </button>
          ) : showReopen ? (
            <button
              type="button"
              className="btn-secondary min-h-10 px-3 text-xs"
              onClick={() => setStatus("open", () => reopenRequest(thread.id))}
            >
              Reopen
            </button>
          ) : null}
        </div>
        {thread.linkedTaskHref && thread.linkedTaskTitle ? (
          <Link href={thread.linkedTaskHref} className="mt-2 block text-sm font-semibold text-[var(--accent)]">
            Related: {thread.linkedTaskTitle}
          </Link>
        ) : null}
        {!thread.isParticipant ? (
          <p className="mt-2 text-xs text-muted">
            You are viewing {thread.senderName} and {thread.recipientName}&apos;s conversation.
          </p>
        ) : null}
      </header>

      <div className="flex flex-1 flex-col gap-2 pt-4">
        {messages.length === 0 && thread.note ? (
          <div className="chat-bubble" data-mine={thread.senderName === thread.withName ? "false" : "true"}>
            {thread.note}
          </div>
        ) : null}
        {messages.length === 0 && !thread.note ? (
          <p className="text-sm text-muted">No messages yet. Say hello below.</p>
        ) : null}
        {messages.map((message, index) => {
          const day = dayLabel(message.createdAt);
          const previous = index > 0 ? dayLabel(messages[index - 1]!.createdAt) : null;
          const showDay = day !== previous;
          return (
            <div key={message.id} className="flex flex-col gap-1">
              {showDay ? (
                <p className="my-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  {day}
                </p>
              ) : null}
              <div
                className={`chat-bubble ${message.pending ? "opacity-60" : ""}`}
                data-mine={message.mine}
                data-new={message.isNew}
              >
                {message.body}
              </div>
              <p className={`text-[11px] text-muted ${message.mine ? "text-right" : ""}`}>
                {message.mine ? "You" : message.authorName} · {message.pending ? "Sending…" : timeLabel(message.createdAt)}
                {message.isNew ? <span className="ml-1 font-semibold text-[var(--accent)]">New</span> : null}
              </p>
            </div>
          );
        })}
        {status === "declined" && thread.declineNote ? (
          <p className="mt-2 text-sm text-[var(--danger)]">Declined: {thread.declineNote}</p>
        ) : null}
        <div ref={endRef} />
      </div>

      {thread.canReply ? (
        <form
          className="chat-composer"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          {error ? <p className="mb-2 text-sm text-[var(--danger)]">{error}</p> : null}
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  send();
                }
              }}
              rows={1}
              className="field-input max-h-40 min-h-12 flex-1 resize-none"
              placeholder={`Message ${thread.withName}`}
              aria-label="Message"
              enterKeyHint="send"
            />
            <button
              type="submit"
              className="btn-primary min-h-12 px-5"
              disabled={!draft.trim() || sending}
            >
              {sending ? "…" : "Send"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
