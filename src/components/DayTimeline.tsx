"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { taskHref } from "@/lib/entity-links";
import {
  createTimelineBlock,
  deleteTimelineBlock,
  saveTimelineBlock,
  saveTimelinePeerOrder,
} from "@/app/actions";
import { DayTimeRange } from "@/components/DayTimeStepper";
import {
  mergeEditorNotesBody,
  notesBodyForEditor,
  parseBlockNotes,
  updateBlockLocation,
} from "@/lib/day-of-now";
import { TIMELINE_PHASES, phaseForBlock } from "@/lib/reconciled-timeline";
import {
  TIMELINE_ROLES,
  duplicateFlagLabel,
  findTimelineDuplicates,
  momentForRole,
  reviewMoment,
  type DuplicateFlag,
  type RoleNameContext,
  type TimelineRole,
} from "@/lib/day-timeline-view";
import {
  DAY_OF_BUCKETS,
  applyPeerOrder,
  bucketForTime,
  endsBeforeStart,
  peerKey,
  prepareTimelineCreate,
  prepareTimelineSave,
  sortTimelineBlocks,
  type DayOfBucket,
  type TimelineSchedule,
} from "@/lib/day-of-time";

/**
 * A server action that throws (usually because the app was redeployed while this
 * page stayed open, so the old page's actions no longer exist) must not leave a
 * row stuck on "Saving…" or a Remove tap doing nothing.
 */
const UNREACHABLE = { ok: false as const, reason: "unreachable" as const };
async function runAction<T>(call: () => Promise<T>): Promise<T | typeof UNREACHABLE> {
  try {
    return await call();
  } catch {
    return UNREACHABLE;
  }
}

export type TimelineBlockView = {
  id: string;
  seedKey?: string | null;
  startAt: string;
  endAt: string | null;
  notes: string;
  sortOrder?: number;
};

type Mode = "review" | "edit";
type RowStatus = "saved" | "saving" | "dirty" | "error";

type Row = {
  id: string;
  seedKey: string | null;
  startAt: string;
  endAt: string;
  notes: string;
  sortOrder: number;
  lastSaved: { startAt: string; endAt: string; notes: string };
  status: RowStatus;
  error: string | null;
  localRev: number;
};

type Draft = {
  startAt: string;
  endAt: string;
  notes: string;
  location: string;
};

function toRow(block: TimelineBlockView): Row {
  const lastSaved = {
    startAt: block.startAt,
    endAt: block.endAt ?? "",
    notes: block.notes,
  };
  return {
    id: block.id,
    seedKey: block.seedKey ?? null,
    ...lastSaved,
    lastSaved,
    sortOrder: block.sortOrder ?? 0,
    status: "saved",
    error: null,
    localRev: 0,
  };
}

function statusLabel(status: RowStatus, error: string | null) {
  if (status === "saving") return "Saving…";
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
  schedule = "wedding",
  idPrefix = "day",
  fixedAdd = true,
  relatedByBlockId = {},
  printTitle,
  printSubtitle,
  roleNames = {},
}: {
  blocks: TimelineBlockView[];
  canEdit: boolean;
  startInEdit?: boolean;
  schedule?: TimelineSchedule;
  idPrefix?: string;
  fixedAdd?: boolean;
  relatedByBlockId?: Record<string, { id: string; title: string }>;
  /** When set, the page gets a Print button and a binder-style header that only shows on paper. */
  printTitle?: string;
  printSubtitle?: string | null;
  /** Known names per role so "Katie arrives" lands on the wedding party view. */
  roleNames?: RoleNameContext;
}) {
  const [mode, setMode] = useState<Mode>(canEdit && startInEdit ? "edit" : "review");
  const [rows, setRows] = useState<Row[]>(() => blocks.map(toRow));
  const [blockSource, setBlockSource] = useState(blocks);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState(false);
  const [stepperOpen, setStepperOpen] = useState(false);
  const [noteFocused, setNoteFocused] = useState(false);
  const [role, setRole] = useState<TimelineRole | null>(null);

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

  // Closed <details> print empty, so the Untimed group opens for the printout and closes again after.
  useEffect(() => {
    if (!printTitle) return;
    let opened: HTMLDetailsElement[] = [];
    function before() {
      opened = Array.from(document.querySelectorAll<HTMLDetailsElement>("details.day-timeline-untimed:not([open])"));
      for (const el of opened) el.open = true;
    }
    function after() {
      for (const el of opened) el.open = false;
      opened = [];
    }
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, [printTitle]);

  if (blocks !== blockSource) {
    setBlockSource(blocks);
    setRows((prev) => {
      const prevById = new Map(prev.map((row) => [row.id, row]));
      return blocks.map((block) => {
        const existing = prevById.get(block.id);
        if (existing && (existing.status === "dirty" || existing.status === "saving" || existing.status === "error")) {
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
    if (from === to) return;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const el = document.getElementById(`${idPrefix}-row-${id}`);
        if (!el) return;
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        if (!el.contains(document.activeElement)) {
          el.focus({ preventScroll: true });
        }
      });
    });
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

    const result = await runAction(() => saveTimelineBlock({
      id: row.id,
      startAt: prepared.startAt,
      endAt: prepared.endAt ?? "",
      notes: prepared.notes,
    }));

    if (inflightRef.current.get(row.id) !== row.localRev) return;

    if (!result.ok) {
      if (result.reason === "unreachable") setUnreachable(true);
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

    setUnreachable(false);
    setRows((prev) => {
      // Typing that landed while this save was in flight stays; its own save is already queued.
      const current = prev.find((item) => item.id === row.id);
      const keep = current && current.localRev !== row.localRev ? { ...current, lastSaved: updated.lastSaved } : updated;
      const next = applyOrder(prev, result.order, keep);
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

    const notesWithLocation = openDraft.location.trim()
      ? updateBlockLocation(prepared.notes, openDraft.location)
      : prepared.notes;

    const result = await runAction(() => createTimelineBlock({
      startAt: prepared.startAt,
      endAt: prepared.endAt ?? "",
      notes: notesWithLocation,
      schedule,
    }));
    draftSavingRef.current = false;

    if (!result.ok) {
      if (result.reason === "unreachable") setUnreachable(true);
      if (result.reason === "forbidden") {
        setBanner("You were logged out or lost edit access. Copy your text, then log in again.");
        setMode("review");
        return result;
      }
      setBanner("Couldn’t add that moment — try again.");
      return result;
    }

    setUnreachable(false);
    const created = toRow({
      id: result.id,
      startAt: prepared.startAt,
      endAt: prepared.endAt,
      notes: notesWithLocation,
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

  function patchLocation(id: string, location: string) {
    setRows((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const notes = updateBlockLocation(item.notes, location || null);
        return { ...item, notes, status: "dirty", error: null, localRev: item.localRev + 1 };
      }),
    );
    scheduleNotesSave(id);
  }

  function patchNotesBody(id: string, editorBody: string) {
    setRows((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const notes = mergeEditorNotesBody(item.notes, editorBody);
        return { ...item, notes, status: "dirty", error: null, localRev: item.localRev + 1 };
      }),
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
    setRows((prev) => {
      const patched = prev.map((item) => (item.id === id ? nextRow : item));
      const next = sortTimelineBlocks(patched);
      scrollIfMoved(id, prev, next);
      return next;
    });
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
      document.getElementById(`${idPrefix}-draft`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    setDraft({ startAt: "", endAt: "", notes: "", location: "" });
    setConfirmDeleteId(null);
  }

  async function removeRow(id: string) {
    clearTimer(id);
    const result = await runAction(() => deleteTimelineBlock(id));
    if (!result.ok) {
      if (result.reason === "unreachable") setUnreachable(true);
      if (result.reason === "forbidden") {
        setBanner("You were logged out or lost edit access.");
        setMode("review");
        return;
      }
      setBanner("Couldn’t remove that moment — try again.");
      return;
    }
    setUnreachable(false);
    setRows((prev) => prev.filter((row) => row.id !== id));
    setConfirmDeleteId(null);
  }

  async function persistPeerOrder(orderedPeerIds: string[], persist = true) {
    setRows((prev) => applyPeerOrder(prev, orderedPeerIds) ?? prev);
    if (!persist) return;
    const result = await runAction(() => saveTimelinePeerOrder(orderedPeerIds));
    if (!result.ok) {
      if (result.reason === "unreachable") setUnreachable(true);
      setBanner("Couldn’t reorder those moments — try again.");
      return;
    }
    setUnreachable(false);
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
  const duplicates = canEdit && !editing ? findTimelineDuplicates(rows) : {};
  const roleLabel = role ? TIMELINE_ROLES.find((item) => item.id === role)?.label ?? null : null;

  return (
    <div className={`day-timeline ${editing && fixedAdd ? "pb-24" : ""}`}>
      {printTitle ? (
        <header className="day-timeline-print-header binder-doc" aria-hidden="true">
          <p className="binder-kicker">Wedding Binder</p>
          <h1>{roleLabel ? `${printTitle} · ${roleLabel}` : printTitle}</h1>
          {printSubtitle ? <p className="binder-date">{printSubtitle}</p> : null}
          <div className="binder-sunset">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </header>
      ) : null}

      {printTitle ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 print-hide">
          <button
            type="button"
            className="btn-secondary min-h-11 px-4 py-2 text-sm"
            onClick={() => window.print()}
          >
            Print
          </button>
          <Link href="/print" className="min-h-11 inline-flex items-center px-1 text-sm font-semibold text-[var(--accent)]">
            Full binder &amp; packets →
          </Link>
        </div>
      ) : null}

      {canEdit ? (
        <div className="mb-2 grid grid-cols-2 rounded-full border border-line bg-[var(--bg-elevated)] p-0.5 print-hide">
          <button
            type="button"
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              mode === "review" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-muted"
            }`}
            onClick={() => void switchMode("review")}
          >
            Review
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              mode === "edit" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-muted"
            }`}
            onClick={() => void switchMode("edit")}
          >
            Edit
          </button>
        </div>
      ) : null}

      {!editing && rows.length > 0 ? (
        <div className="mb-2 -mx-1 flex gap-1.5 overflow-x-auto px-1 py-1 print-hide" role="group" aria-label="Show the day for">
          <button
            type="button"
            className="filter-pill shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-semibold"
            data-active={role === null}
            aria-pressed={role === null}
            style={role === null ? { borderColor: "var(--accent)", background: "var(--accent-soft)", color: "var(--accent)" } : undefined}
            onClick={() => setRole(null)}
          >
            Everyone
          </button>
          {TIMELINE_ROLES.map((item) => (
            <button
              key={item.id}
              type="button"
              className="filter-pill shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-semibold"
              data-active={role === item.id}
              aria-pressed={role === item.id}
              style={role === item.id ? { borderColor: "var(--accent)", background: "var(--accent-soft)", color: "var(--accent)" } : undefined}
              onClick={() => setRole(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {editing ? (
        <p className="mb-2 text-xs text-muted">
          Tap the hour or minutes. AM/PM opens a picker — tap AM or PM to confirm. Click outside to cancel.
        </p>
      ) : null}

      {unreachable ? (
        <div
          role="alert"
          className="print-hide fixed left-1/2 z-[40] flex w-[min(560px,calc(100%-16px))] -translate-x-1/2 items-center gap-3 rounded-2xl border border-[var(--danger)]/30 bg-[color-mix(in_srgb,var(--danger)_8%,white)] px-4 py-3 text-sm text-[var(--danger)] shadow-[var(--shadow)]"
          style={{ bottom: "calc(148px + env(safe-area-inset-bottom, 0px))" }}
        >
          <span className="flex-1">Changes aren’t saving right now. Check the connection, or reload if the app was just updated.</span>
          <button
            type="button"
            className="shrink-0 rounded-full bg-[var(--danger)] px-3 py-1.5 text-sm font-semibold text-white"
            onClick={() => {
              const unsaved = rowsRef.current.some((row) => row.status !== "saved");
              if (unsaved && !window.confirm("Some changes haven’t saved yet and will be lost if you reload. Reload anyway?")) return;
              window.location.reload();
            }}
          >
            Reload
          </button>
        </div>
      ) : null}

      {banner ? (
        <p className="mb-3 rounded-xl border border-[var(--danger)]/30 bg-[color-mix(in_srgb,var(--danger)_8%,white)] px-3 py-2 text-sm text-[var(--danger)]">
          {banner}
        </p>
      ) : null}

      {!hideChips && editing ? (
        <div className="sticky top-[4.75rem] z-10 -mx-1 mb-2 flex gap-1.5 overflow-x-auto bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] px-1 py-1.5 backdrop-blur-md print-hide">
          {DAY_OF_BUCKETS.filter((bucket) => counts[bucket.id] > 0).map((bucket) => (
            <button
              key={bucket.id}
              type="button"
              className="shrink-0 rounded-full border border-line bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-semibold"
              onClick={() => {
                document
                  .getElementById(`${idPrefix}-bucket-${bucket.id}`)
                  ?.scrollIntoView({ block: "start", behavior: "smooth" });
              }}
            >
              {bucket.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        {rows.length === 0 && !draft ? (
          <div className="card p-6 text-center text-sm text-muted">
            {editing ? "Nothing scheduled yet — tap + to add one." : "Nothing scheduled yet."}
            {canEdit && !editing ? " Switch to Edit to add one." : null}
          </div>
        ) : null}

        {editing ? (
          <EditSections
            idPrefix={idPrefix}
            visible={visible}
            confirmDeleteId={confirmDeleteId}
            onCommitTimes={commitTimes}
            onPatchNotes={patchNotesBody}
            onPatchLocation={patchLocation}
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
          <ReviewSections
            idPrefix={idPrefix}
            timed={timed}
            untimed={untimed}
            relatedByBlockId={relatedByBlockId}
            duplicates={duplicates}
            schedule={schedule}
            role={role}
            roleNames={roleNames}
          />
        )}

        {editing && draft ? (
          <article id={`${idPrefix}-draft`} className="card px-3 py-2">
            <DayTimeRange
              startAt={draft.startAt}
              endAt={draft.endAt}
              placeholder="Set time"
              onCommit={(next) => setDraft({ ...draft, ...next })}
              onOpenChange={handleStepperOpenChange}
            />
            <input
              value={draft.location}
              placeholder="Location (optional)"
              onChange={(event) => setDraft({ ...draft, location: event.target.value })}
              className="mt-2 w-full border-0 bg-transparent p-0 text-sm text-muted outline-none"
            />
            <textarea
              value={draft.notes}
              placeholder="What happens — press Enter for a new line"
              rows={3}
              autoFocus
              onFocus={() => setNoteFocused(true)}
              onBlur={() => setNoteFocused(false)}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              className="mt-1 w-full resize-y border-0 bg-transparent p-0 text-[15px] leading-snug outline-none"
            />
            <div className="mt-2 flex gap-2">
              <button type="button" className="text-sm font-semibold text-[var(--accent)]" onClick={() => void persistDraft(draft)}>
                Add
              </button>
              <button type="button" className="text-sm font-semibold text-muted" onClick={() => setDraft(null)}>
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
          className={
            fixedAdd
              ? "print-hide fixed left-1/2 z-[35] w-[min(560px,calc(100%-16px))] -translate-x-1/2 rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-[var(--shadow)]"
              : "print-hide mt-1 rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-[var(--shadow)]"
          }
          style={fixedAdd ? { bottom: "calc(88px + env(safe-area-inset-bottom, 0px))" } : undefined}
        >
          + Add moment
        </button>
      ) : null}
    </div>
  );
}

function ReviewSections({
  idPrefix,
  timed,
  untimed,
  relatedByBlockId,
  duplicates,
  schedule,
  role,
  roleNames,
}: {
  idPrefix: string;
  timed: Row[];
  untimed: Row[];
  relatedByBlockId: Record<string, { id: string; title: string }>;
  duplicates: Record<string, DuplicateFlag[]>;
  schedule: TimelineSchedule;
  role: TimelineRole | null;
  roleNames: RoleNameContext;
}) {
  const view = (row: Row) =>
    momentForRole(reviewMoment({ startAt: row.startAt, endAt: row.endAt || null, notes: row.notes }, roleNames), role);
  const all = [...timed, ...untimed].map((row) => ({ row, moment: view(row) })).filter((item) => item.moment);
  if (all.length === 0) {
    // An empty page already shows its own "Nothing scheduled yet" card.
    if (!role) return null;
    return (
      <div className="card p-6 text-center text-sm text-muted">
        Nothing on the timeline mentions this group yet.
      </div>
    );
  }
  const phases = [...TIMELINE_PHASES.filter((phase) => phase.schedule === schedule), { id: "untimed", label: "Untimed", schedule }];
  return (
    <div className="flex flex-col gap-3">
      {phases.map((phase) => {
        const items = all.filter(({ row }) => phaseForBlock(row, schedule) === phase.id);
        if (items.length === 0) return null;
        return (
          <section key={phase.id} id={`${idPrefix}-bucket-${phase.id}`} className="day-timeline-bucket">
            <p className="day-timeline-bucket-label mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              {phase.label}
            </p>
            <div className="card day-timeline-list divide-y divide-[var(--line)] overflow-hidden">
              {items.map(({ row, moment }) => (
                <ReviewRow
                  key={row.id}
                  row={row}
                  moment={moment!}
                  related={relatedByBlockId[row.id]}
                  flags={duplicates[row.id]}
                  schedule={schedule}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

const DETAIL_TAG: Record<"cue" | "music", string> = { cue: "MC cue", music: "Music" };

function ReviewRow({
  row,
  moment,
  related,
  flags,
  schedule,
}: {
  row: Row;
  moment: ReturnType<typeof reviewMoment>;
  related?: { id: string; title: string };
  flags?: DuplicateFlag[];
  schedule?: TimelineSchedule;
}) {
  return (
    <article id={`block-${row.id}`} className="day-timeline-row flex items-start gap-3 px-3 py-2">
      <p className="day-timeline-time w-[5.25rem] shrink-0 text-[12px] font-semibold leading-5 tabular-nums text-[var(--accent)]">
        {moment.timeStart}
        {moment.timeEnd ? (
          <>
            {" "}
            <span className="day-timeline-time-end block text-muted">– {moment.timeEnd}</span>
          </>
        ) : null}
      </p>
      <div className="min-w-0 flex-1">
        <p className="day-timeline-title text-[15px] font-semibold leading-5">
          {moment.title}
          {moment.location ? (
            <span className="day-timeline-location font-normal text-muted"> · {moment.location}</span>
          ) : null}
        </p>
        {moment.details.length > 0 ? (
          <ul className="day-timeline-details mt-0.5 list-none space-y-0.5 p-0">
            {moment.details.map((detail, index) => (
              <li
                key={`${index}-${detail.text}`}
                className={`day-timeline-detail text-[14px] leading-5 ${detail.kind === "note" ? "" : "text-muted"} ${detail.kind === "open" ? "day-timeline-open italic" : ""}`}
                data-kind={detail.kind}
              >
                {detail.kind === "cue" || detail.kind === "music" ? (
                  <span className="day-timeline-tag mr-1.5 rounded-sm border border-line px-1 text-[10px] font-semibold uppercase tracking-[0.08em] align-[1px]">
                    {DETAIL_TAG[detail.kind]}
                  </span>
                ) : null}
                {detail.kind === "open" ? <span className="not-italic font-semibold">Open: </span> : null}
                {detail.time ? (
                  <span className="day-timeline-subtime mr-2 font-semibold tabular-nums text-[var(--accent)]">{detail.time}</span>
                ) : null}
                {detail.text}
              </li>
            ))}
          </ul>
        ) : null}
        {flags?.length ? (
          <p className="mt-1 text-xs font-semibold text-[var(--warn)] print-hide">
            Possible duplicate · {flags.map(duplicateFlagLabel).join(" · ")}
          </p>
        ) : null}
        {related ? (
          <p className="mt-1 text-xs print-hide">
            <Link
              href={taskHref(related.id, {
                returnTo: schedule === "rehearsal" ? "/plan/rehearsal" : "/plan/timeline",
              })}
              className="font-semibold text-[var(--accent)]"
            >
              Related task · {related.title}
            </Link>
          </p>
        ) : null}
      </div>
    </article>
  );
}

function EditSections({
  idPrefix,
  visible,
  confirmDeleteId,
  onCommitTimes,
  onPatchNotes,
  onPatchLocation,
  onFlushNotes,
  onRetry,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
  onStepperOpenChange,
  onNoteFocusChange,
  onPeerReorder,
}: {
  idPrefix: string;
  visible: Row[];
  confirmDeleteId: string | null;
  onCommitTimes: (id: string, patch: Partial<Pick<Row, "startAt" | "endAt">>) => void;
  onPatchNotes: (id: string, notes: string) => void;
  onPatchLocation: (id: string, location: string) => void;
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
          <section key={bucket.id} id={`${idPrefix}-bucket-${bucket.id}`} className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{bucket.label}</p>
            {items.map((row) => {
              const key = peerKey(row.startAt, row.endAt);
              const peers = key
                ? items.filter((item) => peerKey(item.startAt, item.endAt) === key).map((item) => item.id)
                : [];
              return (
                <EditCard
                  key={row.id}
                  idPrefix={idPrefix}
                  row={row}
                  peerIds={peers}
                  confirmDelete={confirmDeleteId === row.id}
                  onCommitTimes={onCommitTimes}
                  onPatchNotes={onPatchNotes}
                  onPatchLocation={onPatchLocation}
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
  idPrefix,
  row,
  peerIds,
  confirmDelete,
  onCommitTimes,
  onPatchNotes,
  onPatchLocation,
  onFlushNotes,
  onRetry,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
  onStepperOpenChange,
  onNoteFocusChange,
  onPeerReorder,
}: {
  idPrefix: string;
  row: Row;
  peerIds: string[];
  confirmDelete: boolean;
  onCommitTimes: (id: string, patch: Partial<Pick<Row, "startAt" | "endAt">>) => void;
  onPatchNotes: (id: string, notes: string) => void;
  onPatchLocation: (id: string, location: string) => void;
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
  // While a field has focus it shows exactly what was typed. The stored notes are
  // tidied (lines trimmed, blank lines dropped), so rendering them back mid-typing
  // would swallow every space typed at the end of a line and every new line.
  const [locationDraft, setLocationDraft] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<string | null>(null);
  const location = locationDraft ?? parseBlockNotes(row.notes).location ?? "";
  const notesBody = notesDraft ?? notesBodyForEditor(row.notes);

  return (
    <article
      id={`${idPrefix}-row-${row.id}`}
      data-day-row={row.id}
      tabIndex={-1}
      className="card px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    >
      <div className="flex items-start gap-2">
        <DayTimeRange
          startAt={row.startAt}
          endAt={row.endAt}
          onCommit={(next) => onCommitTimes(row.id, next)}
          onOpenChange={onStepperOpenChange}
        />
        <PeerHandle idPrefix={idPrefix} rowId={row.id} peerIds={peerIds} onReorder={onPeerReorder} />
        {confirmDelete ? (
          <div className="flex shrink-0 items-center gap-2 pt-1">
            <button type="button" className="text-xs font-semibold text-[var(--danger)]" onClick={onConfirmDelete}>
              Remove?
            </button>
            <button type="button" className="text-xs font-semibold text-muted" onClick={onCancelDelete}>
              Keep
            </button>
          </div>
        ) : (
          <button
            type="button"
            aria-label="Remove moment"
            className="shrink-0 pt-1 text-xs font-semibold text-muted"
            onClick={onAskDelete}
          >
            ×
          </button>
        )}
      </div>
      {endWarn ? <p className="text-[11px] font-semibold text-[var(--warn)]">Ends before it starts</p> : null}
      <label className="mt-1 block text-xs text-muted">
        Location
        <input
          value={location}
          placeholder="Where this happens"
          onChange={(event) => {
            setLocationDraft(event.target.value);
            onPatchLocation(row.id, event.target.value);
          }}
          onFocus={() => onNoteFocusChange(true)}
          onBlur={() => {
            setLocationDraft(null);
            onNoteFocusChange(false);
            onFlushNotes(row.id);
          }}
          className="mt-0.5 w-full border-0 bg-transparent p-0 text-sm text-ink outline-none"
        />
      </label>
      <textarea
        value={notesBody}
        rows={Math.min(8, Math.max(2, notesBody.split(/\r?\n/).length))}
        onChange={(event) => {
          setNotesDraft(event.target.value);
          onPatchNotes(row.id, event.target.value);
        }}
        onFocus={(event) => {
          onNoteFocusChange(true);
          event.currentTarget.scrollIntoView({ block: "center", behavior: "smooth" });
        }}
        onBlur={() => {
          setNotesDraft(null);
          onNoteFocusChange(false);
          onFlushNotes(row.id);
        }}
        className="mt-0.5 w-full resize-y border-0 bg-transparent p-0 text-[15px] leading-snug outline-none"
      />
      {label ? (
        <button
          type="button"
          className="mt-0.5 text-[11px] font-semibold text-muted"
          onClick={row.status === "error" ? onRetry : undefined}
        >
          {label}
        </button>
      ) : null}
    </article>
  );
}

function PeerHandle({
  idPrefix,
  rowId,
  peerIds,
  onReorder,
}: {
  idPrefix: string;
  rowId: string;
  peerIds: string[];
  onReorder: (ids: string[], persist?: boolean) => void;
}) {
  const draggedRef = useRef(false);
  const index = peerIds.indexOf(rowId);
  if (peerIds.length < 2 || index < 0) return null;

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
    // Phones send no click after a touch drag, so clear the flag here too.
    draggedRef.current = false;
    handle.setPointerCapture(event.pointerId);
    const startY = event.clientY;
    let current = [...peerIds];
    let lastIndex = current.indexOf(rowId);
    let moved = false;

    function yToIndex(clientY: number) {
      const mids = current.map((id) => {
        const el = document.getElementById(`${idPrefix}-row-${id}`);
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
      moved = true;
      draggedRef.current = true;
      const next = current.filter((id) => id !== rowId);
      next.splice(nextIndex, 0, rowId);
      current = next;
      onReorder(next, false);
    }

    function onUp() {
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      // A plain tap falls through to onClick (nudge one place); only a real drag saves here.
      if (moved) onReorder(current, true);
    }

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }

  return (
    <button
      type="button"
      aria-label="Drag to reorder matching start and end"
      className="print-hide mt-0.5 min-h-8 w-8 shrink-0 touch-none rounded-md text-sm font-semibold text-muted"
      onPointerDown={onPointerDown}
      onClick={() => {
        // The click that follows a drag must not nudge the row a second time.
        if (draggedRef.current) {
          draggedRef.current = false;
          return;
        }
        if (index < peerIds.length - 1) move(1);
        else if (index > 0) move(-1);
      }}
    >
      ≡
    </button>
  );
}
