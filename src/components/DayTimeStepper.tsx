"use client";

import { useState } from "react";
import { formatClock, missingMeridiem, parseDayOfTime } from "@/lib/day-of-time";

const QUARTERS = [0, 15, 30, 45];

function partsFromValue(value: string): { hour12: number; minute: number; pm: boolean } {
  const parsed = parseDayOfTime(value);
  if (parsed.kind === "timed") {
    const hour24 = Math.floor(parsed.minutes / 60);
    return {
      hour12: hour24 % 12 === 0 ? 12 : hour24 % 12,
      minute: parsed.minutes % 60,
      pm: hour24 >= 12,
    };
  }
  return { hour12: 3, minute: 0, pm: true };
}

function wrapHour(hour: number) {
  if (hour < 1) return 12;
  if (hour > 12) return 1;
  return hour;
}

function wrapMinute(minute: number) {
  if (minute < 0) return 59;
  if (minute > 59) return 0;
  return minute;
}

export function DayTimeStepper({
  label,
  value,
  placeholder,
  onCommit,
  onOpenChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onCommit: (next: string) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hour12, setHour12] = useState(3);
  const [minute, setMinute] = useState(0);
  const [pm, setPm] = useState(true);

  function setOpenSafe(next: boolean) {
    if (next) {
      const parts = partsFromValue(value);
      setHour12(parts.hour12);
      setMinute(parts.minute);
      setPm(parts.pm);
    }
    setOpen(next);
    onOpenChange?.(next);
  }

  function commitClock() {
    const hour24 = (hour12 % 12) + (pm ? 12 : 0);
    onCommit(formatClock(hour24 * 60 + minute));
    setOpenSafe(false);
  }

  const display = value.trim() || placeholder;
  const needsMeridiem = missingMeridiem(value);

  return (
    <div className="text-sm">
      <p className="mb-1 text-xs text-muted">{label}</p>
      <button
        type="button"
        onClick={() => setOpenSafe(!open)}
        className="flex min-h-12 w-full items-center justify-between rounded-xl border border-line px-3 py-2.5 text-left"
      >
        <span className={value.trim() ? "" : "text-muted"}>{display}</span>
        <span className="text-xs font-semibold text-[var(--accent)]">{open ? "Close" : "Set"}</span>
      </button>
      {needsMeridiem && !open ? (
        <p className="mt-1 text-xs font-semibold text-[var(--warn)]">Add AM/PM</p>
      ) : null}

      {open ? (
        <div className="mt-2 rounded-2xl border border-line bg-[var(--bg)] p-3">
          <div className="grid grid-cols-3 gap-2">
            <StepperColumn
              label="Hour"
              value={String(hour12)}
              onDown={() => setHour12((h) => wrapHour(h - 1))}
              onUp={() => setHour12((h) => wrapHour(h + 1))}
            />
            <StepperColumn
              label="Min"
              value={String(minute).padStart(2, "0")}
              onDown={() => setMinute((m) => wrapMinute(m - 1))}
              onUp={() => setMinute((m) => wrapMinute(m + 1))}
            />
            <div className="flex flex-col gap-1">
              <span className="text-center text-[11px] text-muted">AM/PM</span>
              <button
                type="button"
                className={`min-h-11 rounded-xl text-sm font-semibold ${
                  !pm ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "border border-line text-muted"
                }`}
                onClick={() => setPm(false)}
              >
                AM
              </button>
              <button
                type="button"
                className={`min-h-11 rounded-xl text-sm font-semibold ${
                  pm ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "border border-line text-muted"
                }`}
                onClick={() => setPm(true)}
              >
                PM
              </button>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {QUARTERS.map((q) => (
              <button
                key={q}
                type="button"
                className="min-h-10 rounded-full border border-line px-3 text-xs font-semibold"
                onClick={() => setMinute(q)}
              >
                :{String(q).padStart(2, "0")}
              </button>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                onCommit("TBD");
                setOpenSafe(false);
              }}
            >
              TBD
            </button>
            <button type="button" className="btn-primary" onClick={commitClock}>
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StepperColumn({
  label,
  value,
  onDown,
  onUp,
}: {
  label: string;
  value: string;
  onDown: () => void;
  onUp: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[11px] text-muted">{label}</span>
      <button type="button" className="min-h-11 w-full rounded-xl border border-line text-lg font-semibold" onClick={onUp}>
        +
      </button>
      <p className="font-[family-name:var(--font-display)] text-2xl leading-none">{value}</p>
      <button type="button" className="min-h-11 w-full rounded-xl border border-line text-lg font-semibold" onClick={onDown}>
        −
      </button>
    </div>
  );
}
