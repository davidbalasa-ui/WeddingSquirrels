import Link from "next/link";
import type { TodayComingUpItem } from "@/lib/today";

function formatComingUpDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TodayComingUpList({ items }: { items: TodayComingUpItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="mb-6">
      <p className="pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Coming up</p>
      <div className="divide-y divide-[var(--line)] border-t border-line">
        {items.map((item) => {
          const row = (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold leading-snug">{item.title}</p>
                {item.subtitle ? <p className="mt-0.5 text-sm text-muted">{item.subtitle}</p> : null}
              </div>
              <p className="shrink-0 text-sm font-semibold text-[var(--accent)]">
                {formatComingUpDate(item.date)}
              </p>
            </>
          );

          if (item.href) {
            return (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-start justify-between gap-3 py-2.5 transition-colors hover:bg-[var(--accent-soft)]/20"
              >
                {row}
              </Link>
            );
          }

          return (
            <div key={item.id} className="flex items-start justify-between gap-3 py-2.5">
              {row}
            </div>
          );
        })}
      </div>
    </section>
  );
}
