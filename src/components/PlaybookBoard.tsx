"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { savePlaybookItem, togglePlaybookCompleted } from "@/app/actions";
import { groupPlaybookSections, type PlaybookItemView } from "@/lib/playbook";
import { AutoGrowTextarea } from "@/components/AutoGrowTextarea";

function PlaybookEditForm({
  item,
  onDone,
  onCancel,
}: {
  item: PlaybookItemView;
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [titleError, setTitleError] = useState<string | null>(null);

  return (
    <form
      className="mt-2 flex flex-col gap-2 rounded-xl border border-line bg-[var(--bg)] p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        // The server ignores a blank title, so say so here instead of closing the form silently
        // (the browser's own required check lets a whitespace-only title through).
        if (!String(formData.get("title") || "").trim()) {
          setTitleError("Add a title before saving.");
          return;
        }
        setTitleError(null);
        if (item.id) formData.set("id", item.id);
        else formData.set("sourceKey", item.sourceKey);
        startTransition(async () => {
          await savePlaybookItem(formData);
          onDone();
          router.refresh();
        });
      }}
    >
      <label className="text-sm">
        <span className="mb-1 block text-xs text-muted">Time</span>
        <input name="startAt" defaultValue={item.startAt ?? ""} className="field-input" placeholder="e.g. 8:00 AM" />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-xs text-muted">Title</span>
        <input
          name="title"
          required
          defaultValue={item.title}
          className="field-input"
          aria-invalid={titleError ? true : undefined}
          onChange={() => setTitleError(null)}
        />
      </label>
      {titleError ? (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {titleError}
        </p>
      ) : null}
      <label className="text-sm">
        <span className="mb-1 block text-xs text-muted">Detail</span>
        <input name="detail" defaultValue={item.detail ?? ""} className="field-input" />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-xs text-muted">Location</span>
        <input name="location" defaultValue={item.location ?? ""} className="field-input" />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-xs text-muted">Notes</span>
        <AutoGrowTextarea name="notes" rows={3} defaultValue={item.notes ?? ""} className="field-input" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function PlaybookBoard({
  items,
  empty,
  canEdit,
  showCompleted = false,
}: {
  items: PlaybookItemView[];
  empty: string;
  canEdit: boolean;
  showCompleted?: boolean;
}) {
  const router = useRouter();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // Two boards on one page (Decor) must not share heading ids.
  const headingId = useId();
  const groups = groupPlaybookSections(items);

  if (groups.length === 0) {
    return <p className="text-base text-muted">{empty}</p>;
  }

  return (
    <div className="space-y-8">
      {groups.map((group, groupIndex) => (
        <section key={group.section} aria-labelledby={`${headingId}-section-${groupIndex}`}>
          <h2
            id={`${headingId}-section-${groupIndex}`}
            className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted"
          >
            {group.section}
          </h2>
          <ol className="mt-2 divide-y divide-[var(--line)]">
            {group.items.map((item) => {
              const editing = editingKey === item.sourceKey;
              return (
                <li key={item.sourceKey} className="py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {item.startAt ? (
                        <p className="text-sm font-semibold text-[var(--accent)]">{item.startAt}</p>
                      ) : null}
                      <p className="font-[family-name:var(--font-display)] text-[1.35rem] leading-[1.15] tracking-tight">
                        {item.title}
                      </p>
                      {item.detail ? <p className="mt-1 text-sm text-muted">{item.detail}</p> : null}
                      {item.location ? (
                        <p className="mt-1 text-sm font-semibold text-[var(--accent)]">{item.location}</p>
                      ) : null}
                      {item.notes ? (
                        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted">{item.notes}</p>
                      ) : null}
                    </div>
                    {showCompleted ? (
                      <span className="shrink-0 pt-1 text-xs font-semibold uppercase tracking-wide text-muted">
                        {item.completed ? "Done" : "Open"}
                      </span>
                    ) : null}
                  </div>
                  {/* Edit and Mark done sit in a row under the item, so the text keeps the full width. */}
                  {canEdit ? (
                    <div className="-ml-2 flex flex-wrap items-center">
                      <button
                        type="button"
                        className="min-h-11 px-2 text-xs font-semibold text-[var(--accent)]"
                        onClick={() => setEditingKey(editing ? null : item.sourceKey)}
                      >
                        {editing ? "Close" : "Edit"}
                      </button>
                      <button
                        type="button"
                        className="min-h-11 px-2 text-xs font-semibold text-muted"
                        onClick={() =>
                          startTransition(async () => {
                            await togglePlaybookCompleted(item.id ?? "", !item.completed, item.sourceKey);
                            router.refresh();
                          })
                        }
                      >
                        {item.completed ? "Mark open" : "Mark done"}
                      </button>
                    </div>
                  ) : null}
                  {editing ? (
                    <PlaybookEditForm
                      item={item}
                      onDone={() => setEditingKey(null)}
                      onCancel={() => setEditingKey(null)}
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
