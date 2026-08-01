"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

export function ShowDoneToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const showDone = params.get("done") === "1";

  return (
    <button
      type="button"
      className="filter-pill rounded-full border border-line px-3 py-2 text-xs font-semibold text-muted"
      style={{ background: showDone ? "var(--accent-soft)" : "var(--bg-elevated)", color: showDone ? "var(--accent)" : undefined }}
      onClick={() => {
        const next = new URLSearchParams(params.toString());
        if (showDone) next.delete("done");
        else next.set("done", "1");
        const q = next.toString();
        router.push(q ? `${pathname}?${q}` : pathname);
      }}
    >
      {showDone ? "Hide done" : "Show done"}
    </button>
  );
}
