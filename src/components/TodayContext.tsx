import Link from "next/link";
import type { TodayContextItem } from "@/lib/today";

export function TodayContext({
  items,
  title = "Today",
  empty,
}: {
  items: TodayContextItem[];
  title?: string;
  empty?: { title: string; support: string } | null;
}) {
  if (items.length === 0 && !empty) return null;

  return (
    <section className="mb-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{title}</p>
      {items.length === 0 && empty ? (
        <div className="mt-3">
          <p className="text-[1.05rem] font-semibold leading-snug">{empty.title}</p>
          <p className="mt-1 text-sm text-muted">{empty.support}</p>
        </div>
      ) : null}
      {items.length > 0 ? (
      <div className="mt-1 divide-y divide-[var(--line)] border-b border-t border-[var(--line)]">
        {items.map((item) => {
          const row = (
            <div className="flex min-h-14 items-start gap-3 py-3.5">
              {item.timeLabel ? (
                <p className="w-[4.5rem] shrink-0 text-sm font-semibold text-[var(--accent)]">
                  {item.timeLabel}
                </p>
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="text-[1.05rem] font-semibold leading-snug">{item.title}</p>
                {item.context ? <p className="mt-1 text-sm text-muted">{item.context}</p> : null}
              </div>
            </div>
          );

          if (item.href) {
            return (
              <Link
                key={item.id}
                href={item.href}
                className="block transition-colors hover:bg-[var(--accent-soft)]/25"
              >
                {row}
              </Link>
            );
          }

          return <div key={item.id}>{row}</div>;
        })}
      </div>
      ) : null}
    </section>
  );
}
