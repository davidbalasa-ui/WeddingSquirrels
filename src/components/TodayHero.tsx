import Link from "next/link";
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
  const phase = hero.weddingPhase;
  const daysNumber =
    phase === "planning" && hero.phase === "future" && hero.daysToGo !== null
      ? String(hero.daysToGo)
      : phase === "wedding_week" && hero.daysToGo !== null
        ? String(hero.daysToGo)
        : null;

  return (
    <header className="mb-8 pt-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          {hero.greeting}
        </p>
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
        {hero.coupleNames ?? session.name}
      </h1>

      {phase === "wedding_day" ? (
        <div className="mt-7">
          <p className="font-[family-name:var(--font-display)] text-[2.35rem] leading-[1.05] tracking-tight text-[var(--accent)]">
            {hero.kicker}
          </p>
          {hero.lede ? <p className="mt-2 text-base text-muted">{hero.lede}</p> : null}
          {hero.handoffHref && hero.handoffLabel ? (
            <p className="mt-5">
              <Link
                href={hero.handoffHref}
                className="inline-flex min-h-11 items-center font-semibold text-[var(--accent)] underline-offset-4 hover:underline"
              >
                {hero.handoffLabel} →
              </Link>
            </p>
          ) : null}
        </div>
      ) : phase === "day_before" ? (
        <div className="mt-7">
          <p className="font-[family-name:var(--font-display)] text-[2.35rem] leading-[1.05] tracking-tight text-[var(--accent)]">
            {hero.kicker}
          </p>
          {hero.lede ? <p className="mt-2 text-base text-muted">{hero.lede}</p> : null}
        </div>
      ) : phase === "post_wedding" ? (
        <div className="mt-7">
          <p className="font-[family-name:var(--font-display)] text-[2.35rem] leading-[1.05] tracking-tight text-[var(--accent)]">
            {hero.kicker}
          </p>
          {hero.weddingDateLabel ? (
            <p className="mt-2 text-base text-muted">{hero.weddingDateLabel}</p>
          ) : hero.countdownSupport ? (
            <p className="mt-2 text-base text-muted">{hero.countdownSupport}</p>
          ) : null}
        </div>
      ) : daysNumber ? (
        <div className="mt-7">
          <p className="font-[family-name:var(--font-display)] text-[4.25rem] leading-none text-[var(--accent)]">
            {daysNumber}
          </p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-2xl leading-tight text-[var(--accent)]">
            {hero.daysToGo === 1 ? "day" : "days"}
          </p>
          {phase === "wedding_week" && hero.lede ? (
            <p className="mt-2 text-base text-muted">{hero.lede}</p>
          ) : hero.countdownSupport ? (
            <p className="mt-2 text-base text-muted">{hero.countdownSupport}</p>
          ) : null}
        </div>
      ) : hero.countdownLabel ? (
        <div className="mt-7">
          <p className="font-[family-name:var(--font-display)] text-4xl leading-tight text-[var(--accent)]">
            {hero.countdownLabel}
          </p>
          {hero.countdownSupport ? (
            <p className="mt-2 text-base text-muted">{hero.countdownSupport}</p>
          ) : null}
        </div>
      ) : hero.countdownSupport ? (
        <p className="mt-7 text-base text-muted">{hero.countdownSupport}</p>
      ) : null}

      {hero.weddingDateLabel && phase !== "post_wedding" ? (
        <p className="mt-6 text-sm text-muted">{hero.weddingDateLabel}</p>
      ) : null}
      {hero.venue ? <p className="mt-1 text-sm text-muted">{hero.venue}</p> : null}
    </header>
  );
}
