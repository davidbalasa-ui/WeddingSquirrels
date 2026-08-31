"use client";

export default function AppError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
}) {
  const retry = unstable_retry ?? reset ?? (() => window.location.reload());

  return (
    <div className="card mt-6 p-6 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-2xl">This page couldn’t load</h1>
      <p className="mt-2 text-sm text-muted">Something went wrong. Try again, or go back to Home.</p>
      <div className="mt-4 flex flex-col gap-2">
        <button type="button" className="btn-primary" onClick={() => retry()}>
          Try again
        </button>
        <a href="/today" className="btn-secondary">
          Back to Home
        </a>
      </div>
      {error.digest ? (
        <p className="mt-3 text-[11px] text-muted">ERROR {error.digest}</p>
      ) : null}
    </div>
  );
}
