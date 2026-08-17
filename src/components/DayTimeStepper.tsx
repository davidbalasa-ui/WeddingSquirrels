"use client";

import { useEffect, useRef, useState } from "react";
import {
  clockPartsFromRaw,
  normalizeClockHour,
  normalizeClockMinute,
  rawFromClockParts,
  sanitizeClockDigits,
  type ClockMeridiem,
  type ClockParts,
} from "@/lib/day-of-time";

function selectAll(event: { currentTarget: HTMLInputElement }) {
  const input = event.currentTarget;
  requestAnimationFrame(() => input.select());
}

function ClockFace({
  value,
  ariaLabel,
  onCommit,
  onFocusChange,
}: {
  value: string;
  ariaLabel: string;
  onCommit: (raw: string) => void;
  onFocusChange?: (focused: boolean) => void;
}) {
  const [seen, setSeen] = useState(value);
  const [parts, setParts] = useState<ClockParts>(() => clockPartsFromRaw(value));
  const minuteRef = useRef<HTMLInputElement>(null);
  const focusedRef = useRef(0);
  const partsRef = useRef(parts);

  if (value !== seen) {
    setSeen(value);
    setParts(clockPartsFromRaw(value));
  }

  useEffect(() => {
    partsRef.current = parts;
  }, [parts]);

  function finishIfIdle(next: ClockParts) {
    const hour = normalizeClockHour(next.hour);
    const minute = hour ? normalizeClockMinute(next.minute) : "";
    const committed = { ...next, hour, minute };
    partsRef.current = committed;
    setParts(committed);
    onCommit(rawFromClockParts(committed));
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
    const hour = sanitizeClockDigits(raw, 2);
    setParts((prev) => {
      const next = { ...prev, hour };
      partsRef.current = next;
      return next;
    });
    if (hour.length === 2) minuteRef.current?.focus();
  }

  function setMinute(raw: string) {
    setParts((prev) => {
      const next = { ...prev, minute: sanitizeClockDigits(raw, 2) };
      partsRef.current = next;
      return next;
    });
  }

  function chooseMeridiem(next: ClockMeridiem) {
    finishIfIdle({
      ...partsRef.current,
      meridiem: next,
    });
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
        onOpenChange={onFocusChange}
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
        onClick={() => (open ? close() : openPicker())}
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
            onClick={close}
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
          onCommit={(raw) => onCommit({ endAt: raw })}
          onFocusChange={handleFocusChange}
        />
      </div>
    </div>
  );
}
