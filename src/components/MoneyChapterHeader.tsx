import Link from "next/link";
import { lockAction } from "@/app/actions";

export function MoneyChapterHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="mb-6 pt-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/money"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--accent)]"
        >
          ← Money
        </Link>
        <form action={lockAction}>
          <button
            type="submit"
            className="min-h-11 px-1 text-xs font-semibold text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Log out
          </button>
        </form>
      </div>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-[2rem] leading-[1.1] tracking-tight">
        {title}
      </h1>
      {subtitle ? <p className="mt-2 max-w-[36rem] text-base leading-relaxed text-muted">{subtitle}</p> : null}
    </header>
  );
}
