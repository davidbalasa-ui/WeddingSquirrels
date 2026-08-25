"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { ModuleIcon } from "@/components/ModuleIcon";
import { moreGroups } from "@/lib/modules";
import type { SessionAccount } from "@/lib/types";

export function MoreSheet({
  session,
  onClose,
}: {
  session: SessionAccount;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const groups = moreGroups(session);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="More"
        tabIndex={-1}
        className="sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl">More</h2>
          <button
            type="button"
            className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[var(--surface)]"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        {groups.map((group) => (
          <div key={group.group} className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              {group.label}
            </p>
            <div className="flex flex-col gap-1">
              {group.items.map((item) => {
                const active = pathname.startsWith(item.href!);
                return (
                  <Link
                    key={item.key}
                    href={item.href!}
                    onClick={onClose}
                    className="sheet-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold"
                    data-active={active}
                    aria-current={active ? "page" : undefined}
                  >
                    <ModuleIcon name={item.icon} className="h-5 w-5 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
