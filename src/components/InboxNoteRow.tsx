"use client";

import { useState, useTransition } from "react";
import {
  createInboxChild,
  deleteShoppingItem,
  renameShoppingItem,
  setShoppingOwner,
  toggleShoppingPurchased,
  toggleTaskDone,
  updateInboxTask,
} from "@/app/actions";
import {
  canManageOwners,
  inboxDateLine,
  ownerIdsForPreset,
  ownerWhoPreset,
  type InboxItem,
  type PersonOption,
} from "@/lib/inbox";
import { dueDateInputValue } from "@/lib/tasks";
import type { SessionAccount } from "@/lib/types";

export function InboxNoteRow({
  item,
  session,
  people,
  dragHandle,
}: {
  item: InboxItem;
  session: SessionAccount;
  people: PersonOption[];
  dragHandle?: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  const dateLine = inboxDateLine(item.dueDate, item.done);
  const canEditWho = canManageOwners(session) && item.kind !== "buy" ? session.canSeeTasks : session.canSeeShop;

  function handleCheckbox() {
    startTransition(async () => {
      if (item.kind === "buy") await toggleShoppingPurchased(item.sourceId);
      else await toggleTaskDone(item.sourceId);
    });
  }

  return (
    <article className={`py-1.5 ${item.done ? "opacity-55" : ""}`}>
      <div className="flex items-start gap-1.5">
        {dragHandle}
        <button
          type="button"
          aria-label={item.done ? "Mark not done" : "Mark done"}
          disabled={pending}
          className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-line text-[10px] leading-none"
          style={{
            background: item.done ? "var(--accent)" : "transparent",
            color: item.done ? "white" : "transparent",
            borderColor: item.done ? "var(--accent)" : undefined,
          }}
          onClick={handleCheckbox}
        >
          {item.done ? "✓" : ""}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className={`min-w-0 flex-1 text-[15px] font-semibold leading-snug ${item.done ? "line-through" : ""}`}>
              {item.title}
            </p>
            <span className="shrink-0 text-[12px] text-muted">{item.ownerLabel}</span>
            <button
              type="button"
              aria-label="Edit"
              className="shrink-0 px-0.5 text-muted"
              onClick={() => setEditing((v) => !v)}
            >
              <FeatherIcon />
            </button>
          </div>
          {item.detail && !editing ? (
            <p className="text-[13px] leading-snug text-muted">{item.detail}</p>
          ) : null}
          {dateLine && !editing ? (
            <p className={`text-xs ${dateLine.includes("overdue") ? "font-semibold text-[var(--danger)]" : "text-muted"}`}>
              {dateLine}
            </p>
          ) : null}
        </div>
      </div>

      {editing ? (
        <NoteEditor
          item={item}
          people={people}
          canEditWho={Boolean(canEditWho && (item.kind === "buy" || canManageOwners(session)))}
          pending={pending}
          onCancel={() => setEditing(false)}
          onSave={(next) => {
            startTransition(async () => {
              if (item.kind === "buy") {
                await renameShoppingItem(item.sourceId, next.title);
                if (canEditWho) {
                  const ownerId =
                    next.preset === "david" ? "david" : next.preset === "haley" ? "haley" : null;
                  await setShoppingOwner(item.sourceId, ownerId);
                }
              } else {
                await updateInboxTask(item.sourceId, {
                  title: next.title,
                  dueDate: next.dueDate,
                  ownerIds: next.ownerIds,
                });
              }
              setEditing(false);
            });
          }}
          onDelete={
            item.kind === "buy"
              ? () =>
                  startTransition(async () => {
                    await deleteShoppingItem(item.sourceId);
                    setEditing(false);
                  })
              : undefined
          }
        />
      ) : null}
    </article>
  );
}

function FeatherIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20l4.5-1L20 7.5a2.1 2.1 0 0 0-3-3L5.5 16 4 20z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NoteEditor({
  item,
  people,
  canEditWho,
  pending,
  onCancel,
  onSave,
  onDelete,
}: {
  item: InboxItem;
  people: PersonOption[];
  canEditWho: boolean;
  pending: boolean;
  onCancel: () => void;
  onSave: (next: {
    title: string;
    dueDate: string | null;
    ownerIds: string[];
    preset: "david" | "haley" | "both" | "other";
  }) => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [dueDate, setDueDate] = useState(dueDateInputValue(item.dueDate));
  const [preset, setPreset] = useState(ownerWhoPreset(item.ownerPersonIds));
  const [otherIds, setOtherIds] = useState(item.ownerPersonIds);

  const isBuy = item.kind === "buy";
  const showDate = !isBuy;
  const showOther = !isBuy && preset === "other";

  function applyPreset(next: "david" | "haley" | "both" | "other") {
    setPreset(next);
    if (next !== "other") setOtherIds(ownerIdsForPreset(next, []));
  }

  return (
    <form
      className="mt-1.5 ml-5 flex flex-col gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          title,
          dueDate: dueDate || null,
          ownerIds: ownerIdsForPreset(preset, otherIds),
          preset,
        });
      }}
    >
      <input
        className="field-input py-1.5 text-[15px] font-semibold"
        value={title}
        autoFocus
        onChange={(e) => setTitle(e.target.value)}
      />
      {showDate ? (
        <label className="flex items-center gap-2 text-xs text-muted">
          <span className="shrink-0">Due</span>
          <input
            type="date"
            className="field-input py-1 text-sm"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </label>
      ) : null}
      {canEditWho ? (
        <div>
          <div className="flex flex-wrap gap-1">
            {(["david", "haley", "both"] as const).map((key) => (
              <button
                key={key}
                type="button"
                className={`px-2 py-1 text-xs font-semibold ${
                  preset === key ? "text-[var(--accent)] underline" : "text-muted"
                }`}
                onClick={() => applyPreset(key)}
              >
                {key === "david" ? "David" : key === "haley" ? "Haley" : "Both"}
              </button>
            ))}
            {!isBuy ? (
              <button
                type="button"
                className={`px-2 py-1 text-xs font-semibold ${
                  preset === "other" ? "text-[var(--accent)] underline" : "text-muted"
                }`}
                onClick={() => applyPreset("other")}
              >
                Other
              </button>
            ) : null}
          </div>
          {showOther ? (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              {people.map((person) => {
                const checked = otherIds.includes(person.id);
                return (
                  <label key={person.id} className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setOtherIds((prev) =>
                          checked ? prev.filter((id) => id !== person.id) : [...prev, person.id],
                        )
                      }
                    />
                    {person.name}
                  </label>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="text-sm font-semibold text-[var(--accent)]" disabled={pending || !title.trim()}>
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" className="text-sm text-muted" onClick={onCancel}>
          Cancel
        </button>
        {onDelete ? (
          <button type="button" className="text-sm text-[var(--danger)]" onClick={onDelete}>
            Delete
          </button>
        ) : null}
      </div>
    </form>
  );
}

export function InboxPackageHeader({
  item,
  session,
}: {
  item: InboxItem;
  session: SessionAccount;
  people?: PersonOption[];
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const dateLine = inboxDateLine(item.dueDate, item.done);

  return (
    <div className="flex items-baseline gap-2 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold leading-snug">{item.title}</p>
        {dateLine ? (
          <p className={`text-xs ${dateLine.includes("overdue") ? "font-semibold text-[var(--danger)]" : "text-muted"}`}>
            {dateLine}
          </p>
        ) : null}
        {adding ? (
          <form
            className="mt-1 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                await createInboxChild(item.sourceId, title);
                setTitle("");
                setAdding(false);
              });
            }}
          >
            <input
              className="field-input py-1 text-sm"
              placeholder="New item"
              value={title}
              autoFocus
              onChange={(e) => setTitle(e.target.value)}
            />
            <button type="submit" className="text-sm font-semibold text-[var(--accent)]" disabled={pending || !title.trim()}>
              Add
            </button>
            <button type="button" className="text-sm text-muted" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </form>
        ) : session.canSeeTasks ? (
          <button type="button" className="text-xs font-semibold text-muted" onClick={() => setAdding(true)}>
            + Item
          </button>
        ) : null}
      </div>
      <span className="shrink-0 text-[12px] text-muted">{item.ownerLabel}</span>
    </div>
  );
}
