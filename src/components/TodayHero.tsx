import { lockAction } from "@/app/actions";
import type { TodayHeroData } from "@/lib/today";
import type { SessionAccount } from "@/lib/types";

export function TodayHero({
  session,
  hero,
}: {
  session: SessionAccount;
  hero: TodayHeroData;
}) {
  const daysLabel =
    hero.daysToGo === null
      ? null
      : hero.daysToGo < 0
        ? `${Math.abs(hero.daysToGo)} days ago`
        : hero.daysToGo === 0
          ? "Today"
          : hero.daysToGo === 1
            ? "Tomorrow"
            : `${hero.daysToGo} days`;

  return (
    <header className="sticky top-0 z-20 -mx-4 mb-4 border-b border-line bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] px-4 py-4 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            {session.name}
            {session.isMaster ? " · Master" : ""}
          </p>
          <p className="mt-1 text-sm text-muted">{hero.greeting}</p>
          {hero.coupleNames ? (
            <h1 className="font-[family-name:var(--font-display)] text-[1.75rem] leading-tight tracking-tight">
              {hero.coupleNames}
            </h1>
          ) : (
            <h1 className="font-[family-name:var(--font-display)] text-[1.75rem] leading-tight tracking-tight">
              Today
            </h1>
          )}
          {hero.weddingDateLabel ? (
            <p className="mt-1 text-sm text-muted">{hero.weddingDateLabel}</p>
          ) : null}
        </div>

        <div className="shrink-0 text-right">
          {daysLabel ? (
            <>
              <p className="font-[family-name:var(--font-display)] text-3xl leading-none text-[var(--accent)]">
                {hero.daysToGo !== null && hero.daysToGo >= 0 ? hero.daysToGo : daysLabel}
              </p>
              <p className="text-[11px] text-muted">
                {hero.daysToGo !== null && hero.daysToGo >= 0 ? "days to go" : "since wedding"}
              </p>
            </>
          ) : null}
          <form action={lockAction} className="mt-2">
            <button
              type="submit"
              className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink hover:bg-[var(--surface)]"
            >
              Log out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
