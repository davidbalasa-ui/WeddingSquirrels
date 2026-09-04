import Link from "next/link";
import type { PlanDomainSummary } from "@/lib/plan";

export function PlanDomainList({ rows }: { rows: PlanDomainSummary[] }) {
  if (rows.length === 0) {
    return (
      <p className="border-t border-[var(--line)] py-6 text-base text-muted">
        Nothing on the plan is visible for this PIN.
      </p>
    );
  }

  return (
    <nav aria-label="Wedding plan" className="divide-y divide-[var(--line)] border-b border-t border-[var(--line)]">
      {rows.map((row) => (
        <Link
          key={row.key}
          href={row.href}
          className="flex min-h-16 items-start justify-between gap-4 py-4 transition-colors hover:bg-[var(--accent-soft)]/25"
        >
          <span className="min-w-0 flex-1">
            <span className="block font-[family-name:var(--font-display)] text-[1.65rem] leading-[1.1] tracking-tight">
              {row.label}
            </span>
            <span
              className={`mt-1.5 block text-[0.95rem] leading-snug ${
                row.attention ? "font-semibold text-[var(--warn)]" : "text-muted"
              }`}
            >
              {row.detail}
            </span>
            <span className="mt-1 block text-sm leading-snug text-muted">{row.explanation}</span>
          </span>
          <span className="shrink-0 pt-2 text-lg font-semibold text-[var(--accent)]" aria-hidden>
            →
          </span>
        </Link>
      ))}
    </nav>
  );
}
