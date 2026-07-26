import { differenceInCalendarDays } from "date-fns";
import { lockAction } from "@/app/actions";
import type { SessionAccount } from "@/lib/types";
import { weddingDate } from "@/lib/due-dates";

export function AppHeader({
  session,
  title,
  subtitle,
}: {
  session: SessionAccount;
  title: string;
  subtitle?: string;
}) {
  const days = differenceInCalendarDays(weddingDate(), new Date());

  return (
    <header className="sticky top-0 z-20 -mx-4 mb-4 border-b border-line bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] px-4 py-3 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            {session.name}
            {session.isMaster ? " · Master" : ""}
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-2xl leading-tight tracking-tight">
            {title}
          </h1>
          {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
        </div>
        <div className="text-right">
          <p className="font-[family-name:var(--font-display)] text-lg text-[var(--accent)]">{days}</p>
          <p className="text-[11px] text-muted">days to go</p>
          <form action={lockAction} className="mt-2">
            <button type="submit" className="text-xs font-semibold text-muted underline-offset-2 hover:underline">
              Lock
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
