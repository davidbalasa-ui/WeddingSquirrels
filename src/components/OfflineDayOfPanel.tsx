"use client";

import { differenceInCalendarDays, startOfDay } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { DayNowNext } from "@/components/DayNowNext";
import { buildDayNowNextSnapshot } from "@/lib/day-of-now";
import { parsedTimeFields } from "@/lib/day-of-time";
import type { OfflinePack } from "@/lib/offline-db";

type TimelineRow = {
  id: string;
  schedule: string;
  startAt: string;
  endAt: string | null;
  notes: string;
  startMinutes?: number | null;
  endMinutes?: number | null;
  dayOffset?: number;
  sortOrder?: number;
};

type ContactRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  photoData: string | null;
};

type PersonRow = { id: string; name: string };

function toTimelineInput(block: TimelineRow) {
  const parsed = parsedTimeFields(block.startAt, block.endAt);
  return {
    id: block.id,
    startAt: block.startAt,
    endAt: block.endAt,
    notes: block.notes,
    startMinutes: block.startMinutes ?? parsed.startMinutes,
    endMinutes: block.endMinutes ?? parsed.endMinutes,
    dayOffset: block.dayOffset ?? parsed.dayOffset,
    sortOrder: block.sortOrder ?? 0,
  };
}

export function OfflineDayOfPanel({
  pack,
  onAllContacts,
}: {
  pack: OfflinePack;
  onAllContacts: () => void;
}) {
  const blocks = (pack.timeline ?? []) as TimelineRow[];
  const contacts = (pack.contacts ?? []) as ContactRow[];
  const people = (pack.people ?? []) as PersonRow[];
  const weddingBlocks = useMemo(
    () => blocks.filter((block) => block.schedule !== "rehearsal").map(toTimelineInput),
    [blocks],
  );
  const rehearsalBlocks = useMemo(
    () => blocks.filter((block) => block.schedule === "rehearsal"),
    [blocks],
  );
  const daysToGo = pack.weddingDate
    ? differenceInCalendarDays(new Date(pack.weddingDate), startOfDay(new Date()))
    : null;

  const liveSource = useMemo(
    () => ({
      blocks: weddingBlocks,
      contacts,
      people,
      daysToGo,
    }),
    [weddingBlocks, contacts, people, daysToGo],
  );

  const initialSnapshot = useMemo(
    () => buildDayNowNextSnapshot(liveSource.blocks, liveSource.contacts, liveSource.people, { daysToGo }),
    [liveSource, daysToGo],
  );

  const [mode, setMode] = useState<"now" | "full">("now");

  useEffect(() => {
    if (weddingBlocks.length === 0) setMode("full");
  }, [weddingBlocks.length]);

  if (weddingBlocks.length === 0) {
    return <OfflineTimelineList blocks={rehearsalBlocks} title="Rehearsal" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="filter-pill rounded-full border px-3.5 py-2 text-sm font-semibold"
          data-active={mode === "now"}
          aria-pressed={mode === "now"}
          style={
            mode === "now"
              ? {
                  borderColor: "var(--accent)",
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                }
              : undefined
          }
          onClick={() => setMode("now")}
        >
          Now / Next
        </button>
        <button
          type="button"
          className="filter-pill rounded-full border px-3.5 py-2 text-sm font-semibold"
          data-active={mode === "full"}
          aria-pressed={mode === "full"}
          style={
            mode === "full"
              ? {
                  borderColor: "var(--accent)",
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                }
              : undefined
          }
          onClick={() => setMode("full")}
        >
          Full timeline
        </button>
      </div>

      {mode === "now" ? (
        <DayNowNext
          snapshot={initialSnapshot}
          liveSource={liveSource}
          canEdit={false}
          offline
          onAllContacts={onAllContacts}
        />
      ) : (
        <>
          <OfflineTimelineList blocks={weddingBlocks.map((block) => ({
            id: block.id,
            schedule: "wedding",
            startAt: block.startAt,
            endAt: block.endAt,
            notes: block.notes,
          }))} title="Wedding day" />
          {rehearsalBlocks.length > 0 ? (
            <OfflineTimelineList blocks={rehearsalBlocks} title="Rehearsal" />
          ) : null}
        </>
      )}
    </div>
  );
}

function OfflineTimelineList({ blocks, title }: { blocks: TimelineRow[]; title: string }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{title}</p>
      {blocks.map((block) => {
        const [headline, ...details] = block.notes.split("\n").filter((line) => line.trim());
        return (
          <article key={block.id} className="card p-4">
            <div className="flex items-baseline gap-2">
              <p className="shrink-0 text-sm font-bold text-[var(--accent)]">{block.startAt}</p>
              {block.endAt ? <p className="shrink-0 text-sm text-muted">– {block.endAt}</p> : null}
            </div>
            <p className="mt-1 font-semibold leading-snug">{headline || block.notes}</p>
            {details.length > 0 ? (
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                {details.join("\n")}
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
