"use client";

import { useEffect, useRef, useState } from "react";
import {
  clockPartsFromRaw,
  nextClockDigits,
  normalizeClockEntry,
  rawFromClockParts,
  type ClockMeridiem,
  type ClockParts,
} from "@/lib/day-of-time";

// Selected right away, not on the next frame: a digit typed straight after the tap
// must replace what the box held, never land next to it or get selected away.
function selectAll(event: { currentTarget: HTMLInputElement }) {
  event.currentTarget.select();
}

function ClockFace({
  value,
  ariaLabel,
  fallbackMeridiem = "AM",
  onCommit,
  onFocusChange,
}: {
  value: string;
  ariaLabel: string;
  /** AM or PM an empty box starts on, so an end typed after a 3 PM start reads PM. */
  fallbackMeridiem?: ClockMeridiem;
  onCommit: (raw: string) => void;
  onFocusChange?: (focused: boolean) => void;
}) {
  function partsFor(raw: string): ClockParts {
    const parsed = clockPartsFromRaw(raw);
    return parsed.hour ? parsed : { ...parsed, meridiem: fallbackMeridiem };
  }
  const [seen, setSeen] = useState(value);
  const [parts, setParts] = useState<ClockParts>(() => partsFor(value));
  const minuteRef = useRef<HTMLInputElement>(null);
  const focusedRef = useRef(0);
  const partsRef = useRef(parts);
  /** True from a tap until the first digit typed into that box, see nextClockDigits. */
  const freshHourRef = useRef(false);
  const freshMinuteRef = useRef(false);
  /** The raw time last handed to the parent, until the next render has checked what it kept. */
  const [pendingRaw, setPendingRaw] = useState<string | null>(null);

  if (value !== seen) {
    setSeen(value);
    setParts(partsFor(value));
  } else if (pendingRaw !== null && value !== pendingRaw) {
    // The parent kept a different time (a start typed away stays as saved), so its
    // value never changed and the digits must be re-read from it.
    setParts(partsFor(value));
  }
  if (pendingRaw !== null) setPendingRaw(null);

  useEffect(() => {
    partsRef.current = parts;
  }, [parts]);

  function finishIfIdle(next: ClockParts) {
    const committed = normalizeClockEntry(next);
    partsRef.current = committed;
    setParts(committed);
    const raw = rawFromClockParts(committed);
    setPendingRaw(raw);
    onCommit(raw);
  }

  function handleFocus() {
    focusedRef.current += 1;
    onFocusChange?.(true);
  }

  function handleBlur() {
    focusedRef.current = Math.max(0, focusedRef.current - 1);
    onFocusChange?.(false);
    requestAnimationFrame(() => {
      if (focusedRef.current === 0) finishIfIdle(partsRef.current);
    });
  }

  function setHour(raw: string) {
    const hour = nextClockDigits(partsRef.current.hour, raw, 2, freshHourRef.current);
    freshHourRef.current = false;
    setParts((prev) => {
      const next = { ...prev, hour };
      partsRef.current = next;
      return next;
    });
    if (hour.length === 2) minuteRef.current?.focus();
  }

  function setMinute(raw: string) {
    const minute = nextClockDigits(partsRef.current.minute, raw, 2, freshMinuteRef.current);
    freshMinuteRef.current = false;
    setParts((prev) => {
      const next = { ...prev, minute };
      partsRef.current = next;
      return next;
    });
  }

  function chooseMeridiem(next: ClockMeridiem) {
    const chosen = { ...partsRef.current, meridiem: next };
    partsRef.current = chosen;
    setParts(chosen);
  }

  // The open picker counts as focus here too: while it is up, nothing commits and the
  // row stays where it is. Closing it (a pick or a cancel) commits once, like a blur.
  function handlePickerOpenChange(open: boolean) {
    if (open) handleFocus();
    else handleBlur();
  }

  return (
    <div className="inline-flex items-center gap-0.5" role="group" aria-label={ariaLabel}>
      <input
        aria-label={`${ariaLabel} hour`}
        inputMode="numeric"
        pattern="[0-9]*"
        enterKeyHint="next"
        autoCorrect="off"
        spellCheck={false}
        value={parts.hour}
        placeholder="—"
        onFocus={(event) => {
          handleFocus();
          freshHourRef.current = true;
          selectAll(event);
        }}
        onClick={selectAll}
        onChange={(event) => setHour(event.target.value)}
        onBlur={handleBlur}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === ":") {
            event.preventDefault();
            minuteRef.current?.focus();
          }
        }}
        className="w-[1.6rem] border-0 bg-transparent p-0 text-center text-xs font-semibold tabular-nums text-[var(--accent)] outline-none placeholder:text-muted"
      />
      <span aria-hidden="true" className="select-none text-xs font-semibold text-[var(--accent)]">
        :
      </span>
      <input
        ref={minuteRef}
        aria-label={`${ariaLabel} minutes`}
        inputMode="numeric"
        pattern="[0-9]*"
        enterKeyHint="done"
        autoCorrect="off"
        spellCheck={false}
        value={parts.minute}
        placeholder="——"
        onFocus={(event) => {
          handleFocus();
          freshMinuteRef.current = true;
          selectAll(event);
        }}
        onClick={selectAll}
        onChange={(event) => setMinute(event.target.value)}
        onBlur={handleBlur}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className="w-[1.7rem] border-0 bg-transparent p-0 text-center text-xs font-semibold tabular-nums text-[var(--accent)] outline-none placeholder:text-muted"
      />
      <MeridiemPicker
        value={parts.meridiem}
        ariaLabel={ariaLabel}
        onChoose={chooseMeridiem}
        onOpenChange={handlePickerOpenChange}
      />
    </div>
  );
}

function MeridiemPicker({
  value,
  ariaLabel,
  onChoose,
  onOpenChange,
}: {
  value: ClockMeridiem;
  ariaLabel: string;
  onChoose: (next: ClockMeridiem) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  /**
   * True while the gesture that opened the picker (its pointerdown) still owes a click.
   * That click reaches the AM/PM button, or, on a phone, the cancel overlay that has
   * appeared under the finger by then; either way it must not close what it just opened.
   */
  const gestureClickRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    if (!open) return;
    setOpen(false);
    onOpenChange?.(false);
  }

  function openPicker() {
    setOpen(true);
    onOpenChange?.(true);
  }

  function pick(next: ClockMeridiem) {
    onChoose(next);
    close();
  }

  return (
    <div className="relative ml-0.5">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${ariaLabel} ${value}. Tap to choose AM or PM`}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          gestureClickRef.current = false;
          if (open) return;
          // Open before the hour or minute box loses focus: its blur would otherwise
          // commit the typed time, re-sort the rows, and move this button out from
          // under the tap, which then lands on nothing or on another moment.
          gestureClickRef.current = true;
          openPicker();
        }}
        onClick={() => {
          if (gestureClickRef.current) {
            gestureClickRef.current = false;
            return;
          }
          if (open) close();
          else openPicker();
        }}
        className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--accent)] ring-1 ring-[var(--line)]"
      >
        {value}
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-label="Cancel AM or PM"
            className="fixed inset-0 z-40 cursor-default bg-black/10"
            onPointerDown={() => {
              gestureClickRef.current = false;
            }}
            onClick={() => {
              if (gestureClickRef.current) {
                gestureClickRef.current = false;
                return;
              }
              close();
            }}
          />
          <div
            role="dialog"
            aria-label="Choose AM or PM"
            className="absolute left-1/2 top-full z-50 mt-2 w-max -translate-x-1/2 rounded-2xl border border-line bg-[var(--bg-elevated)] p-2 shadow-[var(--shadow)]"
          >
            <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
              Confirm
            </p>
            <div className="flex gap-2">
              {(["AM", "PM"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => pick(option)}
                  className={`min-w-[3.5rem] rounded-xl px-3 py-2.5 text-sm font-semibold ${
                    option === value
                      ? "bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-[var(--accent)]"
                      : "bg-[var(--bg)] text-ink ring-1 ring-[var(--line)]"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function DayTimeRange({
  startAt,
  endAt,
  onCommit,
  onOpenChange,
}: {
  startAt: string;
  endAt: string;
  placeholder?: string;
  onCommit: (next: { startAt?: string; endAt?: string }) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const focusedRef = useRef(0);

  function handleFocusChange(focused: boolean) {
    focusedRef.current = Math.max(0, focusedRef.current + (focused ? 1 : -1));
    onOpenChange?.(focusedRef.current > 0);
  }

  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-h-9 flex-wrap items-center gap-1">
        <ClockFace
          ariaLabel="Start time"
          value={startAt}
          onCommit={(raw) => onCommit({ startAt: raw })}
          onFocusChange={handleFocusChange}
        />
        <span className="text-xs text-muted">–</span>
        <ClockFace
          ariaLabel="End time"
          value={endAt}
          fallbackMeridiem={clockPartsFromRaw(startAt).hour ? clockPartsFromRaw(startAt).meridiem : "AM"}
          onCommit={(raw) => onCommit({ endAt: raw })}
          onFocusChange={handleFocusChange}
        />
      </div>
    </div>
  );
}
