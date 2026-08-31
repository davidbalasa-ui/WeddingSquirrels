"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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

export type CalTask = {
  id: string;
  title: string;
  dueDate: string; // ISO
  status: string;
  orgKey: string | null;
  href: string;
};

export type CalEvent = {
  id: string;
  title: string;
  notes: string | null;
  startDate: string;
  endDate: string;
  color: string;
  eventKey: string | null;
};

function dayKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function CalendarMonth({
  tasks,
  events,
  initialMonth,
}: {
  tasks: CalTask[];
  events: CalEvent[];
  initialMonth: string; // yyyy-MM-01
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date(initialMonth)));
  const [selected, setSelected] = useState(() => startOfDay(new Date()));

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start, end });
  }, [month]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, CalTask[]>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const key = dayKey(startOfDay(new Date(task.dueDate)));
      const list = map.get(key) || [];
      list.push(task);
      map.set(key, list);
    }
    return map;
  }, [tasks]);

  const eventsForDay = (day: Date) =>
    events.filter((event) => {
      const start = startOfDay(new Date(event.startDate));
      const end = startOfDay(new Date(event.endDate));
      return isWithinInterval(day, { start, end });
    });

  const selectedKey = dayKey(selected);
  const selectedTasks = tasksByDay.get(selectedKey) || [];
  const selectedEvents = eventsForDay(selected);

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold text-muted"
            onClick={() => setMonth((m) => subMonths(m, 1))}
          >
            ‹
          </button>
          <h2 className="font-[family-name:var(--font-display)] text-xl">
            {format(month, "MMMM yyyy")}
          </h2>
          <button
            type="button"
            className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold text-muted"
            onClick={() => setMonth((m) => addMonths(m, 1))}
          >
            ›
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const key = dayKey(day);
            const inMonth = isSameMonth(day, month);
            const isSelected = isSameDay(day, selected);
            const isToday = isSameDay(day, new Date());
            const dayTasks = tasksByDay.get(key) || [];
            const dayEvents = eventsForDay(day);

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(startOfDay(day))}
                className="relative flex min-h-[52px] flex-col items-center rounded-xl border px-0.5 py-1 text-center"
                style={{
                  opacity: inMonth ? 1 : 0.35,
                  borderColor: isSelected ? "var(--accent)" : "transparent",
                  background: isSelected
                    ? "var(--accent-soft)"
                    : isToday
                      ? "color-mix(in srgb, var(--bg-elevated) 70%, var(--accent-soft))"
                      : "transparent",
                }}
              >
                <span
                  className="text-sm font-semibold"
                  style={{ color: isSelected ? "var(--accent)" : "var(--ink)" }}
                >
                  {format(day, "d")}
                </span>
                <div className="mt-1 flex max-w-full flex-wrap justify-center gap-0.5">
                  {dayEvents.slice(0, 2).map((event) => (
                    <span
                      key={event.id}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: event.color }}
                      title={event.title}
                    />
                  ))}
                  {dayTasks.slice(0, 3).map((task) => (
                    <span
                      key={task.id}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        background:
                          task.orgKey === "week_before"
                            ? "#c4b28a"
                            : task.orgKey === "day_before"
                              ? "#9bb7ae"
                              : task.status === "done"
                                ? "#9aa59f"
                                : "var(--accent)",
                      }}
                      title={task.title}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <section>
        <h3 className="mb-2 font-[family-name:var(--font-display)] text-xl">
          {format(selected, "EEEE, MMM d")}
        </h3>

        <div className="flex flex-col gap-3">
          {selectedEvents.map((event) => (
            <article
              key={event.id}
              className="card p-4"
              style={{ borderColor: event.color }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: event.color }}>
                Event
                {event.startDate !== event.endDate
                  ? ` · ${format(new Date(event.startDate), "MMM d")}–${format(new Date(event.endDate), "MMM d")}`
                  : ""}
              </p>
              <p className="mt-1 text-[15px] font-semibold">{event.title}</p>
              {event.notes ? <p className="mt-1 text-sm text-muted">{event.notes}</p> : null}
            </article>
          ))}

          {selectedTasks.map((task) => (
            <Link key={task.id} href={task.href} className="card block p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
                {task.orgKey === "week_before"
                  ? "Week before"
                  : task.orgKey === "day_before"
                    ? "Day before"
                    : task.status === "done"
                      ? "Done"
                      : "Task due"}
              </p>
              <p className="mt-1 text-[15px] font-semibold">{task.title}</p>
            </Link>
          ))}

          {selectedEvents.length === 0 && selectedTasks.length === 0 ? (
            <div className="card p-5 text-sm text-muted">Nothing scheduled this day.</div>
          ) : null}
        </div>
      </section>

      <section className="card p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Legend</p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: "#8a4b2a" }} /> Bachelorette
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: "#2f5d50" }} /> Bachelor / Wedding
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--accent)" }} /> Task due
          </span>
        </div>
      </section>
    </div>
  );
}
