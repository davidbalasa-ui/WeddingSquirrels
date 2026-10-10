"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { autoApplyCorrectionsAction } from "@/app/actions";

const SHOWN = 6;

/**
 * Master only: the Apply cards' additive changes land on their own the first time a page
 * loads after a deploy, and David sees what changed. Once per deploy per browser; a load
 * that cannot reach the server tries again next time.
 */
export function AutoApplyCorrections({ buildId }: { buildId: string }) {
  const router = useRouter();
  const [lines, setLines] = useState<string[]>([]);
  const [all, setAll] = useState(false);

  useEffect(() => {
    const key = `ws-auto-applied:${buildId}`;
    try {
      if (window.localStorage.getItem(key)) return;
    } catch {
      // No storage (private window): the server still never applies anything twice.
    }
    let cancelled = false;
    void autoApplyCorrectionsAction()
      .catch(() => ({ ok: false as const }))
      .then((result) => {
        if (!result.ok || cancelled) return;
        try {
          window.localStorage.setItem(key, "1");
        } catch {}
        if (result.lines.length) {
          setLines(result.lines);
          router.refresh();
        }
      });
    return () => {
      cancelled = true;
    };
  }, [buildId, router]);

  if (!lines.length) return null;
  const shown = all ? lines : lines.slice(0, SHOWN);
  return (
    <section className="card mb-4 px-3 py-3 text-sm print-hide" data-testid="auto-applied" role="status">
      <p className="font-semibold">Applied just now:</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {shown.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {lines.length > SHOWN ? (
          <button type="button" className="min-h-9 text-xs font-semibold text-[var(--accent)]" onClick={() => setAll((v) => !v)}>
            {all ? "Show fewer" : `Show all ${lines.length}`}
          </button>
        ) : null}
        <button type="button" className="min-h-9 text-xs font-semibold text-muted" onClick={() => setLines([])}>
          Done
        </button>
      </div>
    </section>
  );
}
