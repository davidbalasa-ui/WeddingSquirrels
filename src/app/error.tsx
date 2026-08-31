"use client";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="app-shell">
      <div className="card mt-10 p-6 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-2xl">This page couldn’t load</h1>
        <p className="mt-2 text-sm text-muted">
          The wedding database may still be waking up. Wait a few seconds, then try again.
        </p>
        <button type="button" className="btn-primary mt-4" onClick={() => reset()}>
          Try again
        </button>
        {error.digest ? (
          <p className="mt-3 text-[11px] text-muted">ERROR {error.digest}</p>
        ) : null}
      </div>
    </main>
  );
}
