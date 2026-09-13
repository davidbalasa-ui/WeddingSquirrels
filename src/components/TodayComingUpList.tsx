"use client";

import Link from "next/link";
import { withReturnTo } from "@/lib/return-to";
import { useTodayOriginHref } from "@/lib/today-origin";
import type { TodayComingUpItem } from "@/lib/today";

function formatComingUpDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TodayComingUpList({
  items,
  title = "Coming up",
}: {
  items: TodayComingUpItem[];
  title?: string;
}) {
  const originHref = useTodayOriginHref();

  if (items.length === 0) return null;

  return (
    <section className="mb-10">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{title}</p>
      <div className="mt-1 divide-y divide-[var(--line)] border-b border-t border-[var(--line)]">
        {items.map((item) => {
          const href = item.href ? withReturnTo(item.href, originHref) : null;
          const row = (
            <div className="flex min-h-14 items-start justify-between gap-3 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-[1.05rem] font-semibold leading-snug">{item.title}</p>
                {item.subtitle ? <p className="mt-1 text-sm text-muted">{item.subtitle}</p> : null}
              </div>
              <p className="shrink-0 pt-0.5 text-sm font-semibold text-[var(--accent)]">
                {formatComingUpDate(item.date)}
              </p>
            </div>
          );

          if (href) {
            return (
              <Link
                key={item.id}
                href={href}
                className="block transition-colors hover:bg-[var(--accent-soft)]/25"
              >
                {row}
              </Link>
            );
          }

          return <div key={item.id}>{row}</div>;
        })}
      </div>
    </section>
  );
}
