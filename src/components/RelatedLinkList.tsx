import Link from "next/link";

export type RelatedLinkItem = {
  href: string;
  title: string;
  detail?: string | null;
};

export function RelatedLinkList({
  title,
  items,
}: {
  title: string;
  items: RelatedLinkItem[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="mb-8">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{title}</p>
      <div className="border-t border-[var(--line)]">
        {items.map((item) => (
          <Link
            key={item.href + item.title}
            href={item.href}
            className="flex min-h-14 items-start justify-between gap-3 border-b border-[var(--line)] py-3.5 transition-colors hover:bg-[var(--accent-soft)]/25"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[1.05rem] font-semibold leading-snug">{item.title}</p>
              {item.detail ? <p className="mt-1 text-sm text-muted">{item.detail}</p> : null}
            </div>
            <span className="shrink-0 pt-0.5 text-lg text-muted" aria-hidden>
              ›
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
