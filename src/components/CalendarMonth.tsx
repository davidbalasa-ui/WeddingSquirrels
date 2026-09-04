"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { useMemo, useState } from "react";

export type PlanCalendarEventView = {
  id: string;
  title: string;
  notes: string | null;
  startDate: string;
  endDate: string;
  color: string;
  eventKey: string | null;
};

function dayKey(day: Date) {
  return format(day, "yyyy-MM-dd");
}

function eventRange(event: PlanCalendarEventView) {
  return {
    start: startOfDay(new Date(event.startDate)),
    end: startOfDay(new Date(event.endDate)),
  };
}

export function CalendarMonth({
  events,
  initialMonth,
}: {
  events: PlanCalendarEventView[];
  initialMonth: string;
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date(initialMonth)));
  const [selected, setSelected] = useState(() => startOfDay(new Date()));

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start, end });
  }, [month]);

  const eventsForDay = (day: Date) =>
    events.filter((event) => {
      const { start, end } = eventRange(event);
      if (end < start) return isSameDay(day, start);
      return isWithinInterval(day, { start, end });
    });

  const selectedEvents = eventsForDay(selected);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            className="min-h-11 min-w-11 rounded-full text-lg font-semibold text-muted"
            onClick={() => setMonth((current) => subMonths(current, 1))}
            aria-label="Previous month"
          >
            ‹
          </button>
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-tight">
            {format(month, "MMMM yyyy")}
          </h2>
          <button
            type="button"
            className="min-h-11 min-w-11 rounded-full text-lg font-semibold text-muted"
            onClick={() => setMonth((current) => addMonths(current, 1))}
            aria-label="Next month"
          >
            ›
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
            <div key={label}>{label}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day) => {
            const inMonth = isSameMonth(day, month);
            const isSelected = isSameDay(day, selected);
            const isToday = isSameDay(day, new Date());
            const dayEvents = eventsForDay(day);

            return (
              <button
                key={dayKey(day)}
                type="button"
                onClick={() => setSelected(startOfDay(day))}
                className="relative flex min-h-12 flex-col items-center px-0.5 py-1.5 text-center"
                style={{
                  opacity: inMonth ? 1 : 0.35,
                  background: isSelected
                    ? "var(--accent-soft)"
                    : isToday
                      ? "color-mix(in srgb, var(--bg) 70%, var(--accent-soft))"
                      : "transparent",
                }}
              >
                <span
                  className="text-sm font-semibold"
                  style={{ color: isSelected ? "var(--accent)" : "var(--ink)" }}
                >
                  {format(day, "d")}
                </span>
                {dayEvents.length > 0 ? (
                  <span className="mt-1 flex max-w-full justify-center gap-0.5">
                    {dayEvents.slice(0, 3).map((event) => (
                      <span
                        key={event.id}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: event.color || "var(--accent)" }}
                        title={event.title}
                      />
                    ))}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <section>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          {format(selected, "EEEE, MMMM d")}
        </p>
        <div className="mt-1 divide-y divide-[var(--line)] border-b border-t border-[var(--line)]">
          {selectedEvents.length === 0 ? (
            <p className="py-4 text-sm text-muted">Nothing on this day.</p>
          ) : (
            selectedEvents.map((event) => {
              const { start, end } = eventRange(event);
              const span =
                start.getTime() !== end.getTime()
                  ? `${format(start, "MMM d")}–${format(end, "MMM d")}`
                  : null;
              return (
                <article key={event.id} className="py-4">
                  <p className="font-[family-name:var(--font-display)] text-xl leading-tight">
                    {event.title}
                  </p>
                  {span ? <p className="mt-1 text-sm text-muted">{span}</p> : null}
                  {event.notes ? <p className="mt-1 text-sm leading-relaxed text-muted">{event.notes}</p> : null}
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
