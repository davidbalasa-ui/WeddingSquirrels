import Link from "next/link";
import type { TodayTimelinePreview } from "@/lib/today";

export function TodayWeddingWeek({ items }: { items: TodayTimelinePreview[] }) {
  if (items.length === 0) return null;

  return (
    <section className="mb-5">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Wedding week</p>
        <Link href="/day" className="text-xs font-semibold text-[var(--accent)]">
          Wedding day
        </Link>
      </div>
      <div className="divide-y divide-[var(--line)] border-t border-line">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-3 py-2.5">
            <p className="w-16 shrink-0 text-sm font-semibold text-[var(--accent)]">{item.startAt}</p>
            <div className="min-w-0 flex-1">
              {item.isNext ? (
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--gold)]">
                  Up next
                </p>
              ) : null}
              <p className="text-[15px] font-semibold leading-snug">{item.title}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
