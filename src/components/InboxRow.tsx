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
  saveRequest,
  renameShoppingItem,
  renameTask,
  reopenRequest,
  toggleShoppingPurchased,
  toggleTaskDone,
} from "@/app/actions";
import { EscalatePriorityButton } from "@/components/EscalatePriorityButton";
import { canManageOwners, inboxDateLine, nextCoupleOwnerIds, type InboxItem } from "@/lib/inbox";
import {
  canCompleteRequest,
  canDeclineRequest,
  canDeleteRequest,
  canEditRequest,
  canReopenRequest,
  canReplyToRequest,
  isRequestUnread,
} from "@/lib/requests";
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
  const [prevItemTitle, setPrevItemTitle] = useState(item.title);
  if (item.title !== prevItemTitle) {
    setPrevItemTitle(item.title);
    setTitleDraft(item.title);
  }
  const [reply, setReply] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [undoId, setUndoId] = useState<string | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const dateLine = inboxDateLine(item.dueDate, item.done);
  const ownerTappable = item.kind === "buy" || canCycleOwners || Boolean(item.href);

  return (
    <article className={`flex items-start gap-1.5 py-2 ${item.done ? "opacity-60" : ""}`}>
      {dragHandle}

      <button
        type="button"
        aria-label={item.done ? "Mark not done" : item.kind === "buy" ? "Mark purchased" : "Mark done"}
        disabled={pending}
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-line text-[11px] leading-none"
        style={{
          background: item.done || item.declined ? "var(--accent)" : "transparent",
          color: item.done || item.declined ? "white" : "transparent",
          borderColor: item.done || item.declined ? "var(--accent)" : undefined,
        }}
        onClick={handleCheckbox}
      >
        {item.done || item.declined ? "✓" : ""}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <div className="min-w-0 flex-1">
            {editingTitle ? (
              <input
                className="field-input text-[15px] font-semibold"
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
            ) : item.kind === "ask" ? (
              <button type="button" className="w-full text-left" onClick={onToggleExpand}>
                <p className={`text-[15px] font-semibold leading-snug ${item.done ? "line-through" : ""}`}>
                  {item.title}
                </p>
              </button>
            ) : item.kind === "task" && item.href ? (
              <Link href={item.href} className="block">
                <p className={`text-[15px] font-semibold leading-snug ${item.done ? "line-through" : ""}`}>
                  {item.title}
                </p>
              </Link>
            ) : (
              <button type="button" className="w-full text-left" onClick={() => setEditingTitle(true)}>
                <p className={`text-[15px] font-semibold leading-snug ${item.done ? "line-through" : ""}`}>
                  {item.title}
                </p>
              </button>
            )}
          </div>

          <div className="flex shrink-0 items-baseline gap-1">
            {unread ? <span className="text-[11px] font-semibold text-[var(--accent)]">New</span> : null}
            {item.declined ? (
              <span className="text-[11px] font-semibold text-[var(--danger)]">Declined</span>
            ) : null}
            {ownerTappable ? (
              <button
                type="button"
                className="text-[13px] text-muted"
                disabled={pending}
                onClick={cycleOwner}
              >
                {item.ownerLabel}
              </button>
            ) : (
              <span className="text-[13px] text-muted">{item.ownerLabel}</span>
            )}
            <div className="relative">
              <button
                type="button"
                className="px-0.5 text-sm text-muted"
                aria-label="Row menu"
                onClick={() => setMenuOpen((v) => !v)}
              >
                ⋯
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-full z-20 mt-0.5 min-w-[10rem] border border-line bg-[var(--bg-elevated)] py-1 shadow-lg">
                  {item.kind !== "ask" || askPerms?.edit ? (
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--surface)]"
                      onClick={() => {
                        setMenuOpen(false);
                        setEditingTitle(true);
                      }}
                    >
                      Rename
                    </button>
                  ) : null}
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
                      onClick={() => {
                        if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
                        startTransition(async () => {
                          await deleteShoppingItem(item.sourceId);
                          setMenuOpen(false);
                        });
                      }}
                    >
                      Delete
                    </button>
                  ) : null}
                  {item.kind === "ask" && askPerms?.delete ? (
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm font-semibold text-[var(--danger)] hover:bg-[var(--surface)]"
                      onClick={() => {
                        if (!window.confirm(`Delete this ask? This cannot be undone.`)) return;
                        startTransition(async () => {
                          await deleteRequest(item.sourceId);
                          setMenuOpen(false);
                        });
                      }}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {item.detail ? <p className="mt-0.5 text-sm leading-snug text-muted">{item.detail}</p> : null}
        {dateLine ? (
          <p
            className={`mt-0.5 text-xs ${
              dateLine.includes("overdue") ? "font-semibold text-[var(--danger)]" : "text-muted"
            }`}
          >
            {dateLine}
          </p>
        ) : null}

        {item.kind === "ask" && expanded && item.askData ? (
          <div className="mt-2 border-t border-line pt-2">
            <AskThread messages={item.askData.messages} sessionId={session.id} />

            {item.linkedTaskId && item.linkedTaskTitle && session.canSeeTasks && !askPerms?.edit ? (
              <Link
                href={`/work/${item.linkedTaskId}`}
                className="mt-2 block text-sm font-semibold text-[var(--accent)]"
              >
                Related: {item.linkedTaskTitle}
              </Link>
            ) : null}

            {askPerms?.edit ? (
              <form action={saveRequest} className="mt-2 flex flex-col gap-2">
                <input type="hidden" name="id" value={item.sourceId} />
                <input
                  name="title"
                  required
                  defaultValue={item.title}
                  className="field-input text-sm"
                  aria-label="Ask title"
                />
                <textarea
                  name="note"
                  rows={2}
                  defaultValue={item.askData.note ?? ""}
                  placeholder="Details…"
                  className="field-input resize-y text-sm"
                />
                {session.canSeeTasks ? (
                  <select name="taskId" defaultValue={item.linkedTaskId ?? ""} className="field-input text-sm">
                    <option value="">No related decision</option>
                    {tasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input type="hidden" name="taskId" value={item.linkedTaskId ?? ""} />
                )}
                <button type="submit" className="btn-secondary self-start min-h-[44px]">
                  Save
                </button>
              </form>
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
          <div className="mt-1 flex items-center gap-2 text-sm text-muted">
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
    <div className="flex flex-col gap-1.5">
      {messages.map((message) => {
        const mine = message.authorAccountId === sessionId;
        return (
          <div key={message.id} className="text-sm leading-5">
            <p className="text-[11px] font-semibold text-muted">
              {mine ? "You" : message.authorName} · {formatTime(message.createdAt)}
            </p>
            <p className="whitespace-pre-wrap">{message.body}</p>
          </div>
        );
      })}
    </div>
  );
}
