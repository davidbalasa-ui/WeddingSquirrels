import Link from "next/link";

export default function AppNotFound() {
  return (
    <div className="app-shell py-10">
      <div className="card p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Not found</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl leading-tight">
          This page isn&apos;t here
        </h1>
        <p className="mt-2 text-sm text-muted">
          The link may be outdated, or you may not have access to this part of the wedding plan.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/today" className="btn-primary">
            Back to Today
          </Link>
          <Link href="/people" className="btn-secondary">
            People
          </Link>
        </div>
      </div>
    </div>
  );
}
