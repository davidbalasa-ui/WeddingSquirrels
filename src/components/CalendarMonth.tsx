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
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { saveCalendarEvent } from "@/app/actions";

export type PlanCalendarEventView = {
  id: string;
  title: string;
  notes: string | null;
  location: string | null;
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

function CalendarEventCard({
  event,
  canEdit,
}: {
  event: PlanCalendarEventView;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const { start, end } = eventRange(event);
  const span =
    start.getTime() !== end.getTime()
      ? `${format(start, "MMM d")}–${format(end, "MMM d")}`
      : null;
  const startValue = format(start, "yyyy-MM-dd");
  const endValue = format(end, "yyyy-MM-dd");

  if (!editing || !canEdit) {
    return (
      <article className="py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-[family-name:var(--font-display)] text-xl leading-tight">{event.title}</p>
            {span ? <p className="mt-1 text-sm text-muted">{span}</p> : null}
            {event.location ? <p className="mt-1 text-sm text-muted">{event.location}</p> : null}
            {event.notes ? <p className="mt-1 text-sm leading-relaxed text-muted">{event.notes}</p> : null}
          </div>
          {canEdit ? (
            <button
              type="button"
              className="shrink-0 text-xs font-semibold text-[var(--accent)]"
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article className="py-4">
      <form
        className="flex flex-col gap-2"
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
          const form = submitEvent.currentTarget;
          const formData = new FormData(form);
          startTransition(async () => {
            const result = await saveCalendarEvent({
              id: event.id,
              title: String(formData.get("title") || ""),
              location: String(formData.get("location") || ""),
              notes: String(formData.get("notes") || ""),
              startDate: String(formData.get("startDate") || ""),
              endDate: String(formData.get("endDate") || ""),
            });
            if (result.ok) {
              setEditing(false);
              router.refresh();
            }
          });
        }}
      >
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted">Title</span>
          <input name="title" required defaultValue={event.title} className="field-input" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted">Starts</span>
            <input name="startDate" type="date" required defaultValue={startValue} className="field-input" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted">Ends</span>
            <input name="endDate" type="date" required defaultValue={endValue} className="field-input" />
          </label>
        </div>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted">Location</span>
          <input name="location" defaultValue={event.location ?? ""} className="field-input" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted">Notes</span>
          <textarea name="notes" rows={2} defaultValue={event.notes ?? ""} className="field-input resize-y" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Saving…" : "Save event"}
          </button>
          <button type="button" className="btn-secondary" disabled={pending} onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      </form>
    </article>
  );
}

export function CalendarMonth({
  events,
  initialMonth,
  canEdit = false,
}: {
  events: PlanCalendarEventView[];
  initialMonth: string;
  canEdit?: boolean;
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
            selectedEvents.map((event) => <CalendarEventCard key={event.id} event={event} canEdit={canEdit} />)
          )}
        </div>
      </section>
    </div>
  );
}
