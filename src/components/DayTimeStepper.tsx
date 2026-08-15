"use client";

import { useEffect, useRef, useState } from "react";
import {
  clockPartsFromRaw,
  normalizeClockHour,
  normalizeClockMinute,
  rawFromClockParts,
  sanitizeClockDigits,
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

  function toggleMeridiem() {
    finishIfIdle({
      ...partsRef.current,
      meridiem: partsRef.current.meridiem === "AM" ? "PM" : "AM",
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
      <button
        type="button"
        aria-label={`${ariaLabel} ${parts.meridiem}. Tap to switch`}
        onClick={toggleMeridiem}
        className="ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--accent)] ring-1 ring-[var(--line)]"
      >
        {parts.meridiem}
      </button>
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
