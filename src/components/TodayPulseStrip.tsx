import Link from "next/link";
import type { TodayPulseStat } from "@/lib/today";

export function TodayPulseStrip({ stats }: { stats: TodayPulseStat[] }) {
  if (stats.length === 0) return null;

  return (
    <section className="mb-5">
      <p className="pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Pulse</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.id}
            href={stat.href}
            className="card flex min-h-[4.5rem] flex-col justify-center px-3 py-2 transition-colors hover:bg-[var(--accent-soft)]/40"
          >
            <p className="font-[family-name:var(--font-display)] text-xl leading-none text-[var(--accent)]">
              {stat.value}
            </p>
            <p className="mt-1 text-xs font-semibold text-muted">{stat.label}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
