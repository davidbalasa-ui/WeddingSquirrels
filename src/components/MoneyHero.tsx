import { lockAction } from "@/app/actions";
import type { SessionAccount } from "@/lib/types";

export function MoneyHero({ session: _session }: { session: SessionAccount }) {
  return (
    <header className="mb-8 pt-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Money</p>
        <form action={lockAction}>
          <button
            type="submit"
            className="min-h-11 px-1 text-xs font-semibold text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Log out
          </button>
        </form>
      </div>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-[2.15rem] leading-[1.05] tracking-tight">
        Know what we’ve committed, what we’ve paid, and what’s next.
      </h1>
    </header>
  );
}
