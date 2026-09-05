import Link from "next/link";
import type { TodayPulseStat } from "@/lib/today";

export function TodayPulseStrip({
  stats,
  compact = false,
}: {
  stats: TodayPulseStat[];
  compact?: boolean;
}) {
  if (stats.length === 0) return null;

  return (
    <section className={compact ? "mb-6" : "mb-8"}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
        {compact ? "Pulse" : "Wedding pulse"}
      </p>
      <div className={compact ? "mt-1 flex flex-col" : "mt-3 flex flex-col"}>
        {stats.map((stat, index) => (
          <Link
            key={stat.id}
            href={stat.href}
            className={`flex min-h-14 items-baseline justify-between gap-4 py-2.5 ${
              index === 0 ? "border-t border-[var(--line)]" : ""
            } border-b border-[var(--line)] transition-colors hover:bg-[var(--accent-soft)]/25`}
          >
            <span className="text-sm font-semibold uppercase tracking-[0.08em] text-muted">
              {stat.label}
            </span>
            <span className="text-right">
              <span className="font-[family-name:var(--font-display)] text-xl leading-none text-[var(--accent)]">
                {stat.value}
              </span>
              {stat.detail ? <span className="ml-2 text-xs text-muted">{stat.detail}</span> : null}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
