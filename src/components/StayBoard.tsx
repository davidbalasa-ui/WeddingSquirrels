"use client";

import { useRef, useState } from "react";
import {
  addStayBathNote,
  deleteStayBathNote,
  saveStayBathNote,
  saveStayOccupant,
} from "@/app/actions";
import { STAY_SECTIONS, type StaySectionId, type StaySlotDef } from "@/lib/stay";

const SLOT_DEFS = new Map<string, StaySlotDef>(
  STAY_SECTIONS.flatMap((section) => section.slots.map((slot) => [slot.id, slot])),
);

export type StaySlotView = {
  id: string;
  sectionId: string;
  label: string;
  occupant: string;
  optional: boolean;
};

export type StayBathNoteView = {
  id: string;
  sectionId: string;
  note: string;
};

function selectAll(event: { currentTarget: HTMLInputElement }) {
  const input = event.currentTarget;
  requestAnimationFrame(() => input.select());
}

export function StayBoard({
  slots,
  notes,
}: {
  slots: StaySlotView[];
  notes: StayBathNoteView[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted">Tap a name to claim a bed. Bathroom notes can be added or removed per room.</p>
      {STAY_SECTIONS.map((section) => (
        <StaySection
          key={section.id}
          sectionId={section.id}
          title={section.title}
          detail={section.detail}
          slots={slots.filter((slot) => slot.sectionId === section.id)}
          notes={notes.filter((note) => note.sectionId === section.id)}
        />
      ))}
    </div>
  );
}

function StaySection({
  sectionId,
  title,
  detail,
  slots,
  notes,
}: {
  sectionId: StaySectionId;
  title: string;
  detail: string;
  slots: StaySlotView[];
  notes: StayBathNoteView[];
}) {
  const [noteSource, setNoteSource] = useState(notes);
  const [bathNotes, setBathNotes] = useState(notes);
  const [adding, setAdding] = useState(false);
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null);
  if (notes !== noteSource) {
    setNoteSource(notes);
    setBathNotes(notes);
  }

  async function addNote() {
    setAdding(true);
    try {
      const result = await addStayBathNote(sectionId);
      if (!result.ok) return;
      setBathNotes((prev) => [...prev, { id: result.id, sectionId, note: "" }]);
      setFocusNoteId(result.id);
    } finally {
      setAdding(false);
    }
  }

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-line px-3 py-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-[11px] text-muted">{detail}</p>
      </div>
      <div className="divide-y divide-[var(--line)]">
        {slots.map((slot, index) => {
          const group = SLOT_DEFS.get(slot.id)?.group;
          const prevGroup = index > 0 ? SLOT_DEFS.get(slots[index - 1]!.id)?.group : undefined;
          return (
            <div key={slot.id}>
              {group && group !== prevGroup ? (
                <p className="bg-[color-mix(in_srgb,var(--accent-soft)_55%,transparent)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  {group}
                </p>
              ) : null}
              <StaySlotRow slot={slot} />
            </div>
          );
        })}
      </div>
      <div className="border-t border-line px-3 py-2">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Bathroom</p>
          <button
            type="button"
            disabled={adding}
            className="text-xs font-semibold text-[var(--accent)] disabled:opacity-60"
            onClick={() => void addNote()}
          >
            {adding ? "Adding…" : "+ Add note"}
          </button>
        </div>
        {bathNotes.length === 0 ? (
          <p className="py-1 text-xs text-muted">No bathroom notes yet. Add one for timing, extras, or who is using it.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {bathNotes.map((note) => (
              <BathNoteRow
                key={note.id}
                note={note}
                autoFocus={focusNoteId === note.id}
                onRemoved={() => setBathNotes((prev) => prev.filter((item) => item.id !== note.id))}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function StaySlotRow({ slot }: { slot: StaySlotView }) {
  const [propOccupant, setPropOccupant] = useState(slot.occupant);
  const [saved, setSaved] = useState(slot.occupant);
  const [value, setValue] = useState(slot.occupant);
  if (slot.occupant !== propOccupant) {
    setPropOccupant(slot.occupant);
    setSaved(slot.occupant);
    setValue(slot.occupant);
  }

  async function commit() {
    const next = value.trim();
    if (next === saved.trim()) return;
    const result = await saveStayOccupant(slot.id, next);
    if (result.ok) {
      setSaved(next);
      setValue(next);
    } else {
      setValue(saved);
    }
  }

  return (
    <label className="flex min-h-11 items-center gap-2 px-3 py-2">
      <span className="w-[9.5rem] shrink-0 text-[12px] leading-5 text-muted">
        {slot.label}
        {slot.optional ? <span className="text-[10px]"> · opt</span> : null}
      </span>
      <span className="text-muted">=</span>
      <input
        value={value}
        placeholder="Tap to claim"
        enterKeyHint="done"
        autoCorrect="off"
        spellCheck={false}
        onFocus={selectAll}
        onClick={selectAll}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className="min-h-11 min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] leading-5 outline-none placeholder:text-muted"
      />
    </label>
  );
}

function BathNoteRow({
  note,
  autoFocus,
  onRemoved,
}: {
  note: StayBathNoteView;
  autoFocus?: boolean;
  onRemoved: () => void;
}) {
  const [value, setValue] = useState(note.note);
  const lastSaved = useRef(note.note);

  async function commit() {
    if (value.trim() === lastSaved.current.trim()) return;
    const result = await saveStayBathNote(note.id, value);
    if (!result.ok) return;
    if (!value.trim()) {
      onRemoved();
      return;
    }
    lastSaved.current = value.trim();
    setValue(value.trim());
  }

  async function remove() {
    const result = await deleteStayBathNote(note.id);
    if (result.ok) onRemoved();
  }

  return (
    <div className="flex items-start gap-2">
      <textarea
        value={value}
        autoFocus={autoFocus}
        rows={2}
        placeholder="Who’s using it, timing, extras…"
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => void commit()}
        className="min-h-16 min-w-0 flex-1 resize-y rounded-xl border border-line bg-white px-2.5 py-2 text-[14px] leading-5 outline-none placeholder:text-muted focus:border-[var(--accent)]"
      />
      <button
        type="button"
        aria-label="Remove bathroom note"
        className="mt-1 rounded-full px-2 py-1 text-xs font-semibold text-muted hover:bg-white hover:text-[var(--danger)]"
        onClick={() => void remove()}
      >
        Remove
      </button>
    </div>
  );
}
