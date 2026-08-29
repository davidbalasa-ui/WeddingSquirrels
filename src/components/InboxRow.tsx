"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  addRequestMessage,
  completeRequest,
  cycleShoppingOwner,
  cycleTaskOwners,
  declineRequest,
  deleteRequest,
  deleteShoppingItem,
  renameRequest,
  renameShoppingItem,
  renameTask,
  reopenRequest,
  toggleShoppingPurchased,
  toggleTaskDone,
} from "@/app/actions";
import { EscalatePriorityButton } from "@/components/EscalatePriorityButton";
import { canManageOwners, nextCoupleOwnerIds, type InboxItem } from "@/lib/inbox";
import {
  canCompleteRequest,
  canDeclineRequest,
  canDeleteRequest,
  canEditRequest,
  canReopenRequest,
  canReplyToRequest,
  isRequestUnread,
} from "@/lib/requests";
import { dueLabel } from "@/lib/tasks";
import type { SessionAccount } from "@/lib/types";
import type { TaskOption } from "@/lib/inbox";

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

function metaParts(item: InboxItem) {
  const parts: string[] = [];
  if (item.dueDate) {
    parts.push(dueLabel(item.dueDate, item.done ? "done" : "todo") ?? "");
  }
  if (item.meta?.childTotal) {
    parts.push(`${item.meta.childDone}/${item.meta.childTotal} steps`);
  }
  if (item.meta?.quantity) {
    parts.push(item.meta.quantity);
  }
  if (item.escalated) {
    parts.push("Priority");
  }
  return parts.filter(Boolean);
}

export function InboxRow({
  item,
  session,
  tasks,
  expanded,
  onToggleExpand,
  onAskSomeone,
  dragHandle,
}: {
  item: InboxItem;
  session: SessionAccount;
  tasks: TaskOption[];
  expanded: boolean;
  onToggleExpand: () => void;
  onAskSomeone?: () => void;
  dragHandle?: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(item.title);
  const [reply, setReply] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [undoId, setUndoId] = useState<string | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTitleDraft(item.title);
  }, [item.title]);

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  const canCycleOwners =
    (item.kind === "task" || item.kind === "org_step") &&
    canManageOwners(session) &&
    nextCoupleOwnerIds(item.ownerPersonIds) !== null;

  function scheduleUndo(requestId: string) {
    setUndoId(requestId);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoId(null), 5000);
  }

  function handleCheckbox() {
    startTransition(async () => {
      if (item.kind === "ask") {
        if (item.done || item.declined) {
          await reopenRequest(item.sourceId);
          return;
        }
        await completeRequest(item.sourceId);
        scheduleUndo(item.sourceId);
        return;
      }
      if (item.kind === "buy") {
        await toggleShoppingPurchased(item.sourceId);
        return;
      }
      await toggleTaskDone(item.sourceId);
    });
  }

  function saveTitle() {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === item.title) {
      setEditingTitle(false);
      return;
    }
    startTransition(async () => {
      if (item.kind === "task" || item.kind === "org_step") await renameTask(item.sourceId, trimmed);
      else if (item.kind === "buy") await renameShoppingItem(item.sourceId, trimmed);
      else if (item.kind === "ask") await renameRequest(item.sourceId, trimmed);
      setEditingTitle(false);
    });
  }

  function cycleOwner() {
    if (item.kind === "buy") {
      startTransition(() => cycleShoppingOwner(item.sourceId));
      return;
    }
    if (!canCycleOwners) {
      if (item.href) window.location.href = item.href;
      return;
    }
    startTransition(() => cycleTaskOwners(item.sourceId));
  }

  const askPerm = item.askData
    ? {
        id: item.sourceId,
        status: item.meta?.status ?? "open",
        senderAccountId: item.askData.senderAccountId,
        recipientAccountId: item.askData.recipientAccountId,
        readAt: item.askData.readAt ? new Date(item.askData.readAt) : null,
        senderReadAt: item.askData.senderReadAt ? new Date(item.askData.senderReadAt) : null,
      }
    : null;

  const askPerms = askPerm
    ? {
        complete: canCompleteRequest(session, askPerm),
        decline: canDeclineRequest(session, askPerm),
        reopen: canReopenRequest(session, askPerm),
        edit: canEditRequest(session, askPerm),
        delete: canDeleteRequest(session, askPerm),
        reply: canReplyToRequest(session, askPerm),
      }
    : null;

  const unread = askPerm ? isRequestUnread(session, askPerm) : false;
  const meta = metaParts(item);
  const kindLabel =
    item.kind === "ask"
      ? "Ask"
      : item.kind === "task"
        ? "Decision"
        : item.kind === "org_step"
          ? "Step"
          : "Buy";

  return (
    <article
      className={`relative flex items-start gap-1.5 px-2 py-1.5 ${
        item.done ? "opacity-60" : ""
      } ${item.escalated ? "border-l-2 border-l-[var(--warn)] pl-1.5" : ""}`}
    >
      {dragHandle}

      <button
        type="button"
        aria-label={item.done ? "Mark not done" : item.kind === "buy" ? "Mark purchased" : "Mark done"}
        disabled={pending}
        className="step-check mt-0.5 shrink-0"
        style={{
          background: item.done || item.declined ? "var(--accent)" : "transparent",
          color: item.done || item.declined ? "white" : "var(--muted)",
        }}
        onClick={handleCheckbox}
      >
        {item.done || item.declined ? "✓" : ""}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] leading-tight text-muted">
              {unread ? <span className="font-semibold text-[var(--accent)]">New · </span> : null}
              {item.declined ? <span className="font-semibold text-[var(--danger)]">Declined · </span> : null}
              <span className="font-semibold uppercase tracking-wide">{kindLabel}</span>
              {(item.kind === "task" || item.kind === "org_step" || item.kind === "buy") && (
                <>
                  {" · "}
                  <button
                    type="button"
                    className="font-semibold text-muted underline decoration-dotted underline-offset-2 disabled:no-underline"
                    disabled={pending || (item.kind !== "buy" && !canCycleOwners && !item.href)}
                    onClick={cycleOwner}
                  >
                    {item.ownerLabel}
                  </button>
                </>
              )}
              {item.kind === "ask" ? (
                <span className="font-semibold"> · {item.ownerLabel}</span>
              ) : null}
              {meta.length > 0 ? <span> · {meta.join(" · ")}</span> : null}
            </p>

            {item.kind === "ask" ? (
              <button type="button" className="w-full text-left" onClick={onToggleExpand}>
                <p className={`text-[15px] font-semibold leading-snug ${item.done ? "line-through" : ""}`}>
                  {item.title}
                </p>
              </button>
            ) : editingTitle ? (
              <input
                className="field-input mt-0.5 text-[15px] font-semibold"
                value={titleDraft}
                autoFocus
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle();
                  if (e.key === "Escape") {
                    setTitleDraft(item.title);
                    setEditingTitle(false);
                  }
                }}
              />
            ) : (
              <button
                type="button"
                className="mt-0.5 w-full text-left"
                onClick={() => {
                  if (item.kind === "ask") onToggleExpand();
                  else setEditingTitle(true);
                }}
              >
                <p className={`text-[15px] font-semibold leading-snug ${item.done ? "line-through" : ""}`}>
                  {item.title}
                </p>
              </button>
            )}
          </div>

          {item.kind === "task" && item.href ? (
            <Link
              href={item.href}
              className="shrink-0 px-1 py-0.5 text-lg text-muted hover:text-[var(--accent)]"
              aria-label="Open workspace"
            >
              ›
            </Link>
          ) : null}

          <div className="relative shrink-0">
            <button
              type="button"
              className="px-1 py-0.5 text-sm text-muted"
              aria-label="Row menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              ⋯
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-full z-20 mt-0.5 min-w-[10rem] rounded-lg border border-line bg-[var(--bg-elevated)] py-1 shadow-lg">
                {item.kind === "task" && item.href ? (
                  <Link
                    href={item.href}
                    className="block px-3 py-2 text-sm font-semibold hover:bg-[var(--surface)]"
                    onClick={() => setMenuOpen(false)}
                  >
                    Open workspace
                  </Link>
                ) : null}
                {onAskSomeone ? (
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--surface)]"
                    onClick={() => {
                      setMenuOpen(false);
                      onAskSomeone();
                    }}
                  >
                    Ask someone
                  </button>
                ) : null}
                {item.kind === "task" && session.canSeeTasks ? (
                  <div className="px-2 py-1">
                    <EscalatePriorityButton
                      taskId={item.sourceId}
                      escalated={Boolean(item.escalated)}
                      compact
                    />
                  </div>
                ) : null}
                {item.kind === "buy" ? (
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm font-semibold text-[var(--danger)] hover:bg-[var(--surface)]"
                    onClick={() =>
                      startTransition(async () => {
                        await deleteShoppingItem(item.sourceId);
                        setMenuOpen(false);
                      })
                    }
                  >
                    Delete
                  </button>
                ) : null}
                {item.kind === "ask" && askPerms?.delete ? (
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm font-semibold text-[var(--danger)] hover:bg-[var(--surface)]"
                    onClick={() =>
                      startTransition(async () => {
                        await deleteRequest(item.sourceId);
                        setMenuOpen(false);
                      })
                    }
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {item.kind === "ask" && expanded && item.askData ? (
          <div className="mt-2 border-t border-line pt-2">
            <AskThread messages={item.askData.messages} sessionId={session.id} />

            {item.linkedTaskId && item.linkedTaskTitle && session.canSeeTasks ? (
              <Link
                href={`/work/${item.linkedTaskId}`}
                className="mt-2 block text-sm font-semibold text-[var(--accent)]"
              >
                Related: {item.linkedTaskTitle}
              </Link>
            ) : null}

            {item.declined && item.askData.declineNote ? (
              <p className="mt-2 text-sm text-[var(--danger)]">Declined: {item.askData.declineNote}</p>
            ) : null}

            {askPerms?.reply ? (
              <form
                className="mt-2 flex flex-col gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const body = reply.trim();
                  if (!body) return;
                  startTransition(async () => {
                    await addRequestMessage(item.sourceId, body);
                    setReply("");
                  });
                }}
              >
                <textarea
                  value={reply}
                  rows={2}
                  placeholder="Write a reply…"
                  className="field-input resize-y text-sm"
                  onChange={(e) => setReply(e.target.value)}
                />
                <button type="submit" className="btn-primary self-start min-h-[44px]" disabled={pending || !reply.trim()}>
                  {pending ? "Sending…" : "Send reply"}
                </button>
              </form>
            ) : null}

            {askPerms?.decline ? (
              <form action={declineRequest} className="mt-2 flex flex-col gap-2">
                <input type="hidden" name="id" value={item.sourceId} />
                <input name="declineNote" placeholder="Decline note (optional)" className="field-input text-sm" />
                <button type="submit" className="btn-secondary self-start min-h-[44px]">
                  Decline
                </button>
              </form>
            ) : null}

            {askPerms?.reopen ? (
              <button
                type="button"
                className="btn-secondary mt-2 min-h-[44px]"
                disabled={pending}
                onClick={() => startTransition(() => reopenRequest(item.sourceId))}
              >
                Reopen
              </button>
            ) : null}
          </div>
        ) : null}

        {undoId === item.sourceId ? (
          <div className="mt-1.5 flex items-center gap-2 text-sm text-muted">
            <span>Marked done.</span>
            <button
              type="button"
              className="font-semibold text-[var(--accent)]"
              onClick={() =>
                startTransition(async () => {
                  await reopenRequest(item.sourceId);
                  setUndoId(null);
                })
              }
            >
              Undo
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function AskThread({
  messages,
  sessionId,
}: {
  messages: { id: string; body: string; authorAccountId: string; authorName: string; createdAt: string }[];
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
          <div key={message.id} className="text-sm leading-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              {mine ? "You" : message.authorName} · {formatTime(message.createdAt)}
            </p>
            <p className="whitespace-pre-wrap">{message.body}</p>
          </div>
        );
      })}
    </div>
  );
}
