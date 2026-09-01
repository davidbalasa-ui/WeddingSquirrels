import Link from "next/link";

export function EmptyState({
  title,
  detail,
  actionHref,
  actionLabel,
}: {
  title: string;
  detail?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="card p-5 text-sm text-muted">
      <p className="font-semibold text-ink">{title}</p>
      {detail ? <p className="mt-1">{detail}</p> : null}
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="mt-2 inline-block font-semibold text-[var(--accent)]">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
