"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  createTimelineBlock,
  deleteTimelineBlock,
  saveTimelineBlock,
  saveTimelinePeerOrder,
} from "@/app/actions";
import { DayTimeStepper } from "@/components/DayTimeStepper";
import {
  DAY_OF_BUCKETS,
  applyPeerOrder,
  bucketForTime,
  endsBeforeStart,
  peerKey,
  prepareTimelineCreate,
  prepareTimelineSave,
  type DayOfBucket,
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

function applyOrder(prev: Row[], order: string[], updated?: Row): Row[] {
  const byId = new Map(prev.map((row) => [row.id, row]));
  if (updated) byId.set(updated.id, updated);
  const next = order.map((id) => byId.get(id)).filter((row): row is Row => Boolean(row));
  for (const row of byId.values()) {
    if (!order.includes(row.id)) next.push(row);
  }
  return next;
}

function splitRows(rows: Row[]) {
  const untimed: Row[] = [];
  const timed: Row[] = [];
  for (const row of rows) {
    if (bucketForTime(row.startAt) === "untimed") untimed.push(row);
    else timed.push(row);
  }
  return { untimed, timed };
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
  const [stepperOpen, setStepperOpen] = useState(false);
  const [noteFocused, setNoteFocused] = useState(false);

  const rowsRef = useRef(rows);
  const draftRef = useRef(draft);
  const timersRef = useRef<Map<string, number>>(new Map());
  const inflightRef = useRef<Map<string, number>>(new Map());
  const draftSavingRef = useRef(false);
  const persistRowRef = useRef<(row: Row, opts: { reorder: boolean }) => Promise<void>>(async () => {});
  const persistDraftRef = useRef<(draft: Draft, opts?: { abandon?: boolean }) => Promise<unknown>>(
    async () => ({ ok: false as const }),
  );
  const stepperCountRef = useRef(0);

  useEffect(() => {
    rowsRef.current = rows;
    draftRef.current = draft;
  }, [rows, draft]);

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
          void persistRowRef.current(row, { reorder: false });
        }
      }
      const openDraft = draftRef.current;
      if (openDraft) void persistDraftRef.current(openDraft, { abandon: true });
    };
  }, []);

  function clearTimer(id: string) {
    const timer = timersRef.current.get(id);
    if (timer) window.clearTimeout(timer);
    timersRef.current.delete(id);
  }

  function scheduleNotesSave(id: string) {
    clearTimer(id);
    timersRef.current.set(
      id,
      window.setTimeout(() => {
        timersRef.current.delete(id);
        const row = rowsRef.current.find((item) => item.id === id);
        if (row) void persistRow(row, { reorder: false });
      }, 400),
    );
  }

  function scrollIfMoved(id: string, before: Row[], after: Row[]) {
    const from = before.findIndex((row) => row.id === id);
    const to = after.findIndex((row) => row.id === id);
    if (from !== to) {
      requestAnimationFrame(() => {
        document.getElementById(`day-row-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    }
  }

  async function persistRow(row: Row, opts: { reorder: boolean }) {
    const prepared = prepareTimelineSave(
      { startAt: row.startAt, endAt: row.endAt, notes: row.notes },
      row.lastSaved,
    );

    if (!prepared.ok) {
      setRows((prev) =>
        prev.map((item) => {
          if (item.id !== row.id || item.localRev !== row.localRev) return item;
          if (prepared.reason === "empty_notes" || prepared.revertNotes) {
            return { ...item, notes: item.lastSaved.notes, status: "saved", error: null };
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
                error: result.reason === "forbidden" ? "Logged out" : "Couldn’t save — tap to retry",
              }
            : item,
        ),
      );
      return;
    }

    const updated: Row = {
      ...row,
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
    };

    setRows((prev) => {
      const next = applyOrder(prev, result.order, updated);
      if (opts.reorder) scrollIfMoved(row.id, prev, next);
      return next;
    });
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

    const created = toRow({
      id: result.id,
      startAt: prepared.startAt,
      endAt: prepared.endAt,
      notes: prepared.notes,
    });
    setRows((prev) => {
      const next = applyOrder(prev, result.order, created);
      scrollIfMoved(created.id, prev, next);
      return next;
    });
    setDraft(null);
    return result;
  }

  useEffect(() => {
    persistRowRef.current = persistRow;
    persistDraftRef.current = persistDraft;
  });

  function handleStepperOpenChange(open: boolean) {
    stepperCountRef.current = Math.max(0, stepperCountRef.current + (open ? 1 : -1));
    setStepperOpen(stepperCountRef.current > 0);
  }

  function patchNotes(id: string, notes: string) {
    setRows((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, notes, status: "dirty", error: null, localRev: item.localRev + 1 }
          : item,
      ),
    );
    scheduleNotesSave(id);
  }

  function commitTimes(id: string, patch: Partial<Pick<Row, "startAt" | "endAt">>) {
    const current = rowsRef.current.find((item) => item.id === id);
    if (!current) return;
    const nextRow: Row = {
      ...current,
      ...patch,
      status: "dirty",
      error: null,
      localRev: current.localRev + 1,
    };
    setRows((prev) => prev.map((item) => (item.id === id ? nextRow : item)));
    void persistRow(nextRow, { reorder: true });
  }

  async function flushNotes(id: string) {
    clearTimer(id);
    const row = rowsRef.current.find((item) => item.id === id);
    if (row) await persistRow(row, { reorder: false });
  }

  async function switchMode(next: Mode) {
    if (next === mode) return;
    if (next === "review") {
      for (const row of rowsRef.current) {
        if (row.status === "dirty" || row.status === "saving") await persistRow(row, { reorder: true });
      }
      if (draftRef.current) await persistDraft(draftRef.current, { abandon: true });
      setConfirmDeleteId(null);
      stepperCountRef.current = 0;
      setStepperOpen(false);
    }
    setMode(next);
  }

  function startDraft() {
    if (draft) {
      document.getElementById("day-draft")?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
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

  async function persistPeerOrder(orderedPeerIds: string[], persist = true) {
    setRows((prev) => applyPeerOrder(prev, orderedPeerIds) ?? prev);
    if (!persist) return;
    const result = await saveTimelinePeerOrder(orderedPeerIds);
    if (!result.ok) {
      setBanner("Couldn’t reorder those moments — try again.");
      return;
    }
    setRows((prev) => applyOrder(prev, result.order));
  }

  const editing = canEdit && mode === "edit";
  const { untimed, timed } = splitRows(rows);
  const visible = editing ? [...untimed, ...timed] : [...timed, ...untimed];
  const hideChips = stepperOpen || noteFocused;
  const counts = Object.fromEntries(DAY_OF_BUCKETS.map((bucket) => [bucket.id, 0])) as Record<
    DayOfBucket,
    number
  >;
  for (const row of rows) counts[bucketForTime(row.startAt)] += 1;

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
            ? "Set a time to the minute. The card moves when you tap Done."
            : "Read-only schedule. Switch to Edit to change a moment."}
      </p>

      {banner ? (
        <p className="mb-3 rounded-xl border border-[var(--danger)]/30 bg-[color-mix(in_srgb,var(--danger)_8%,white)] px-3 py-2 text-sm text-[var(--danger)]">
          {banner}
        </p>
      ) : null}

      {!hideChips ? (
        <div className="sticky top-[4.75rem] z-10 -mx-1 mb-3 flex gap-2 overflow-x-auto bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] px-1 py-2 backdrop-blur-md print-hide">
          {DAY_OF_BUCKETS.filter((bucket) => counts[bucket.id] > 0).map((bucket) => (
            <button
              key={bucket.id}
              type="button"
              className="shrink-0 rounded-full border border-line bg-[var(--bg-elevated)] px-3 py-2 text-xs font-semibold"
              onClick={() => {
                document
                  .getElementById(`day-bucket-${bucket.id}`)
                  ?.scrollIntoView({ block: "start", behavior: "smooth" });
              }}
            >
              {bucket.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {rows.length === 0 && !draft ? (
          <div className="card p-6 text-center text-sm text-muted">
            {editing ? "No moments yet — tap + to add one." : "No moments yet."}
            {canEdit && !editing ? " Switch to Edit to add one." : null}
          </div>
        ) : null}

        {editing ? (
          <EditSections
            visible={visible}
            confirmDeleteId={confirmDeleteId}
            onCommitTimes={commitTimes}
            onPatchNotes={patchNotes}
            onFlushNotes={(id) => void flushNotes(id)}
            onRetry={(row) => void persistRow(row, { reorder: true })}
            onAskDelete={setConfirmDeleteId}
            onCancelDelete={() => setConfirmDeleteId(null)}
            onConfirmDelete={(id) => void removeRow(id)}
            onStepperOpenChange={handleStepperOpenChange}
            onNoteFocusChange={setNoteFocused}
            onPeerReorder={(ids, persist) => void persistPeerOrder(ids, persist)}
          />
        ) : (
          <ReviewSections timed={timed} untimed={untimed} />
        )}

        {editing && draft ? (
          <article id="day-draft" className="card p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
              New moment
            </p>
            <div className="grid grid-cols-2 gap-3">
              <DayTimeStepper
                label="Starts"
                value={draft.startAt}
                placeholder="3:37 PM"
                onCommit={(startAt) => setDraft({ ...draft, startAt })}
                onOpenChange={handleStepperOpenChange}
              />
              <DayTimeStepper
                label="Ends (optional)"
                value={draft.endAt}
                placeholder="4:00 PM"
                onCommit={(endAt) => setDraft({ ...draft, endAt })}
                onOpenChange={handleStepperOpenChange}
              />
            </div>
            <label className="mt-3 block text-sm">
              <span className="mb-1 block text-xs text-muted">What happens</span>
              <textarea
                value={draft.notes}
                rows={3}
                placeholder="Describe this moment…"
                autoFocus
                onFocus={() => setNoteFocused(true)}
                onBlur={() => setNoteFocused(false)}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                className="w-full resize-y rounded-xl border border-line bg-transparent px-3 py-2.5 text-[15px] leading-snug outline-none focus:border-[var(--accent)]"
              />
            </label>
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn-primary" onClick={() => void persistDraft(draft)}>
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

function ReviewSections({ timed, untimed }: { timed: Row[]; untimed: Row[] }) {
  return (
    <>
      {DAY_OF_BUCKETS.filter((bucket) => bucket.id !== "untimed").map((bucket) => {
        const items = timed.filter((row) => bucketForTime(row.startAt) === bucket.id);
        if (items.length === 0) return null;
        return (
          <section key={bucket.id} id={`day-bucket-${bucket.id}`} className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{bucket.label}</p>
            {items.map((row) => (
              <ReviewCard key={row.id} row={row} />
            ))}
          </section>
        );
      })}
      {untimed.length > 0 ? (
        <details id="day-bucket-untimed" className="card p-4">
          <summary className="cursor-pointer text-sm font-semibold">Untimed ({untimed.length})</summary>
          <div className="mt-3 flex flex-col gap-3">
            {untimed.map((row) => (
              <ReviewCard key={row.id} row={row} />
            ))}
          </div>
        </details>
      ) : null}
    </>
  );
}

function ReviewCard({ row }: { row: Row }) {
  return (
    <article id={`day-row-${row.id}`} className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
        {row.startAt}
        {row.endAt ? ` – ${row.endAt}` : ""}
      </p>
      <p className="mt-1 text-[15px] leading-snug">{row.notes}</p>
    </article>
  );
}

function EditSections({
  visible,
  confirmDeleteId,
  onCommitTimes,
  onPatchNotes,
  onFlushNotes,
  onRetry,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
  onStepperOpenChange,
  onNoteFocusChange,
  onPeerReorder,
}: {
  visible: Row[];
  confirmDeleteId: string | null;
  onCommitTimes: (id: string, patch: Partial<Pick<Row, "startAt" | "endAt">>) => void;
  onPatchNotes: (id: string, notes: string) => void;
  onFlushNotes: (id: string) => void;
  onRetry: (row: Row) => void;
  onAskDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (id: string) => void;
  onStepperOpenChange: (open: boolean) => void;
  onNoteFocusChange: (focused: boolean) => void;
  onPeerReorder: (ids: string[], persist?: boolean) => void;
}) {
  return (
    <>
      {DAY_OF_BUCKETS.map((bucket) => {
        const items = visible.filter((row) => bucketForTime(row.startAt) === bucket.id);
        if (items.length === 0) return null;
        return (
          <section key={bucket.id} id={`day-bucket-${bucket.id}`} className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{bucket.label}</p>
            {items.map((row) => {
              const peers = items.filter((item) => peerKey(item.startAt) === peerKey(row.startAt)).map((item) => item.id);
              return (
                <EditCard
                  key={row.id}
                  row={row}
                  peerIds={peers}
                  confirmDelete={confirmDeleteId === row.id}
                  onCommitTimes={onCommitTimes}
                  onPatchNotes={onPatchNotes}
                  onFlushNotes={onFlushNotes}
                  onRetry={() => onRetry(row)}
                  onAskDelete={() => onAskDelete(row.id)}
                  onCancelDelete={onCancelDelete}
                  onConfirmDelete={() => onConfirmDelete(row.id)}
                  onStepperOpenChange={onStepperOpenChange}
                  onNoteFocusChange={onNoteFocusChange}
                  onPeerReorder={onPeerReorder}
                />
              );
            })}
          </section>
        );
      })}
    </>
  );
}

function EditCard({
  row,
  peerIds,
  confirmDelete,
  onCommitTimes,
  onPatchNotes,
  onFlushNotes,
  onRetry,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
  onStepperOpenChange,
  onNoteFocusChange,
  onPeerReorder,
}: {
  row: Row;
  peerIds: string[];
  confirmDelete: boolean;
  onCommitTimes: (id: string, patch: Partial<Pick<Row, "startAt" | "endAt">>) => void;
  onPatchNotes: (id: string, notes: string) => void;
  onFlushNotes: (id: string) => void;
  onRetry: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onStepperOpenChange: (open: boolean) => void;
  onNoteFocusChange: (focused: boolean) => void;
  onPeerReorder: (ids: string[], persist?: boolean) => void;
}) {
  const endWarn = row.endAt.trim() ? endsBeforeStart(row.startAt, row.endAt) : false;
  const label = statusLabel(row.status, row.error);

  return (
    <article id={`day-row-${row.id}`} data-day-row={row.id} className="card p-4">
      <div className="mb-2 flex items-start gap-2">
        <PeerHandle rowId={row.id} peerIds={peerIds} onReorder={onPeerReorder} />
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-3">
          <DayTimeStepper
            label="Starts"
            value={row.startAt}
            placeholder="3:37 PM"
            onCommit={(startAt) => onCommitTimes(row.id, { startAt })}
            onOpenChange={onStepperOpenChange}
          />
          <DayTimeStepper
            label="Ends (optional)"
            value={row.endAt}
            placeholder="4:00 PM"
            onCommit={(endAt) => onCommitTimes(row.id, { endAt })}
            onOpenChange={onStepperOpenChange}
          />
        </div>
      </div>
      {endWarn ? (
        <p className="mt-2 text-xs font-semibold text-[var(--warn)]">Ends before it starts</p>
      ) : null}
      <label className="mt-3 block text-sm">
        <span className="mb-1 block text-xs text-muted">What happens</span>
        <textarea
          value={row.notes}
          rows={3}
          onChange={(event) => onPatchNotes(row.id, event.target.value)}
          onFocus={(event) => {
            onNoteFocusChange(true);
            event.currentTarget.scrollIntoView({ block: "center", behavior: "smooth" });
          }}
          onBlur={() => {
            onNoteFocusChange(false);
            onFlushNotes(row.id);
          }}
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
            <button type="button" className="text-sm font-semibold text-[var(--danger)]" onClick={onConfirmDelete}>
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

function PeerHandle({
  rowId,
  peerIds,
  onReorder,
}: {
  rowId: string;
  peerIds: string[];
  onReorder: (ids: string[], persist?: boolean) => void;
}) {
  const index = peerIds.indexOf(rowId);
  if (peerIds.length < 2 || index < 0) {
    return <div className="w-8 shrink-0" />;
  }

  function move(delta: number) {
    const from = peerIds.indexOf(rowId);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= peerIds.length) return;
    const next = [...peerIds];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onReorder(next);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const startY = event.clientY;
    let current = [...peerIds];
    let lastIndex = current.indexOf(rowId);

    function yToIndex(clientY: number) {
      const mids = current.map((id) => {
        const el = document.getElementById(`day-row-${id}`);
        if (!el) return Number.POSITIVE_INFINITY;
        const rect = el.getBoundingClientRect();
        return rect.top + rect.height / 2;
      });
      let best = lastIndex;
      let bestDist = Number.POSITIVE_INFINITY;
      mids.forEach((mid, i) => {
        const dist = Math.abs(mid - clientY);
        if (dist < bestDist) {
          best = i;
          bestDist = dist;
        }
      });
      return best;
    }

    function onMove(moveEvent: PointerEvent) {
      if (Math.abs(moveEvent.clientY - startY) < 8) return;
      const nextIndex = yToIndex(moveEvent.clientY);
      if (nextIndex === lastIndex) return;
      lastIndex = nextIndex;
      const next = current.filter((id) => id !== rowId);
      next.splice(nextIndex, 0, rowId);
      current = next;
      onReorder(next, false);
    }

    function onUp() {
      handle.releasePointerCapture(event.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      onReorder(current, true);
    }

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  }

  return (
    <div className="flex w-8 shrink-0 flex-col gap-1 pt-6 print-hide">
      <button
        type="button"
        aria-label="Move earlier among same-time moments"
        disabled={index === 0}
        className="min-h-10 rounded-lg border border-line text-xs font-semibold text-muted disabled:opacity-30"
        onClick={() => move(-1)}
      >
        ↑
      </button>
      <button
        type="button"
        aria-label="Drag to reorder same-time moments"
        className="min-h-11 touch-none rounded-lg border border-line text-xs font-semibold text-muted"
        onPointerDown={onPointerDown}
      >
        ≡
      </button>
      <button
        type="button"
        aria-label="Move later among same-time moments"
        disabled={index === peerIds.length - 1}
        className="min-h-10 rounded-lg border border-line text-xs font-semibold text-muted disabled:opacity-30"
        onClick={() => move(1)}
      >
        ↓
      </button>
    </div>
  );
}
