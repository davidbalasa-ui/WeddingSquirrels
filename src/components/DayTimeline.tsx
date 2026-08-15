"use client";

import { useEffect, useRef, useState } from "react";
import {
  createTimelineBlock,
  deleteTimelineBlock,
  saveTimelineBlock,
} from "@/app/actions";
import {
  endsBeforeStart,
  prepareTimelineCreate,
  prepareTimelineSave,
} from "@/lib/day-of-time";

export type TimelineBlockView = {
  id: string;
  startAt: string;
  endAt: string | null;
  notes: string;
};

type Mode = "review" | "edit";
type RowStatus = "saved" | "saving" | "dirty" | "error";

type Row = {
  id: string;
  startAt: string;
  endAt: string;
  notes: string;
  lastSaved: { startAt: string; endAt: string; notes: string };
  status: RowStatus;
  error: string | null;
  localRev: number;
};

type Draft = {
  startAt: string;
  endAt: string;
  notes: string;
};

function toRow(block: TimelineBlockView): Row {
  const lastSaved = {
    startAt: block.startAt,
    endAt: block.endAt ?? "",
    notes: block.notes,
  };
  return {
    id: block.id,
    ...lastSaved,
    lastSaved,
    status: "saved",
    error: null,
    localRev: 0,
  };
}

function statusLabel(status: RowStatus, error: string | null) {
  if (status === "saving") return "Saving…";
  if (status === "saved") return "Saved";
  if (status === "error") return error || "Couldn’t save — tap to retry";
  return "";
}

export function DayTimeline({
  blocks,
  canEdit,
  startInEdit = false,
}: {
  blocks: TimelineBlockView[];
  canEdit: boolean;
  startInEdit?: boolean;
}) {
  const [mode, setMode] = useState<Mode>(canEdit && startInEdit ? "edit" : "review");
  const [rows, setRows] = useState<Row[]>(() => blocks.map(toRow));
  const [blockSource, setBlockSource] = useState(blocks);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const rowsRef = useRef(rows);
  const draftRef = useRef(draft);
  const timersRef = useRef<Map<string, number>>(new Map());
  const inflightRef = useRef<Map<string, number>>(new Map());
  const draftSavingRef = useRef(false);

  rowsRef.current = rows;
  draftRef.current = draft;

  if (blocks !== blockSource) {
    setBlockSource(blocks);
    setRows((prev) => {
      const prevById = new Map(prev.map((row) => [row.id, row]));
      return blocks.map((block) => {
        const existing = prevById.get(block.id);
        if (existing && (existing.status === "dirty" || existing.status === "saving")) {
          return existing;
        }
        return toRow(block);
      });
    });
  }

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) window.clearTimeout(timer);
      timers.clear();
      for (const row of rowsRef.current) {
        if (row.status === "dirty" || row.status === "saving") {
          void persistRow(row);
        }
      }
      const openDraft = draftRef.current;
      if (openDraft) void persistDraft(openDraft, { abandon: true });
    };
  }, []);

  function clearTimer(id: string) {
    const timer = timersRef.current.get(id);
    if (timer) window.clearTimeout(timer);
    timersRef.current.delete(id);
  }

  function scheduleRowSave(id: string) {
    clearTimer(id);
    timersRef.current.set(
      id,
      window.setTimeout(() => {
        timersRef.current.delete(id);
        const row = rowsRef.current.find((item) => item.id === id);
        if (row) void persistRow(row);
      }, 400),
    );
  }

  async function persistRow(row: Row) {
    const prepared = prepareTimelineSave(
      { startAt: row.startAt, endAt: row.endAt, notes: row.notes },
      row.lastSaved,
    );

    if (!prepared.ok) {
      setRows((prev) =>
        prev.map((item) => {
          if (item.id !== row.id || item.localRev !== row.localRev) return item;
          if (prepared.reason === "empty_notes" || prepared.revertNotes) {
            return {
              ...item,
              notes: item.lastSaved.notes,
              status: "saved",
              error: null,
            };
          }
          return { ...item, status: "saved", error: null };
        }),
      );
      return;
    }

    inflightRef.current.set(row.id, row.localRev);
    setRows((prev) =>
      prev.map((item) =>
        item.id === row.id && item.localRev === row.localRev
          ? { ...item, status: "saving", error: null }
          : item,
      ),
    );

    const result = await saveTimelineBlock({
      id: row.id,
      startAt: prepared.startAt,
      endAt: prepared.endAt ?? "",
      notes: prepared.notes,
    });

    if (inflightRef.current.get(row.id) !== row.localRev) return;

    if (!result.ok) {
      if (result.reason === "forbidden") {
        setBanner("You were logged out or lost edit access. Copy your text, then log in again.");
        setMode("review");
      }
      setRows((prev) =>
        prev.map((item) =>
          item.id === row.id && item.localRev === row.localRev
            ? {
                ...item,
                notes: prepared.revertedNotes ? prepared.notes : item.notes,
                status: result.reason === "noop" ? "saved" : "error",
                error:
                  result.reason === "forbidden"
                    ? "Logged out"
                    : "Couldn’t save — tap to retry",
              }
            : item,
        ),
      );
      return;
    }

    setRows((prev) =>
      prev.map((item) =>
        item.id === row.id && item.localRev === row.localRev
          ? {
              ...item,
              startAt: prepared.startAt,
              endAt: prepared.endAt ?? "",
              notes: prepared.notes,
              lastSaved: {
                startAt: prepared.startAt,
                endAt: prepared.endAt ?? "",
                notes: prepared.notes,
              },
              status: "saved",
              error: null,
            }
          : item,
      ),
    );
  }

  async function persistDraft(openDraft: Draft, opts: { abandon?: boolean } = {}) {
    const prepared = prepareTimelineCreate(openDraft);
    if (!prepared.ok) {
      if (opts.abandon) setDraft(null);
      return { ok: false as const };
    }
    if (draftSavingRef.current) return { ok: false as const };
    draftSavingRef.current = true;

    const result = await createTimelineBlock({
      startAt: prepared.startAt,
      endAt: prepared.endAt ?? "",
      notes: prepared.notes,
    });
    draftSavingRef.current = false;

    if (!result.ok) {
      if (result.reason === "forbidden") {
        setBanner("You were logged out or lost edit access. Copy your text, then log in again.");
        setMode("review");
        return result;
      }
      setBanner("Couldn’t add that moment — try again.");
      return result;
    }

    const created: TimelineBlockView = {
      id: result.id,
      startAt: prepared.startAt,
      endAt: prepared.endAt,
      notes: prepared.notes,
    };
    setRows((prev) => (prev.some((row) => row.id === created.id) ? prev : [...prev, toRow(created)]));
    setDraft(null);
    return result;
  }

  function patchRow(id: string, patch: Partial<Pick<Row, "startAt" | "endAt" | "notes">>) {
    setRows((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, ...patch, status: "dirty", error: null, localRev: item.localRev + 1 }
          : item,
      ),
    );
    scheduleRowSave(id);
  }

  async function flushRow(id: string) {
    clearTimer(id);
    const row = rowsRef.current.find((item) => item.id === id);
    if (row) await persistRow(row);
  }

  async function switchMode(next: Mode) {
    if (next === mode) return;
    if (next === "review") {
      for (const row of rowsRef.current) {
        if (row.status === "dirty" || row.status === "saving") await persistRow(row);
      }
      if (draftRef.current) await persistDraft(draftRef.current, { abandon: true });
      setConfirmDeleteId(null);
    }
    setMode(next);
  }

  function startDraft() {
    if (draft) return;
    setDraft({ startAt: "", endAt: "", notes: "" });
    setConfirmDeleteId(null);
  }

  async function removeRow(id: string) {
    clearTimer(id);
    const result = await deleteTimelineBlock(id);
    if (!result.ok) {
      if (result.reason === "forbidden") {
        setBanner("You were logged out or lost edit access.");
        setMode("review");
      }
      setBanner("Couldn’t remove that moment — try again.");
      return;
    }
    setRows((prev) => prev.filter((row) => row.id !== id));
    setConfirmDeleteId(null);
  }

  const editing = canEdit && mode === "edit";

  return (
    <div className={editing ? "pb-24" : ""}>
      {canEdit ? (
        <div className="mb-3 grid grid-cols-2 rounded-full border border-line bg-[var(--bg-elevated)] p-1 print-hide">
          <button
            type="button"
            className={`rounded-full px-3 py-2.5 text-sm font-semibold ${
              mode === "review" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-muted"
            }`}
            onClick={() => void switchMode("review")}
          >
            Review
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-2.5 text-sm font-semibold ${
              mode === "edit" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-muted"
            }`}
            onClick={() => void switchMode("edit")}
          >
            Edit
          </button>
        </div>
      ) : null}

      <p className="mb-3 text-sm text-muted">
        {!canEdit
          ? "Day-of schedule"
          : editing
            ? "Tap a time or note. Changes save when you leave the field."
            : "Read-only schedule. Switch to Edit to change a moment."}
      </p>

      {banner ? (
        <p className="mb-3 rounded-xl border border-[var(--danger)]/30 bg-[color-mix(in_srgb,var(--danger)_8%,white)] px-3 py-2 text-sm text-[var(--danger)]">
          {banner}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        {rows.length === 0 && !draft ? (
          <div className="card p-6 text-center text-sm text-muted">
            {editing ? "No moments yet — tap + to add one." : "No moments yet."}
            {canEdit && !editing ? " Switch to Edit to add one." : null}
          </div>
        ) : null}

        {rows.map((row) =>
          editing ? (
            <EditCard
              key={row.id}
              row={row}
              confirmDelete={confirmDeleteId === row.id}
              onPatch={patchRow}
              onFlush={() => void flushRow(row.id)}
              onRetry={() => void persistRow(row)}
              onAskDelete={() => setConfirmDeleteId(row.id)}
              onCancelDelete={() => setConfirmDeleteId(null)}
              onConfirmDelete={() => void removeRow(row.id)}
            />
          ) : (
            <article key={row.id} className="card p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
                {row.startAt}
                {row.endAt ? ` – ${row.endAt}` : ""}
              </p>
              <p className="mt-1 text-[15px] leading-snug">{row.notes}</p>
            </article>
          ),
        )}

        {editing && draft ? (
          <article className="card p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
              New moment
            </p>
            <div className="grid grid-cols-2 gap-3">
              <TimeField
                label="Starts"
                value={draft.startAt}
                placeholder="3:37 PM"
                onChange={(value) => setDraft({ ...draft, startAt: value })}
              />
              <TimeField
                label="Ends (optional)"
                value={draft.endAt}
                placeholder="4:00 PM"
                onChange={(value) => setDraft({ ...draft, endAt: value })}
              />
            </div>
            <label className="mt-3 block text-sm">
              <span className="mb-1 block text-xs text-muted">What happens</span>
              <textarea
                value={draft.notes}
                rows={3}
                placeholder="Describe this moment…"
                autoFocus
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                className="w-full resize-y rounded-xl border border-line bg-transparent px-3 py-2.5 text-[15px] leading-snug outline-none focus:border-[var(--accent)]"
              />
            </label>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="btn-primary"
                onClick={() => void persistDraft(draft)}
              >
                Add moment
              </button>
              <button type="button" className="btn-secondary" onClick={() => setDraft(null)}>
                Discard
              </button>
            </div>
          </article>
        ) : null}
      </div>

      {editing ? (
        <button
          type="button"
          onClick={startDraft}
          className="print-hide fixed left-1/2 z-[35] w-[min(560px,calc(100%-16px))] -translate-x-1/2 rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-[var(--shadow)]"
          style={{ bottom: "calc(12px + 76px)" }}
        >
          + Add moment
        </button>
      ) : null}
    </div>
  );
}

function TimeField({
  label,
  value,
  placeholder,
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        inputMode="text"
        enterKeyHint="done"
        onChange={(event) => onChange(event.target.value)}
        onFocus={(event) => event.currentTarget.scrollIntoView({ block: "center", behavior: "smooth" })}
        onBlur={onBlur}
        className="w-full rounded-xl border border-line bg-transparent px-3 py-2.5 outline-none focus:border-[var(--accent)]"
      />
    </label>
  );
}

function EditCard({
  row,
  confirmDelete,
  onPatch,
  onFlush,
  onRetry,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  row: Row;
  confirmDelete: boolean;
  onPatch: (id: string, patch: Partial<Pick<Row, "startAt" | "endAt" | "notes">>) => void;
  onFlush: () => void;
  onRetry: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const endWarn = row.endAt.trim() ? endsBeforeStart(row.startAt, row.endAt) : false;
  const label = statusLabel(row.status, row.error);

  return (
    <article className="card p-4">
      <div className="grid grid-cols-2 gap-3">
        <TimeField
          label="Starts"
          value={row.startAt}
          placeholder="3:37 PM"
          onChange={(value) => onPatch(row.id, { startAt: value })}
          onBlur={onFlush}
        />
        <TimeField
          label="Ends (optional)"
          value={row.endAt}
          placeholder="4:00 PM"
          onChange={(value) => onPatch(row.id, { endAt: value })}
          onBlur={onFlush}
        />
      </div>
      {endWarn ? (
        <p className="mt-2 text-xs font-semibold text-[var(--warn)]">Ends before it starts</p>
      ) : null}
      <label className="mt-3 block text-sm">
        <span className="mb-1 block text-xs text-muted">What happens</span>
        <textarea
          value={row.notes}
          rows={3}
          onChange={(event) => onPatch(row.id, { notes: event.target.value })}
          onFocus={(event) => event.currentTarget.scrollIntoView({ block: "center", behavior: "smooth" })}
          onBlur={onFlush}
          className="w-full resize-y rounded-xl border border-line bg-transparent px-3 py-2.5 text-[15px] leading-snug outline-none focus:border-[var(--accent)]"
        />
      </label>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          className="text-xs font-semibold text-muted"
          onClick={row.status === "error" ? onRetry : undefined}
        >
          {label}
        </button>
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-sm font-semibold text-[var(--danger)]"
              onClick={onConfirmDelete}
            >
              Remove?
            </button>
            <button type="button" className="text-sm font-semibold text-muted" onClick={onCancelDelete}>
              Keep
            </button>
          </div>
        ) : (
          <button type="button" className="text-sm font-semibold text-[var(--danger)]" onClick={onAskDelete}>
            Remove
          </button>
        )}
      </div>
    </article>
  );
}
