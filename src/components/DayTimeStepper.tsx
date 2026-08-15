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

function toClock(hour12: number, minute: number, pm: boolean) {
  const hour24 = (hour12 % 12) + (pm ? 12 : 0);
  return formatClock(hour24 * 60 + minute);
}

function rangeLabel(startAt: string, endAt: string, placeholder: string) {
  const start = startAt.trim();
  const end = endAt.trim();
  if (!start && !end) return placeholder;
  if (start && end) return `${start} – ${end}`;
  return start || end;
}

export function DayTimeRange({
  startAt,
  endAt,
  placeholder = "Set time",
  onCommit,
  onOpenChange,
}: {
  startAt: string;
  endAt: string;
  placeholder?: string;
  onCommit: (next: { startAt?: string; endAt?: string }) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const startParts = partsFromValue(startAt);
  const endParts = partsFromValue(endAt || startAt);
  const [startHour, setStartHour] = useState(startParts.hour12);
  const [startMinute, setStartMinute] = useState(startParts.minute);
  const [startPm, setStartPm] = useState(startParts.pm);
  const [endHour, setEndHour] = useState(endParts.hour12);
  const [endMinute, setEndMinute] = useState(endParts.minute);
  const [endPm, setEndPm] = useState(endParts.pm);
  const [hasEnd, setHasEnd] = useState(Boolean(endAt.trim()));

  function setOpenSafe(next: boolean) {
    if (next) {
      const start = partsFromValue(startAt);
      const end = partsFromValue(endAt || startAt);
      setStartHour(start.hour12);
      setStartMinute(start.minute);
      setStartPm(start.pm);
      setEndHour(end.hour12);
      setEndMinute(end.minute);
      setEndPm(end.pm);
      setHasEnd(Boolean(endAt.trim()));
    }
    setOpen(next);
    onOpenChange?.(next);
  }

  function commit() {
    onCommit({
      startAt: toClock(startHour, startMinute, startPm),
      endAt: hasEnd ? toClock(endHour, endMinute, endPm) : "",
    });
    setOpenSafe(false);
  }

  const needsMeridiem = missingMeridiem(startAt) || missingMeridiem(endAt);

  return (
    <div className="min-w-0 flex-1">
      <button
        type="button"
        onClick={() => setOpenSafe(!open)}
        className="flex min-h-9 w-full items-center rounded-lg px-0 py-1 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]"
      >
        {rangeLabel(startAt, endAt, placeholder)}
      </button>
      {needsMeridiem && !open ? (
        <p className="text-[11px] font-semibold text-[var(--warn)]">Add AM/PM</p>
      ) : null}

      {open ? (
        <div className="mt-1 rounded-xl border border-line bg-[var(--bg)] p-2">
          <CompactClock
            label="Start"
            hour12={startHour}
            minute={startMinute}
            pm={startPm}
            onHour={setStartHour}
            onMinute={setStartMinute}
            onPm={setStartPm}
          />
          {hasEnd ? (
            <CompactClock
              label="End"
              hour12={endHour}
              minute={endMinute}
              pm={endPm}
              onHour={setEndHour}
              onMinute={setEndMinute}
              onPm={setEndPm}
            />
          ) : null}
          <div className="mt-1 flex flex-wrap gap-1">
            {QUARTERS.map((q) => (
              <button
                key={q}
                type="button"
                className="min-h-8 rounded-full border border-line px-2 text-[11px] font-semibold"
                onClick={() => {
                  setStartMinute(q);
                  if (hasEnd) setEndMinute(q);
                }}
              >
                :{String(q).padStart(2, "0")}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <button
              type="button"
              className="min-h-8 rounded-full border border-line px-2.5 text-[11px] font-semibold"
              onClick={() => setHasEnd((value) => !value)}
            >
              {hasEnd ? "No end" : "Add end"}
            </button>
            <button
              type="button"
              className="min-h-8 rounded-full border border-line px-2.5 text-[11px] font-semibold"
              onClick={() => {
                onCommit({ startAt: "TBD", endAt: "" });
                setOpenSafe(false);
              }}
            >
              TBD
            </button>
            <button
              type="button"
              className="ml-auto min-h-8 rounded-full bg-[var(--accent)] px-3 text-[11px] font-semibold text-white"
              onClick={commit}
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CompactClock({
  label,
  hour12,
  minute,
  pm,
  onHour,
  onMinute,
  onPm,
}: {
  label: string;
  hour12: number;
  minute: number;
  pm: boolean;
  onHour: (value: number) => void;
  onMinute: (value: number) => void;
  onPm: (value: boolean) => void;
}) {
  return (
    <div className="mb-1 flex items-center gap-1">
      <span className="w-9 shrink-0 text-[11px] text-muted">{label}</span>
      <TinyStep value={String(hour12)} onDown={() => onHour(wrapHour(hour12 - 1))} onUp={() => onHour(wrapHour(hour12 + 1))} />
      <span className="text-muted">:</span>
      <TinyStep
        value={String(minute).padStart(2, "0")}
        onDown={() => onMinute(wrapMinute(minute - 1))}
        onUp={() => onMinute(wrapMinute(minute + 1))}
      />
      <button
        type="button"
        className={`min-h-8 rounded-md px-2 text-[11px] font-semibold ${
          !pm ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-muted"
        }`}
        onClick={() => onPm(false)}
      >
        AM
      </button>
      <button
        type="button"
        className={`min-h-8 rounded-md px-2 text-[11px] font-semibold ${
          pm ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-muted"
        }`}
        onClick={() => onPm(true)}
      >
        PM
      </button>
    </div>
  );
}

function TinyStep({
  value,
  onDown,
  onUp,
}: {
  value: string;
  onDown: () => void;
  onUp: () => void;
}) {
  return (
    <span className="inline-flex items-center rounded-md border border-line">
      <button type="button" className="min-h-8 w-7 text-sm font-semibold" onClick={onDown}>
        −
      </button>
      <span className="min-w-6 text-center text-sm font-semibold">{value}</span>
      <button type="button" className="min-h-8 w-7 text-sm font-semibold" onClick={onUp}>
        +
      </button>
    </span>
  );
}
