export function PageLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4">
      <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--accent)]">
        WeddingSquirrels
      </p>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <div className="loading-shimmer h-14 rounded-[1.1rem]" />
        <div className="loading-shimmer h-10 rounded-[1.1rem]" />
        <div className="loading-shimmer h-10 rounded-[1.1rem]" />
      </div>
      <p className="text-sm font-semibold text-muted">{label}…</p>
    </div>
  );
}
