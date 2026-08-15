"use client";

import { useEffect, useRef, useState } from "react";
import { missingMeridiem } from "@/lib/day-of-time";

function selectAll(event: { currentTarget: HTMLInputElement }) {
  const input = event.currentTarget;
  requestAnimationFrame(() => input.select());
}

function TimeInput({
  value,
  placeholder,
  ariaLabel,
  onChange,
  onFocusChange,
  onCommit,
}: {
  value: string;
  placeholder: string;
  ariaLabel: string;
  onChange: (value: string) => void;
  onFocusChange?: (focused: boolean) => void;
  onCommit: () => void;
}) {
  return (
    <input
      aria-label={ariaLabel}
      value={value}
      placeholder={placeholder}
      inputMode="text"
      enterKeyHint="done"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      onFocus={(event) => {
        onFocusChange?.(true);
        selectAll(event);
      }}
      onClick={selectAll}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => {
        onFocusChange?.(false);
        onCommit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      className="min-w-0 border-0 bg-transparent p-0 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)] outline-none placeholder:text-muted"
      size={Math.max(value.trim().length, placeholder.length, 8)}
    />
  );
}

export function DayTimeRange({
  startAt,
  endAt,
  placeholder = "Time",
  onCommit,
  onOpenChange,
}: {
  startAt: string;
  endAt: string;
  placeholder?: string;
  onCommit: (next: { startAt?: string; endAt?: string }) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const [start, setStart] = useState(startAt);
  const [end, setEnd] = useState(endAt);
  const focusedRef = useRef(0);

  useEffect(() => {
    if (focusedRef.current > 0) return;
    setStart(startAt);
    setEnd(endAt);
  }, [startAt, endAt]);

  function handleFocusChange(focused: boolean) {
    focusedRef.current = Math.max(0, focusedRef.current + (focused ? 1 : -1));
    onOpenChange?.(focusedRef.current > 0);
  }

  function commit() {
    onCommit({ startAt: start, endAt: end });
  }

  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-h-9 items-center gap-1">
        <TimeInput
          ariaLabel="Start time"
          value={start}
          placeholder={placeholder}
          onChange={setStart}
          onFocusChange={handleFocusChange}
          onCommit={commit}
        />
        <span className="text-xs text-muted">–</span>
        <TimeInput
          ariaLabel="End time"
          value={end}
          placeholder="end"
          onChange={setEnd}
          onFocusChange={handleFocusChange}
          onCommit={commit}
        />
      </div>
      {missingMeridiem(start) || missingMeridiem(end) ? (
        <p className="text-[11px] font-semibold text-[var(--warn)]">Add AM/PM</p>
      ) : null}
    </div>
  );
}
