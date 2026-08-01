"use client";

import { useState, useTransition } from "react";
import {
  createTimelineBlock,
  deleteTimelineBlock,
  moveTimelineBlock,
  saveTimelineBlock,
} from "@/app/actions";
import { StarIcon } from "@/components/StarIcon";

export type TimelineBlockView = {
  id: string;
  startAt: string;
  endAt: string | null;
  notes: string;
};

export function DayTimeline({
  blocks,
  canEdit,
}: {
  blocks: TimelineBlockView[];
  canEdit: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, index) => {
        const editing = editingId === block.id;

        if (editing && canEdit) {
          return (
            <article key={block.id} className="card p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
                  Editing moment
                </p>
                <button
                  type="button"
                  aria-label="Close editor"
                  onClick={() => setEditingId(null)}
                  className="star-btn star-btn-active"
                >
                  <StarIcon filled size={18} />
                </button>
              </div>

              <form
                action={async (fd) => {
                  await saveTimelineBlock(fd);
                  setEditingId(null);
                }}
                className="flex flex-col gap-3"
              >
                <input type="hidden" name="id" value={block.id} />
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs text-muted">Starts</span>
                    <input
                      name="startAt"
                      defaultValue={block.startAt}
                      placeholder="10:30 AM"
                      className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                      autoFocus
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs text-muted">Ends (optional)</span>
                    <input
                      name="endAt"
                      defaultValue={block.endAt || ""}
                      placeholder="11:30 AM"
                      className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                    />
                  </label>
                </div>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-muted">What happens</span>
                  <textarea
                    name="notes"
                    defaultValue={block.notes}
                    rows={3}
                    className="w-full resize-y rounded-xl border border-line bg-transparent px-3 py-2.5 text-[15px] leading-snug outline-none focus:border-[var(--accent)]"
                  />
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="submit"
                    className="btn-primary"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </button>
                  <div className="ml-auto flex gap-1">
                    <button
                      type="button"
                      disabled={pending || index === 0}
                      aria-label="Move earlier"
                      className="rounded-full border border-line px-3 py-2 text-sm text-muted disabled:opacity-30"
                      onClick={() =>
                        startTransition(() => moveTimelineBlock(block.id, "up"))
                      }
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={pending || index === blocks.length - 1}
                      aria-label="Move later"
                      className="rounded-full border border-line px-3 py-2 text-sm text-muted disabled:opacity-30"
                      onClick={() =>
                        startTransition(() => moveTimelineBlock(block.id, "down"))
                      }
                    >
                      ↓
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  className="self-start text-sm font-semibold text-[var(--danger)]"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await deleteTimelineBlock(block.id);
                      setEditingId(null);
                    })
                  }
                >
                  Remove this moment
                </button>
              </form>
            </article>
          );
        }

        return (
          <article key={block.id} className="card relative p-4 pr-12">
            {canEdit ? (
              <button
                type="button"
                aria-label={`Edit ${block.notes}`}
                title="Edit"
                className="star-btn absolute right-3 top-3"
                onClick={() => {
                  setAdding(false);
                  setEditingId(block.id);
                }}
              >
                <StarIcon size={17} />
              </button>
            ) : null}
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
              {block.startAt}
              {block.endAt ? ` – ${block.endAt}` : ""}
            </p>
            <p className="mt-1 text-[15px] leading-snug">{block.notes}</p>
          </article>
        );
      })}

      {canEdit ? (
        adding ? (
          <article className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
                New moment
              </p>
              <button
                type="button"
                aria-label="Close"
                className="star-btn star-btn-active"
                onClick={() => setAdding(false)}
              >
                <StarIcon filled size={18} />
              </button>
            </div>
            <form
              action={async (fd) => {
                await createTimelineBlock(fd);
                setAdding(false);
              }}
              className="flex flex-col gap-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-muted">Starts</span>
                  <input
                    name="startAt"
                    placeholder="7:00 PM"
                    className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                    autoFocus
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs text-muted">Ends (optional)</span>
                  <input
                    name="endAt"
                    placeholder="7:15 PM"
                    className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
                  />
                </label>
              </div>
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-muted">What happens</span>
                <textarea
                  name="notes"
                  rows={3}
                  placeholder="Describe this moment…"
                  className="w-full resize-y rounded-xl border border-line bg-transparent px-3 py-2.5 text-[15px] outline-none focus:border-[var(--accent)]"
                />
              </label>
              <button
                type="submit"
                className="btn-primary"
              >
                Add to timeline
              </button>
            </form>
          </article>
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setAdding(true);
            }}
            className="flex items-center justify-center gap-2 rounded-[18px] border border-dashed border-line bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] px-4 py-4 text-sm font-semibold text-[var(--accent)]"
          >
            <StarIcon size={16} />
            Add moment
          </button>
        )
      ) : null}
    </div>
  );
}
